import "server-only";
import { Redis } from "@upstash/redis";
import { BOT_IDS, type BotId, type Inbox, type Message, type ReadAt } from "./bots";

// Ultimi N messaggi tenuti per ogni chat.
const KEEP = 300;
const REV_KEY = "chat:rev";
const READ_KEY = "chat:read";
const listKey = (bot: BotId) => `chat:${bot}`;

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;

if (!redis && process.env.NODE_ENV === "production") {
  console.warn("[store] Redis non configurato: i messaggi stanno solo in memoria e si perdono al riavvio.");
}

// Fallback in memoria per lo sviluppo in locale (sopravvive all'hot reload).
type Mem = { rev: number; lists: Inbox; read: ReadAt };
const mem = ((globalThis as { __chatMem?: Mem }).__chatMem ??= {
  rev: 0,
  lists: Object.fromEntries(BOT_IDS.map((id) => [id, []])) as unknown as Inbox,
  read: {},
});

export async function addMessage(msg: Message): Promise<void> {
  if (redis) {
    const p = redis.pipeline();
    p.rpush(listKey(msg.bot), msg);
    p.ltrim(listKey(msg.bot), -KEEP, -1);
    p.incr(REV_KEY);
    await p.exec();
    return;
  }
  const list = mem.lists[msg.bot];
  list.push(msg);
  if (list.length > KEEP) list.splice(0, list.length - KEEP);
  mem.rev++;
}

/** Numero che cambia a ogni modifica: il client lo usa per capire se deve riscaricare. */
export async function getRev(): Promise<number> {
  if (redis) return Number((await redis.get<number>(REV_KEY)) ?? 0);
  return mem.rev;
}

/** Tutti i messaggi + quando l'agent ha letto la bacheca l'ultima volta (per ogni bot). */
export async function getSnapshot(): Promise<{ inbox: Inbox; read: ReadAt }> {
  if (redis) {
    const p = redis.pipeline();
    for (const id of BOT_IDS) p.lrange<Message>(listKey(id), 0, -1);
    p.hgetall<Record<string, number>>(READ_KEY);
    const res = await p.exec<unknown[]>();
    const inbox = Object.fromEntries(BOT_IDS.map((id, i) => [id, (res[i] as Message[]) ?? []])) as Inbox;
    const rawRead = (res[BOT_IDS.length] as Record<string, number> | null) ?? {};
    const read: ReadAt = {};
    for (const id of BOT_IDS) if (rawRead[id]) read[id] = Number(rawRead[id]);
    return { inbox, read };
  }
  return structuredClone({ inbox: mem.lists, read: mem.read });
}

/** Segna che l'agent ha letto i messaggi di questi bot all'istante `at`. */
export async function markRead(bots: BotId[], at: number): Promise<void> {
  if (!bots.length) return;
  if (redis) {
    const p = redis.pipeline();
    p.hset(READ_KEY, Object.fromEntries(bots.map((b) => [b, at])));
    p.incr(REV_KEY);
    await p.exec();
    return;
  }
  for (const b of bots) mem.read[b] = at;
  mem.rev++;
}
