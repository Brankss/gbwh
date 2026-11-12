import { connection, type NextRequest } from "next/server";
import { MAX_FILLO_TEXT, filloMessages, filloMeta, userSays } from "@/lib/fillo";
import { wakeConfigured } from "@/lib/wake";

// Chat dell'ospite con fillobot (ci arriva chi entra con la password ospite, o Branko).
export async function GET() {
  await connection();
  const [messages, meta] = await Promise.all([filloMessages(), filloMeta()]);
  return Response.json({ messages, readAt: meta.readAt, wokeAt: meta.wokeAt, wake: wakeConfigured() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return Response.json({ error: "Messaggio vuoto" }, { status: 400 });
  if (text.length > MAX_FILLO_TEXT) return Response.json({ error: "Messaggio troppo lungo" }, { status: 400 });
  const { msg, wake } = await userSays(text);
  return Response.json({ ok: true, message: msg, wake });
}
