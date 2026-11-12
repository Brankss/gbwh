import type { NextRequest } from "next/server";
import { filloBotToken, safeEqual } from "@/lib/auth";
import { MAX_FILLO_TEXT, botReads, botSays } from "@/lib/fillo";

// Porta d'ingresso di fillobot: il suo token apre solo questa chat.
async function denied(request: NextRequest): Promise<Response | null> {
  const expected = await filloBotToken();
  if (!expected) return Response.json({ error: "INBOUND_SECRET non configurato" }, { status: 503 });
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.nextUrl.searchParams.get("token") ?? "";
  return safeEqual(provided, expected) ? null : Response.json({ error: "Non autorizzato" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const no = await denied(request);
  if (no) return no;
  const since = Number(request.nextUrl.searchParams.get("since") ?? 0) || 0;
  const data = await botReads(since);
  return Response.json({ ...data, come_rispondere: 'POST su questo stesso indirizzo con {"message": "testo"}' }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const no = await denied(request);
  if (no) return no;
  const body = (await request.json().catch(() => null)) as { message?: unknown; text?: unknown } | null;
  const raw = body?.message ?? body?.text;
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return Response.json({ error: 'Messaggio vuoto: manda {"message": "testo"}' }, { status: 400 });
  if (text.length > MAX_FILLO_TEXT) return Response.json({ error: `Messaggio troppo lungo (max ${MAX_FILLO_TEXT} caratteri)` }, { status: 400 });
  const msg = await botSays(text);
  return Response.json({ ok: true, id: msg.id });
}
