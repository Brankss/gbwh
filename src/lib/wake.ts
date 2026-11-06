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
      // Tempi brevi: su serverless non possiamo aspettare minuti un server che non risponde.
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 12_000,
    });
  }
  return transport;
}

/* ---------- Registro: ultimo invio riuscito e ultimo tentativo per bot ---------- */

const LOG_KEY = "wake:log";
export type WakeResult = "sent" | "skipped-not-configured" | "skipped-already-pinged" | "failed" | "timeout";
export type WakeLog = { at: number; result: WakeResult; kind: string; error?: string };

const memLog = ((globalThis as { __wakeLog?: Record<string, WakeLog> }).__wakeLog ??= {});

async function getLast(bot: string) {
  if (redis) return Number((await redis.hget<number>(LAST_KEY, bot)) ?? 0);
  return memLast[bot] ?? 0;
}
async function setLast(bot: string, at: number) {
  if (redis) await redis.hset(LAST_KEY, { [bot]: at });
  else memLast[bot] = at;
}
async function log(bot: string, entry: WakeLog) {
  if (redis) await redis.hset(LOG_KEY, { [bot]: entry });
  else memLog[bot] = entry;
}

/** Errore SMTP in parole semplici (è quello che vedi nell'hub). */
function explain(e: unknown): string {
  const err = e as { code?: string; responseCode?: number; message?: string };
  // nodemailer spesso incarta l'errore di rete: guardiamo anche il testo.
  const msg = err.message ?? "";
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN/.test(msg)) return "Server di posta irraggiungibile: controlla SMTP_HOST e SMTP_PORT.";
  if (/ETIMEDOUT|timeout/i.test(msg)) return "Il server di posta non risponde (timeout).";
  if (err.code === "EAUTH" || err.responseCode === 535) return "Credenziali rifiutate: controlla SMTP_USER e la password per le app.";
  if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") return "Server di posta irraggiungibile: controlla SMTP_HOST e SMTP_PORT.";
  if (err.code === "ETIMEDOUT" || err.code === "ECONNECTION") return "Il server di posta non risponde (timeout).";
  if (err.responseCode && err.responseCode >= 500) return `Il server ha rifiutato la mail (${err.responseCode}): ${err.message ?? ""}`.trim();
  return err.message ?? "Errore sconosciuto";
}

/**
 * Manda la sveglia a un bot. Non lancia mai errori: la chat non deve rompersi se la mail fallisce.
 * `force` salta l'anti-raffica (pulsante "Sveglia" nell'hub).
 */
export async function wakeBot(
  botId: string,
  what: { kind: "messaggio" | "nota" | "manuale"; text: string },
  opts: { force?: boolean } = {},
): Promise<WakeResult> {
  if (!wakeConfigured()) return "skipped-not-configured";
  const now = Date.now();
  try {
    const [last, readAt] = await Promise.all([getLast(botId), getReadAt(botId)]);
    // Già svegliato, non ha ancora letto, ed è passato poco: inutile mandare un'altra mail.
    if (!opts.force && last > readAt && now - last < RETRY_AFTER) return "skipped-already-pinged";

    const bot = (await getBots()).find((b) => b.id === botId);
    const name = bot?.name ?? botId;
    const site = (process.env.URL ?? "").replace(/\/$/, "");
    const preview = what.text.length > 500 ? `${what.text.slice(0, 500)}…` : what.text;
    const intro =
      what.kind === "nota" ? "Nuova nota di Branko visibile a te:" : what.kind === "manuale" ? "Branko ti chiede di controllare l'hub." : "Branko ti ha scritto:";

    await mailer().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: taggedAddress(process.env.WAKE_EMAIL!, botId),
      subject: `[${botId}] ${what.kind === "nota" ? "Nuova nota" : what.kind === "manuale" ? "Sveglia" : "Nuovo messaggio"} per ${name}`,
      text: [
        `Sveglia per: ${name} (bot=${botId})`,
        "",
        intro,
        preview,
        "",
        "Leggi i messaggi nuovi e rispondi dall'hub (con il tuo token):",
        `GET  ${site}/api/board?bot=${botId}&since=<il tuo cursor>`,
        `POST ${site}/api/board?bot=${botId}   {"message": "..."}`,
      ]
        .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
        .join("\n"),
    });
    await Promise.all([setLast(botId, now), log(botId, { at: now, result: "sent", kind: what.kind })]);
    return "sent";
  } catch (e) {
    console.error(`[wake] invio fallito per ${botId}`, e);
    await log(botId, { at: now, result: "failed", kind: what.kind, error: explain(e) }).catch(() => {});
    return "failed";
  }
}

/**
 * Sveglia con un tetto di tempo: si aspetta l'invio (su serverless, se rispondiamo prima,
 * la funzione può spegnersi e la mail non partire), ma mai più di `ms` millisecondi.
 */
export async function wakeWithin(botId: string, what: Parameters<typeof wakeBot>[1], ms = 6_000): Promise<WakeResult> {
  return Promise.race([wakeBot(botId, what), new Promise<WakeResult>((r) => setTimeout(() => r("timeout"), ms))]);
}

/** Controlla le credenziali SMTP senza mandare niente. */
export async function verifyMail(): Promise<{ ok: boolean; error?: string }> {
  if (!wakeConfigured()) return { ok: false, error: "Mancano le variabili: WAKE_EMAIL, SMTP_HOST, SMTP_USER, SMTP_PASS." };
  try {
    await mailer().verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: explain(e) };
  }
}

export async function wakeStatus() {
  const configured = wakeConfigured();
  const logs = redis ? ((await redis.hgetall<Record<string, WakeLog>>(LOG_KEY)) ?? {}) : memLog;
  return {
    configured,
    address: configured ? taggedAddress(process.env.WAKE_EMAIL!, "<bot>") : null,
    bots: logs,
  };
}
