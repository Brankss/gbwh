import "server-only";
import { filloBotToken } from "./auth";
import { redis } from "./redis";
import { sendWakeMail } from "./wake";

// La chat a parte dell'ospite con fillobot. Dati separati da tutto il resto dell'hub
// (chiavi fillo:*): fillobot non compare tra i tuoi agenti e non vede bacheca, calendario o altro.

export const FILLO_BOT = "fillobot";
export type FilloMessage = { id: string; from: "user" | "bot"; text: string; ts: number };
type Meta = { readAt: number; wokeAt: number };

const CHAT = "fillo:chat";
const META = "fillo:meta";
const KEEP = 400;
const RETRY_AFTER = 15 * 60 * 1000;
export const MAX_FILLO_TEXT = 4000;

const mem = ((globalThis as { __fillo?: { list: FilloMessage[]; meta: Meta } }).__fillo ??= { list: [], meta: { readAt: 0, wokeAt: 0 } });

export async function filloMessages(): Promise<FilloMessage[]> {
  return redis ? ((await redis.lrange<FilloMessage>(CHAT, 0, -1)) ?? []) : mem.list;
}

export async function filloMeta(): Promise<Meta> {
  const saved = redis ? await redis.get<Partial<Meta>>(META) : mem.meta;
  return { readAt: 0, wokeAt: 0, ...(saved ?? {}) };
}

async function saveMeta(patch: Partial<Meta>) {
  const next = { ...(await filloMeta()), ...patch };
  if (redis) await redis.set(META, next);
  else mem.meta = next;
}

async function add(from: FilloMessage["from"], text: string): Promise<FilloMessage> {
  const msg: FilloMessage = { id: crypto.randomUUID(), from, text, ts: Date.now() };
  if (redis) {
    const p = redis.pipeline();
    p.rpush(CHAT, msg);
    p.ltrim(CHAT, -KEEP, -1);
    await p.exec();
  } else {
    mem.list.push(msg);
    if (mem.list.length > KEEP) mem.list.splice(0, mem.list.length - KEEP);
  }
  return msg;
}

/** L'ospite scrive: il messaggio si salva e fillobot viene svegliato via email (senza raffiche). */
export async function userSays(text: string) {
  const msg = await add("user", text);
  const meta = await filloMeta();
  // Già svegliato, non ha ancora letto, ed è passato poco: niente seconda mail.
  if (meta.wokeAt > meta.readAt && msg.ts - meta.wokeAt < RETRY_AFTER) return { msg, wake: "skipped-already-pinged" as const };
  const site = (process.env.SITE_URL ?? process.env.URL ?? "").replace(/\/$/, "");
  const token = await filloBotToken();
  const wake = await sendWakeMail(FILLO_BOT, "Nuovo messaggio per fillobot", [
    `Sveglia per: fillobot (bot=${FILLO_BOT})`,
    "",
    "Ti hanno scritto nella tua chat:",
    text.length > 500 ? `${text.slice(0, 500)}…` : text,
    "",
    "Leggi i messaggi nuovi e rispondi (questa chat è l'unica cosa a cui hai accesso):",
    `GET  ${site}/api/fillo/bot?token=${token}&since=<il tuo cursor>`,
    `POST ${site}/api/fillo/bot?token=${token}   {"message": "..."}`,
  ]);
  if (wake === "sent") await saveMeta({ wokeAt: Date.now() });
  return { msg, wake };
}

/** fillobot legge: messaggi dell'ospite dopo il cursor, e la chat risulta letta. */
export async function botReads(since: number) {
  const all = await filloMessages();
  await saveMeta({ readAt: Date.now() });
  const fresh = all.filter((m) => m.from === "user" && m.ts > since);
  return { messages: fresh, cursor: all.length ? all[all.length - 1].ts : since, recent: all.slice(-20) };
}

export async function botSays(text: string) {
  const msg = await add("bot", text);
  await saveMeta({ readAt: Date.now() });
  return msg;
}

/** Istruzioni da dare a fillobot (le vede solo Branko, da /api/fillo/setup). */
export async function filloInstructions() {
  const site = (process.env.SITE_URL ?? process.env.URL ?? "").replace(/\/$/, "");
  const token = await filloBotToken();
  return [
    "Sei fillobot: un agent autonomo con una chat tutta tua. Chi ti scrive lì è il tuo interlocutore: rispondi e aiutalo come faresti normalmente.",
    "",
    "La chat vive qui (questo indirizzo con il token è tutto quello che ti serve, non hai accesso ad altro):",
    `- Leggere i messaggi nuovi:  GET  ${site}/api/fillo/bot?token=${token}&since=<cursor>`,
    "  La risposta contiene `messages` (quelli nuovi), `recent` (gli ultimi 20, per il contesto) e `cursor`: ripassalo come since la volta dopo.",
    `- Rispondere:                POST ${site}/api/fillo/bot?token=${token}   con body JSON {"message": "testo"}`,
    "",
    `Quando arriva un messaggio ricevi una mail di sveglia con oggetto "[${FILLO_BOT}] Nuovo messaggio per fillobot": leggi e rispondi subito.`,
    "Se non ricevi mail, controlla comunque la chat ogni tanto.",
  ].join("\n");
}
