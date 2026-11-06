import "server-only";
import { z } from "zod";
import "./schemas"; // errori in italiano
import { redis } from "./redis";

/**
 * "Chi è sveglio": ogni agent manda un segnale di vita (heartbeat) con cosa sta facendo.
 * È online se l'ultimo segnale è più recente di ONLINE_WINDOW.
 */
export const ONLINE_WINDOW = 15 * 60 * 1000;
const KEY = "agents:presence";

export const heartbeatInput = z.object({
  agent: z.string().trim().min(1).max(40),
  name: z.string().trim().max(40).optional(),
  status: z.enum(["attivo", "occupato", "in pausa"]).default("attivo"),
  doing: z.string().trim().max(200).optional(),
  projectId: z.string().max(60).optional(),
});

export type Presence = z.infer<typeof heartbeatInput> & { at: number };
export type PresenceView = Presence & { online: boolean };

const mem = ((globalThis as { __presence?: Record<string, Presence> }).__presence ??= {});

export async function beat(input: z.infer<typeof heartbeatInput>): Promise<Presence> {
  const p: Presence = { ...input, agent: input.agent.toLowerCase(), at: Date.now() };
  if (redis) await redis.hset(KEY, { [p.agent]: p });
  else mem[p.agent] = p;
  return p;
}

export async function listPresence(): Promise<PresenceView[]> {
  const all = redis ? Object.values((await redis.hgetall<Record<string, Presence>>(KEY)) ?? {}) : Object.values(mem);
  const now = Date.now();
  return all
    .map((p) => ({ ...p, online: now - p.at < ONLINE_WINDOW }))
    .sort((a, b) => Number(b.online) - Number(a.online) || b.at - a.at);
}
