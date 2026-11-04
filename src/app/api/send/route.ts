import { MAX_TEXT, isBotId, type Message } from "@/lib/bots";
import { addMessage } from "@/lib/store";

// Il messaggio va in bacheca: sarà l'agent a passare a leggerlo (GET /api/board).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const bot = body?.bot;
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (!isBotId(bot)) return Response.json({ error: "Bot sconosciuto" }, { status: 400 });
  if (!text) return Response.json({ error: "Messaggio vuoto" }, { status: 400 });
  if (text.length > MAX_TEXT) return Response.json({ error: "Messaggio troppo lungo" }, { status: 400 });

  const message: Message = { id: crypto.randomUUID(), bot, from: "me", text, ts: Date.now() };
  await addMessage(message);

  return Response.json({ message });
}
