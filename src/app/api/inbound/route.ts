import type { NextRequest } from "next/server";
import { safeEqual } from "@/lib/auth";
import { MAX_TEXT, isBotId } from "@/lib/bots";
import { addMessage } from "@/lib/store";

/**
 * Indirizzo pubblico dove i bot mandano le loro risposte.
 *
 *   POST /api/inbound?bot=berlu
 *   Authorization: Bearer <INBOUND_SECRET>      (oppure ?token=<INBOUND_SECRET>)
 *   { "message": "ciao" }
 *
 * Il bot si può indicare anche nel body ("bot"), e il testo può stare in
 * message / text / content / reply, oppure essere il body in testo semplice.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.INBOUND_SECRET;
  if (!secret) return Response.json({ error: "INBOUND_SECRET non configurato" }, { status: 503 });

  const params = request.nextUrl.searchParams;
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? params.get("token") ?? "";
  if (!safeEqual(provided, secret)) return Response.json({ error: "Non autorizzato" }, { status: 401 });

  const raw = await request.text();
  let body: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") body = parsed;
  } catch {
    body = { message: raw };
  }

  const bot = String(params.get("bot") ?? body.bot ?? "").toLowerCase();
  if (!isBotId(bot)) return Response.json({ error: "Parametro 'bot' mancante o sconosciuto" }, { status: 400 });

  const candidate = body.message ?? body.text ?? body.content ?? body.reply;
  const text = typeof candidate === "string" ? candidate.trim().slice(0, MAX_TEXT) : "";
  if (!text) return Response.json({ error: "Nessun testo nel messaggio" }, { status: 400 });

  const message = { id: crypto.randomUUID(), bot, from: "bot" as const, text, ts: Date.now() };
  await addMessage(message);

  return Response.json({ ok: true, id: message.id });
}
