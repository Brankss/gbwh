import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { redis } from "./redis";
import { getBots, getReadAt } from "./store";

/**
 * Sveglia i bot via email: tutti condividono una casella (es. pandoro@mail.grokbot.com) e il bot
 * giusto si riconosce dal tag nell'indirizzo: pandoro+syrup@mail.grokbot.com → Syrup.
 * Il nome del bot è anche nell'oggetto ("[syrup] …") nel caso il tag si perda.
 *
 * Variabili: WAKE_EMAIL, SMTP_HOST, SMTP_PORT (465), SMTP_USER, SMTP_PASS, MAIL_FROM (facoltativa).
 */

const LAST_KEY = "wake:last";
/** Se il bot è già stato svegliato e non ha ancora letto, si riprova solo dopo questo tempo. */
const RETRY_AFTER = 15 * 60 * 1000;

const memLast = ((globalThis as { __wakeLast?: Record<string, number> }).__wakeLast ??= {});

export function wakeConfigured() {
  return Boolean(process.env.WAKE_EMAIL && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** pandoro@mail.grokbot.com + syrup → pandoro+syrup@mail.grokbot.com */
export function taggedAddress(base: string, botId: string) {
  const at = base.lastIndexOf("@");
  if (at < 1) throw new Error("WAKE_EMAIL non valida");
  return `${base.slice(0, at)}+${botId}${base.slice(at)}`;
}

let transport: Transporter | null = null;
function mailer() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transport;
}

async function getLast(bot: string) {
  if (redis) return Number((await redis.hget<number>(LAST_KEY, bot)) ?? 0);
  return memLast[bot] ?? 0;
}
async function setLast(bot: string, at: number) {
  if (redis) await redis.hset(LAST_KEY, { [bot]: at });
  else memLast[bot] = at;
}

export type WakeResult = "sent" | "skipped-not-configured" | "skipped-already-pinged" | "failed";

/** Manda la sveglia a un bot. Non lancia mai errori: la chat non deve rompersi se la mail fallisce. */
export async function wakeBot(botId: string, what: { kind: "messaggio" | "nota"; text: string }): Promise<WakeResult> {
  if (!wakeConfigured()) return "skipped-not-configured";
  try {
    const now = Date.now();
    const [last, readAt] = await Promise.all([getLast(botId), getReadAt(botId)]);
    // Già svegliato, non ha ancora letto, ed è passato poco: inutile mandare un'altra mail.
    if (last > readAt && now - last < RETRY_AFTER) return "skipped-already-pinged";

    const bot = (await getBots()).find((b) => b.id === botId);
    const name = bot?.name ?? botId;
    const site = (process.env.URL ?? "").replace(/\/$/, "");
    const preview = what.text.length > 500 ? `${what.text.slice(0, 500)}…` : what.text;

    await mailer().sendMail({
      from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
      to: taggedAddress(process.env.WAKE_EMAIL!, botId),
      subject: `[${botId}] ${what.kind === "nota" ? "Nuova nota" : "Nuovo messaggio"} per ${name}`,
      text: [
        `Sveglia per: ${name} (bot=${botId})`,
        "",
        what.kind === "nota" ? "Nuova nota di Branko visibile a te:" : "Branko ti ha scritto:",
        preview,
        "",
        "Leggi i messaggi nuovi e rispondi dall'hub (con il tuo token):",
        `GET  ${site}/api/board?bot=${botId}&since=<il tuo cursor>`,
        `POST ${site}/api/board?bot=${botId}   {"message": "..."}`,
      ].join("\n"),
    });
    await setLast(botId, now);
    return "sent";
  } catch (e) {
    console.error(`[wake] invio fallito per ${botId}`, e);
    return "failed";
  }
}
