import "server-only";
import { redis } from "./redis";

/**
 * Storage a "collezioni" di documenti JSON: un hash Redis per collezione (c:<nome>),
 * un campo per documento. Per un hub personale (centinaia di record) è semplice e veloce;
 * se un giorno i dati crescono davvero si migra a Postgres senza toccare le pagine.
 */

export type Doc = { id: string; createdAt: number; updatedAt: number };

const key = (col: string) => `c:${col}`;
const VERSION_KEY = "c:version";

type Mem = Record<string, Record<string, Doc>>;
const mem = ((globalThis as { __dbMem?: Mem }).__dbMem ??= {});

export async function list<T extends Doc>(col: string): Promise<T[]> {
  const all = redis ? ((await redis.hgetall<Record<string, T>>(key(col))) ?? {}) : ((mem[col] ?? {}) as Record<string, T>);
  return Object.values(all).sort((a, b) => b.createdAt - a.createdAt);
}

export async function get<T extends Doc>(col: string, id: string): Promise<T | null> {
  if (redis) return (await redis.hget<T>(key(col), id)) ?? null;
  return ((mem[col]?.[id] as T) ?? null);
}

export async function put<T extends Doc>(col: string, doc: T): Promise<T> {
  if (redis) {
    const p = redis.pipeline();
    p.hset(key(col), { [doc.id]: doc });
    p.hincrby(VERSION_KEY, col, 1);
    await p.exec();
  } else {
    (mem[col] ??= {})[doc.id] = doc;
  }
  return doc;
}

export async function remove(col: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  if (redis) {
    const p = redis.pipeline();
    p.hdel(key(col), ...ids);
    p.hincrby(VERSION_KEY, col, 1);
    await p.exec();
  } else {
    for (const id of ids) delete mem[col]?.[id];
  }
}

/** Crea un documento nuovo con id e date. */
export function stamp<T extends object>(data: T): T & Doc {
  const now = Date.now();
  return { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
}
