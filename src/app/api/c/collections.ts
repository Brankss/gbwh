import "server-only";
import { get } from "@/lib/db";
import { adInput, checkpointInput, productInput, projectInput } from "@/lib/schemas";
import { zodMessage } from "@/lib/agent-auth";

// Le sezioni dell'hub gestite dalla route generica /api/c/<sezione>.
export const COLLECTIONS = {
  projects: { name: "projects", input: projectInput },
  checkpoints: { name: "checkpoints", input: checkpointInput },
  products: { name: "products", input: productInput },
  ads: { name: "ads", input: adInput },
  alerts: { name: "alerts", input: null },
} as const;

export type CollectionName = keyof typeof COLLECTIONS;

export function isCollection(v: string): v is CollectionName {
  return Object.hasOwn(COLLECTIONS, v);
}

type Validated = { ok: true; data: Record<string, unknown> } | { ok: false; error: string };

/** Valida i dati e controlla i collegamenti (il progetto o il prodotto devono esistere). */
export async function validate(col: Exclude<CollectionName, "alerts">, body: unknown): Promise<Validated> {
  const parsed = COLLECTIONS[col].input.safeParse(body);
  if (!parsed.success) return { ok: false, error: zodMessage(parsed.error) };
  const data = parsed.data as Record<string, unknown>;

  if (col === "checkpoints" && !(await get("projects", String(data.projectId)))) {
    return { ok: false, error: "projectId: progetto inesistente" };
  }
  if (col === "ads" && data.productId && !(await get("products", String(data.productId)))) {
    return { ok: false, error: "productId: prodotto inesistente" };
  }
  return { ok: true, data };
}
