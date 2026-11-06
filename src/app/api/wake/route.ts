import { connection } from "next/server";
import { getBots } from "@/lib/store";
import { wakeBot, wakeStatus } from "@/lib/wake";

// Per te (protetto dalla password).

/** Stato della sveglia email: configurata? ultimo tentativo per ogni bot. */
export async function GET() {
  await connection();
  return Response.json(await wakeStatus(), { headers: { "Cache-Control": "no-store" } });
}

/** Sveglia manuale (pulsante ⚡): ignora l'anti-raffica. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const bot = typeof body?.bot === "string" ? body.bot : "";
  if (!(await getBots()).some((b) => b.id === bot)) return Response.json({ error: "Bot sconosciuto" }, { status: 400 });
  const result = await wakeBot(bot, { kind: "manuale", text: "" }, { force: true });
  const status = await wakeStatus();
  return Response.json({ result, log: status.bots[bot] ?? null }, { status: result === "failed" ? 502 : 200 });
}
