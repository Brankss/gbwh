import "server-only";
import { redis } from "./redis";
import {
  guessOpen,
  normalizeOrg,
  sortBenchmarks,
  type ModelCategory,
  type ModelEntry,
  type ModelKind,
  type ModelsData,
} from "./models";

const KEY = "models:data";
const mem = globalThis as { __models?: ModelsData };

export async function getModelsData(): Promise<ModelsData | null> {
  if (redis) return (await redis.get<ModelsData>(KEY)) ?? null;
  return mem.__models ?? null;
}

async function saveModelsData(data: ModelsData) {
  if (redis) await redis.set(KEY, data);
  else mem.__models = data;
}

/* ------------------------------------------------------------------ */
/* Artificial Analysis (https://artificialanalysis.ai) — API gratuita  */
/* con chiave. Il parser è tollerante: prende ogni campo numerico      */
/* delle valutazioni, così nuovi benchmark compaiono da soli.         */
/* ------------------------------------------------------------------ */

const AA = "https://artificialanalysis.ai/api/v2/data";
type Raw = Record<string, unknown>;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});

function baseEntry(item: Raw): Omit<ModelEntry, "scores"> | null {
  const name = str(item.name) ?? str(item.model_name);
  if (!name) return null;
  const creator = obj(item.model_creator);
  const org = normalizeOrg(str(creator.name) ?? str(item.creator) ?? str(item.organization) ?? "—");
  const declared =
    typeof item.is_open_weights === "boolean" ? item.is_open_weights : typeof item.open_weights === "boolean" ? item.open_weights : undefined;
  const guessed = declared === undefined ? guessOpen(name, org) : undefined;
  return {
    id: str(item.slug) ?? str(item.id) ?? name,
    name,
    org,
    open: declared ?? guessed,
    openGuessed: declared === undefined && guessed !== undefined ? true : undefined,
    released: str(item.release_date),
  };
}

/** Le percentuali arrivano come 0–1: le portiamo a 0–100 per leggerle meglio. */
function scaleScores(models: ModelEntry[]) {
  const keys = new Set(models.flatMap((m) => Object.keys(m.scores)));
  for (const key of keys) {
    if (key.startsWith("artificial_analysis_") || ["elo", "output_speed", "price_blended"].includes(key)) continue;
    const values = models.map((m) => m.scores[key]).filter((v): v is number => v !== undefined);
    if (values.length && values.every((v) => v >= 0 && v <= 1)) {
      for (const m of models) if (m.scores[key] !== undefined) m.scores[key] = m.scores[key] * 100;
    }
  }
}

export function parseLlms(json: unknown): ModelCategory {
  const items = (obj(json).data as Raw[] | undefined) ?? (Array.isArray(json) ? (json as Raw[]) : []);
  const models: ModelEntry[] = [];
  for (const item of items) {
    const base = baseEntry(item);
    if (!base) continue;
    const scores: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj(item.evaluations))) {
      const n = num(v);
      if (n !== undefined) scores[k] = n;
    }
    const speed = num(item.median_output_tokens_per_second);
    if (speed) scores.output_speed = speed;
    const price = num(obj(item.pricing).price_1m_blended_3_to_1);
    if (price !== undefined && price > 0) scores.price_blended = price;
    if (Object.keys(scores).length) models.push({ ...base, scores });
  }
  scaleScores(models);
  return { benchmarks: sortBenchmarks(models.flatMap((m) => Object.keys(m.scores))), models };
}

export function parseMedia(json: unknown): ModelCategory {
  const items = (obj(json).data as Raw[] | undefined) ?? (Array.isArray(json) ? (json as Raw[]) : []);
  const models: ModelEntry[] = [];
  for (const item of items) {
    const base = baseEntry(item);
    const elo = num(item.elo) ?? num(item.elo_score) ?? num(item.rating);
    if (base && elo !== undefined) models.push({ ...base, scores: { elo } });
  }
  return { benchmarks: sortBenchmarks(["elo"]), models };
}

async function aaFetch(path: string, key: string) {
  const res = await fetch(`${AA}${path}`, { headers: { "x-api-key": key }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Artificial Analysis ${path}: HTTP ${res.status}`);
  return res.json();
}

export async function syncFromArtificialAnalysis(): Promise<ModelsData> {
  const key = process.env.AA_API_KEY;
  if (!key) throw new Error("Manca AA_API_KEY: crea una chiave gratuita su artificialanalysis.ai e mettila nelle variabili di Netlify.");
  const [llm, image, video] = await Promise.all([
    aaFetch("/llms/models", key).then(parseLlms),
    aaFetch("/media/text-to-image", key).then(parseMedia),
    aaFetch("/media/text-to-video", key).then(parseMedia),
  ]);
  const data: ModelsData = { updatedAt: Date.now(), source: "Artificial Analysis", llm, image, video };
  await saveModelsData(data);
  return data;
}

/** Un agent (es. Hermes) carica lui una categoria già pronta. */
export async function pushCategory(kind: ModelKind, models: ModelEntry[], source: string): Promise<ModelsData> {
  const empty: ModelCategory = { benchmarks: [], models: [] };
  const current = (await getModelsData()) ?? { updatedAt: 0, source, llm: empty, image: empty, video: empty };
  const normalized = models.map((m) => {
    const org = normalizeOrg(m.org);
    const guessed = m.open === undefined ? guessOpen(m.name, org) : undefined;
    return { ...m, org, open: m.open ?? guessed, openGuessed: m.open === undefined && guessed !== undefined ? true : undefined };
  });
  const data: ModelsData = {
    ...current,
    updatedAt: Date.now(),
    source,
    [kind]: { benchmarks: sortBenchmarks(normalized.flatMap((m) => Object.keys(m.scores))), models: normalized },
  };
  await saveModelsData(data);
  return data;
}
