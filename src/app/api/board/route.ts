import type { NextRequest } from "next/server";
import { safeEqual } from "@/lib/auth";
import { BOT_IDS, MAX_TEXT, isBotId, type BotId } from "@/lib/bots";
import { addMessage, getSnapshot, markRead } from "@/lib/store";

/**
 * Bacheca pubblica per l'agent. Stesso indirizzo per leggere e per rispondere.
 *
 * Auth: header `Authorization: Bearer <INBOUND_SECRET>` oppure `?token=<INBOUND_SECRET>`.
 *
 * LEGGERE i messaggi nuovi:
 *   GET /api/board?bot=berlu&since=<cursor>
 *   -> { messages: [{ id, bot, from, text, ts, at }], cursor }
 *   Al giro dopo si passa `since=<cursor>` ricevuto. Senza `bot` arrivano tutti e tre.
 *   Di default solo i messaggi scritti da te; con `&all=1` anche le risposte dei bot (utile come contesto).
 *
 * RISPONDERE:
 *   POST /api/board?bot=berlu   { "message": "ciao" }
 *   Il testo può stare in message / text / content / reply, o essere testo semplice.
 */

const noStore = { "Cache-Control": "no-store" };

function authError(request: NextRequest): Response | null {
  const secret = process.env.INBOUND_SECRET;
  if (!secret) return Response.json({ error: "INBOUND_SECRET non configurato" }, { status: 503 });
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.nextUrl.searchParams.get("token") ?? "";
  return safeEqual(provided, secret) ? null : Response.json({ error: "Non autorizzato" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const denied = authError(request);
  if (denied) return denied;

  const params = request.nextUrl.searchParams;
  const botParam = params.get("bot")?.toLowerCase();
  if (botParam && !isBotId(botParam)) return Response.json({ error: "Bot sconosciuto" }, { status: 400 });

  const bots: BotId[] = botParam ? [botParam as BotId] : BOT_IDS;
  const since = Number(params.get("since")) || 0;
  const all = params.get("all") === "1";

  // Preso PRIMA di leggere: tutto quello che c'è nello snapshot è più vecchio di così.
  const readAt = Date.now();
  const { inbox, read } = await getSnapshot();

  const messages = bots
    .flatMap((b) => inbox[b])
    .filter((m) => m.ts > since && (all || m.from === "me"))
    .sort((a, b) => a.ts - b.ts)
    .map((m) => ({ ...m, at: new Date(m.ts).toISOString() }));

  // Spunta "letto" in chat: solo per i bot che avevano messaggi tuoi non ancora letti.
  const toMark = bots.filter((b) =>
    messages.some((m) => m.bot === b && m.from === "me" && m.ts > (read[b] ?? 0)),
  );
  await markRead(toMark, readAt);

  const cursor = messages.reduce((max, m) => Math.max(max, m.ts), since);
  return Response.json({ messages, cursor }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  const denied = authError(request);
  if (denied) return denied;

  const raw = await request.text();
  let body: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(raw);
    body = parsed && typeof parsed === "object" ? parsed : { message: String(parsed) };
  } catch {
    body = { message: raw };
  }

  const bot = String(request.nextUrl.searchParams.get("bot") ?? body.bot ?? "").toLowerCase();
  if (!isBotId(bot)) return Response.json({ error: "Parametro 'bot' mancante o sconosciuto" }, { status: 400 });

  const candidate = body.message ?? body.text ?? body.content ?? body.reply;
  const text = typeof candidate === "string" ? candidate.trim().slice(0, MAX_TEXT) : "";
  if (!text) return Response.json({ error: "Nessun testo nel messaggio" }, { status: 400 });

  const message = { id: crypto.randomUUID(), bot, from: "bot" as const, text, ts: Date.now() };
  await addMessage(message);

  return Response.json({ ok: true, id: message.id }, { headers: noStore });
}
