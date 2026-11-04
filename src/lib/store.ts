import "server-only";
import { Redis } from "@upstash/redis";
import { BOT_IDS, type BotId, type Inbox, type Message } from "./bots";

// Ultimi N messaggi tenuti per ogni chat.
const KEEP = 300;
const REV_KEY = "chat:rev";
const listKey = (bot: BotId) => `chat:${bot}`;

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;

if (!redis && process.env.NODE_ENV === "production") {
  console.warn("[store] Redis non configurato: i messaggi stanno solo in memoria e si perdono al riavvio.");
}

// Fallback in memoria per lo sviluppo in locale (sopravvive all'hot reload).
const mem = ((globalThis as { __chatMem?: { rev: number; lists: Inbox } }).__chatMem ??= {
  rev: 0,
  lists: Object.fromEntries(BOT_IDS.map((id) => [id, []])) as unknown as Inbox,
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

/** Numero che cambia a ogni nuovo messaggio: il client lo usa per capire se deve riscaricare. */
export async function getRev(): Promise<number> {
  if (redis) return Number((await redis.get<number>(REV_KEY)) ?? 0);
  return mem.rev;
}

export async function getInbox(): Promise<Inbox> {
  if (redis) {
    const p = redis.pipeline();
    for (const id of BOT_IDS) p.lrange<Message>(listKey(id), 0, -1);
    const lists = await p.exec<Message[][]>();
    return Object.fromEntries(BOT_IDS.map((id, i) => [id, lists[i] ?? []])) as Inbox;
  }
  return structuredClone(mem.lists);
}
