import { after } from "next/server";
import { BOTS, MAX_TEXT, isBotId, type BotId, type Message } from "@/lib/bots";
import { addMessage } from "@/lib/store";

// URL e chiavi stanno SOLO nelle variabili d'ambiente del server, mai nel browser.
function webhookFor(bot: BotId) {
  const prefix = bot.toUpperCase();
  return {
    url: process.env[`${prefix}_WEBHOOK_URL`],
    key: process.env[`${prefix}_WEBHOOK_KEY`],
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const bot = body?.bot;
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (!isBotId(bot)) return Response.json({ error: "Bot sconosciuto" }, { status: 400 });
  if (!text) return Response.json({ error: "Messaggio vuoto" }, { status: 400 });
  if (text.length > MAX_TEXT) return Response.json({ error: "Messaggio troppo lungo" }, { status: 400 });

  const { url, key } = webhookFor(bot);
  let failed = false;

  if (url && key) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ message: text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        failed = true;
        console.error(`[send] webhook ${bot} ha risposto ${res.status}`);
      }
    } catch (err) {
      failed = true;
      console.error(`[send] webhook ${bot} irraggiungibile`, err);
    }
  } else if (process.env.NODE_ENV === "production") {
    failed = true;
    console.error(`[send] webhook ${bot} non configurato`);
  } else {
    // Modalità demo in locale: senza webhook il bot risponde da solo, così vedi la UI funzionare.
    const name = BOTS.find((b) => b.id === bot)!.name;
    after(async () => {
      await new Promise((r) => setTimeout(r, 1200));
      await addMessage({
        id: crypto.randomUUID(),
        bot,
        from: "bot",
        text: `[demo] ${name} ha ricevuto: "${text.slice(0, 120)}"`,
        ts: Date.now(),
      });
    });
  }

  const message: Message = { id: crypto.randomUUID(), bot, from: "me", text, ts: Date.now(), failed };
  await addMessage(message);

  return Response.json({ message }, { status: failed ? 502 : 200 });
}
