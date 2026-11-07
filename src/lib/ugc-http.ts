import "server-only";
import type { z } from "zod";
import { zodMessage } from "./agent-auth";

// Piccoli aiuti condivisi dalle route della UGC Factory (tue e degli agent).

type Result<T> = { ok: true; value: T } | { ok: false; error: string; status: number };

export const noStore = { "Cache-Control": "no-store" };

/** Risultato dello storage → risposta HTTP. */
export function reply<T>(r: Result<T>, wrap: (v: T) => unknown = (v) => v) {
  return r.ok ? Response.json(wrap(r.value), { headers: noStore }) : Response.json({ error: r.error }, { status: r.status });
}

/** Valida il body con lo schema: dati, oppure la risposta d'errore pronta. */
export async function body<S extends z.ZodType>(request: Request, schema: S): Promise<{ data: z.infer<S> } | { error: Response }> {
  const raw = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  return parsed.success ? { data: parsed.data } : { error: Response.json({ error: zodMessage(parsed.error) }, { status: 400 }) };
}

export const notFound = (what: string) => Response.json({ error: `${what} non trovato` }, { status: 404 });
