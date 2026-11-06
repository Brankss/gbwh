import "server-only";
import { redis } from "./redis";
import { DEFAULT_BOTS, MAX_BOTS, type Bot, type BotId, type Inbox, type Message, type Note, type ReadAt } from "./bots";

// Ultimi N messaggi tenuti per ogni chat.
const KEEP = 300;
const REV_KEY = "chat:rev";
const READ_KEY = "chat:read";
const NOTES_KEY = "chat:notes";
const BOTS_KEY = "chat:bots";
const listKey = (bot: BotId) => `chat:${bot}`;


// Fallback in memoria per lo sviluppo in locale (sopravvive all'hot reload).
type Mem = { rev: number; lists: Inbox; read: ReadAt; notes: Record<string, Note>; bots: Record<string, Bot> };
const mem = ((globalThis as { __chatMem?: Mem }).__chatMem ??= {
  rev: 0,
  lists: {},
  read: {},
  notes: {},
  bots: {},
});
mem.bots ??= {};

/** Bot di base + quelli creati in automatico (in ordine di arrivo). */
export async function getBots(): Promise<Bot[]> {
  const saved = redis ? ((await redis.hgetall<Record<string, Bot>>(BOTS_KEY)) ?? {}) : mem.bots;
  const extra = Object.values(saved)
    .filter((b) => !DEFAULT_BOTS.some((d) => d.id === b.id))
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  return [...DEFAULT_BOTS, ...extra];
}

/**
 * Restituisce il bot con quell'id; se non esiste lo crea con il nome dato.
 * `null` se si è già al tetto massimo di bot.
 */
export async function ensureBot(id: BotId, name: string | null): Promise<{ bot: Bot; created: boolean } | null> {
  const bots = await getBots();
  const existing = bots.find((b) => b.id === id);
  if (existing) return { bot: existing, created: false };
  if (bots.length >= MAX_BOTS) return null;

  // Senza nome usiamo l'id reso leggibile: "mr-smith" -> "Mr smith".
  const fallback = id.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());
  const bot: Bot = { id, name: name ?? fallback, auto: true, createdAt: Date.now() };
  if (redis) {
    // hsetnx: se due risposte dello stesso bot nuovo arrivano insieme, vince la prima.
    const p = redis.pipeline();
    p.hsetnx(BOTS_KEY, id, bot);
    p.incr(REV_KEY);
    await p.exec();
  } else {
    mem.bots[id] ??= bot;
    mem.rev++;
  }
  return { bot, created: true };
}

export async function addMessage(msg: Message): Promise<void> {
  if (redis) {
    const p = redis.pipeline();
    p.rpush(listKey(msg.bot), msg);
    p.ltrim(listKey(msg.bot), -KEEP, -1);
    p.incr(REV_KEY);
    await p.exec();
    return;
  }
  const list = (mem.lists[msg.bot] ??= []);
  list.push(msg);
  if (list.length > KEEP) list.splice(0, list.length - KEEP);
  mem.rev++;
}

/** Numero che cambia a ogni modifica: il client lo usa per capire se deve riscaricare. */
export async function getRev(): Promise<number> {
  if (redis) return Number((await redis.get<number>(REV_KEY)) ?? 0);
  return mem.rev;
}

export type Snapshot = { bots: Bot[]; inbox: Inbox; read: ReadAt; notes: Note[] };

const newestFirst = (notes: Note[]) => notes.sort((a, b) => b.ts - a.ts);

/** Messaggi, stato "letto" per bot e annunci: tutto in una botta sola. */
export async function getSnapshot(): Promise<Snapshot> {
  const bots = await getBots();
  const ids = bots.map((b) => b.id);
  if (redis) {
    const p = redis.pipeline();
    for (const id of ids) p.lrange<Message>(listKey(id), 0, -1);
    p.hgetall<Record<string, number>>(READ_KEY);
    p.hgetall<Record<string, Note>>(NOTES_KEY);
    const res = await p.exec<unknown[]>();
    const inbox: Inbox = Object.fromEntries(ids.map((id, i) => [id, (res[i] as Message[]) ?? []]));
    const rawRead = (res[ids.length] as Record<string, number> | null) ?? {};
    const read: ReadAt = {};
    for (const id of ids) if (rawRead[id]) read[id] = Number(rawRead[id]);
    const notes = newestFirst(Object.values((res[ids.length + 1] as Record<string, Note> | null) ?? {}));
    return { bots, inbox, read, notes };
  }
  const inbox: Inbox = Object.fromEntries(ids.map((id) => [id, mem.lists[id] ?? []]));
  return structuredClone({ bots, inbox, read: mem.read, notes: newestFirst(Object.values(mem.notes)) });
}

export async function saveNote(note: Note): Promise<void> {
  if (redis) {
    const p = redis.pipeline();
    p.hset(NOTES_KEY, { [note.id]: note });
    p.incr(REV_KEY);
    await p.exec();
    return;
  }
  mem.notes[note.id] = note;
  mem.rev++;
}

export async function getNote(id: string): Promise<Note | null> {
  if (redis) return (await redis.hget<Note>(NOTES_KEY, id)) ?? null;
  return mem.notes[id] ?? null;
}

export async function deleteNote(id: string): Promise<void> {
  if (redis) {
    const p = redis.pipeline();
    p.hdel(NOTES_KEY, id);
    p.incr(REV_KEY);
    await p.exec();
    return;
  }
  delete mem.notes[id];
  mem.rev++;
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

/** Quando l'agent di questo bot ha letto la bacheca l'ultima volta (0 = mai). */
export async function getReadAt(bot: BotId): Promise<number> {
  if (redis) return Number((await redis.hget<number>(READ_KEY, bot)) ?? 0);
  return mem.read[bot] ?? 0;
}
