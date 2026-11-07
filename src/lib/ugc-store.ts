import "server-only";
import { z } from "zod";
import { get, list, put, remove, stamp } from "./db";
import { createAlert } from "./hub";
import { redis } from "./redis";
import { getBots } from "./store";
import {
  ACTIVE_STAGES,
  DEFAULT_UGC_SETTINGS,
  LEARNING_KINDS,
  QA_CHECKS,
  RESEARCH_KINDS,
  ROLE_IDS,
  STAGES,
  STAGE_IDS,
  VERDICTS,
  VIDEO_STATUS,
  stageOf,
  type ConceptFull,
  type RoleId,
  type StageId,
  type UgcBrief,
  type UgcConcept,
  type UgcLearning,
  type UgcLogEntry,
  type UgcResearch,
  type UgcResult,
  type UgcReview,
  type UgcSettings,
  type UgcVideo,
} from "./ugc";
import { FORMATS } from "./ugc-library";
import { wakeWithin } from "./wake";

// UGC Factory lato server: unica porta d'ingresso per te (pagine) e per gli agent (API con token).
// Qui stanno le regole della catena: chi passa a quale fase, chi va svegliato, quando arriva un Annuncio.

export const COL = {
  briefs: "ugc_briefs",
  research: "ugc_research",
  concepts: "ugc_concepts",
  reviews: "ugc_reviews",
  videos: "ugc_videos",
  results: "ugc_results",
  learnings: "ugc_learnings",
} as const;

const SETTINGS_KEY = "ugc:settings";
const LOG_KEY = "ugc:log";
const LOG_KEEP = 300;

type Mem = { settings?: UgcSettings; log: UgcLogEntry[] };
const mem = ((globalThis as { __ugcMem?: Mem }).__ugcMem ??= { log: [] });

type Result<T> = { ok: true; value: T } | { ok: false; error: string; status: number };
const fail = (error: string, status = 400) => ({ ok: false as const, error, status });
const ok = <T,>(value: T) => ({ ok: true as const, value });
const shortId = () => crypto.randomUUID().slice(0, 8);

/* ------------------------------------------------------------------ */
/* Impostazioni (chi fa quale ruolo) e registro                        */
/* ------------------------------------------------------------------ */

export async function getSettings(): Promise<UgcSettings> {
  const saved = redis ? await redis.get<Partial<UgcSettings>>(SETTINGS_KEY) : mem.settings;
  return { ...DEFAULT_UGC_SETTINGS, ...(saved ?? {}), roles: { ...DEFAULT_UGC_SETTINGS.roles, ...(saved?.roles ?? {}) } };
}

export const settingsInput = z
  .object({
    roles: z.record(z.enum(ROLE_IDS), z.string().trim().max(32).nullable()),
    autoWake: z.boolean(),
  })
  .partial();

export async function saveSettings(patch: z.input<typeof settingsInput>): Promise<UgcSettings> {
  const current = await getSettings();
  const next: UgcSettings = { ...current, ...patch, roles: { ...current.roles, ...(patch.roles ?? {}) } as UgcSettings["roles"] };
  if (redis) await redis.set(SETTINGS_KEY, next);
  else mem.settings = next;
  return next;
}

export async function logChange(entry: Omit<UgcLogEntry, "at">) {
  const e = { at: Date.now(), ...entry };
  if (redis) {
    const p = redis.pipeline();
    p.lpush(LOG_KEY, e);
    p.ltrim(LOG_KEY, 0, LOG_KEEP - 1);
    await p.exec();
  } else {
    mem.log.unshift(e);
    mem.log.length = Math.min(mem.log.length, LOG_KEEP);
  }
}

export async function getLog(opts: { since?: number; limit?: number; conceptId?: string } = {}): Promise<UgcLogEntry[]> {
  const all = redis ? ((await redis.lrange<UgcLogEntry>(LOG_KEY, 0, LOG_KEEP - 1)) ?? []) : mem.log;
  return all.filter((e) => (!opts.since || e.at > opts.since) && (!opts.conceptId || e.conceptId === opts.conceptId)).slice(0, opts.limit ?? LOG_KEEP);
}

export async function botName(id: string) {
  if (id === "tu") return "Branko";
  return (await getBots()).find((b) => b.id === id)?.name ?? id;
}

/* ------------------------------------------------------------------ */
/* Input (uguali per te e per gli agent)                               */
/* ------------------------------------------------------------------ */

const t = (max: number) => z.string().trim().max(max);
const opt = (max: number) =>
  t(max)
    .optional()
    .transform((v) => v || undefined);
const num = z.number().finite().min(0).max(1e9).optional();
const pct = z.number().finite().min(0).max(100).optional();

const angleInput = z.object({ id: opt(40), text: t(400).min(1), why: opt(1000) });

export const briefInput = z.object({
  title: t(140).min(1),
  productId: opt(80),
  productName: t(140).min(1),
  productUrl: opt(500),
  target: t(2000).min(1),
  problem: t(2000).min(1),
  promise: opt(2000),
  proof: opt(3000),
  offer: opt(500),
  objections: opt(2000),
  notes: opt(4000),
  angles: z.array(angleInput).max(30).optional(),
  status: z.enum(["attivo", "in pausa", "chiuso"]).optional(),
});
export const briefPatch = briefInput.partial();

export const researchInput = z.object({
  kind: z.enum(RESEARCH_KINDS),
  text: t(3000).min(1),
  url: opt(1000),
  source: opt(120),
  why: opt(2000),
});

const hookInput = z.object({ id: opt(40), text: t(300).min(1), type: t(40).min(1), visual: opt(600), chosen: z.boolean().optional() });
const storyInput = z.object({ hook: t(1500), buildup: t(3000), payoff: t(3000), cta: t(600) }).partial();
const sceneInput = z.object({
  id: opt(40),
  sec: z.number().finite().min(0.5).max(120),
  shot: t(600).min(1),
  action: t(1500).min(1),
  line: opt(1000),
  onScreen: opt(300),
  notes: opt(1000),
});

export const conceptInput = z.object({
  briefId: t(80).min(1),
  title: t(160).min(1),
  angle: t(600).min(1),
  format: t(40).min(1),
  why: opt(2000),
  character: opt(1000),
  durationSec: z.number().finite().min(3).max(180).optional(),
  hooks: z.array(hookInput).max(20).optional(),
  story: storyInput.optional(),
  scenes: z.array(sceneInput).max(40).optional(),
  owner: opt(32),
  stage: z.enum(STAGE_IDS).optional(),
});
export const conceptPatch = conceptInput.omit({ briefId: true }).partial().extend({ note: opt(1000) });

export const reviewInput = z.object({
  verdict: z.enum(VERDICTS),
  score: z.number().int().min(1).max(10),
  scrollStop: z.boolean(),
  good: opt(2000),
  fix: z.array(t(600).min(1)).max(20).optional(),
  videoId: opt(80),
});

const qaInput = z.object(Object.fromEntries(QA_CHECKS.map((c) => [c.id, z.boolean().optional()])) as Record<(typeof QA_CHECKS)[number]["id"], z.ZodOptional<z.ZodBoolean>>);

/** Il media arriva già salvato ({url, type}): la conversione da link/base64/file la fa l'API. */
export const videoInput = z.object({
  media: z.object({ url: t(2000).min(1), type: z.enum(["video", "image"]) }),
  hookId: opt(40),
  durationSec: z.number().finite().min(0).max(600).optional(),
  status: z.enum(VIDEO_STATUS).optional(),
  qa: qaInput.optional(),
  notes: opt(3000),
  adId: opt(80),
});
export const videoPatch = videoInput.omit({ media: true }).partial();

export const resultInput = z.object({
  platform: t(40).min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date: AAAA-MM-GG"),
  spend: num,
  impressions: num,
  hookRate: pct,
  holdRate: pct,
  ctr: pct,
  cpc: num,
  purchases: num,
  revenue: num,
  roas: num,
  notes: opt(2000),
});

export const learningInput = z.object({
  kind: z.enum(LEARNING_KINDS),
  text: t(1500).min(1),
  strength: z.enum(["ipotesi", "provato"]).optional(),
  evidence: opt(2000),
  conceptId: opt(80),
  videoId: opt(80),
  pinned: z.boolean().optional(),
});
export const learningPatch = learningInput.partial();

function strip<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/* ------------------------------------------------------------------ */
/* Brief e ricerca                                                     */
/* ------------------------------------------------------------------ */

export type BriefSummary = UgcBrief & { concepts: number; active: number; research: number; winners: number };

export async function listBriefs(): Promise<BriefSummary[]> {
  const [briefs, concepts, research] = await Promise.all([list<UgcBrief>(COL.briefs), list<UgcConcept>(COL.concepts), list<UgcResearch>(COL.research)]);
  return briefs.map((b) => {
    const mine = concepts.filter((c) => c.briefId === b.id);
    return {
      ...b,
      concepts: mine.length,
      active: mine.filter((c) => ACTIVE_STAGES.includes(c.stage)).length,
      winners: mine.filter((c) => c.stage === "vincente").length,
      research: research.filter((r) => r.briefId === b.id).length,
    };
  });
}

export async function getBriefFull(id: string) {
  const brief = await get<UgcBrief>(COL.briefs, id);
  if (!brief) return null;
  const [research, concepts] = await Promise.all([list<UgcResearch>(COL.research), list<UgcConcept>(COL.concepts)]);
  return { brief, research: research.filter((r) => r.briefId === id), concepts: concepts.filter((c) => c.briefId === id) };
}

const withAngleIds = (angles: z.input<typeof angleInput>[] | undefined) => (angles ?? []).map((a) => ({ ...a, id: a.id ?? shortId() }));

export async function createBrief(input: z.input<typeof briefInput>, by: string): Promise<Result<UgcBrief>> {
  if (input.productId && !(await get("products", input.productId))) return fail("productId: prodotto inesistente");
  const brief = await put<UgcBrief>(COL.briefs, stamp(strip({ ...input, angles: withAngleIds(input.angles), status: input.status ?? "attivo", by })));
  await logChange({ by, action: "nuovo brief", title: brief.title, briefId: brief.id });
  return ok(brief);
}

export async function updateBrief(id: string, patch: z.input<typeof briefPatch>, by: string): Promise<Result<UgcBrief>> {
  const current = await get<UgcBrief>(COL.briefs, id);
  if (!current) return fail("Brief non trovato", 404);
  const brief = await put<UgcBrief>(COL.briefs, strip({ ...current, ...patch, angles: patch.angles ? withAngleIds(patch.angles) : current.angles, updatedAt: Date.now() }));
  await logChange({ by, action: "brief modificato", title: brief.title, briefId: id });
  return ok(brief);
}

export async function deleteBrief(id: string, by: string): Promise<Result<true>> {
  const full = await getBriefFull(id);
  if (!full) return fail("Brief non trovato", 404);
  if (full.concepts.length) return fail("Il brief ha dei concept: mettilo in pausa o chiudilo invece di eliminarlo.", 409);
  await remove(COL.research, full.research.map((r) => r.id));
  await remove(COL.briefs, [id]);
  await logChange({ by, action: "brief eliminato", title: full.brief.title });
  return ok(true);
}

export async function addResearch(briefId: string, input: z.input<typeof researchInput>, by: string): Promise<Result<UgcResearch>> {
  const brief = await get<UgcBrief>(COL.briefs, briefId);
  if (!brief) return fail("Brief non trovato", 404);
  const item = await put<UgcResearch>(COL.research, stamp(strip({ ...input, briefId, by })));
  await logChange({ by, action: `ricerca (${input.kind})`, title: brief.title, briefId });
  return ok(item);
}

export async function deleteResearch(id: string): Promise<Result<true>> {
  if (!(await get(COL.research, id))) return fail("Voce non trovata", 404);
  await remove(COL.research, [id]);
  return ok(true);
}

/* ------------------------------------------------------------------ */
/* Concept e catena                                                    */
/* ------------------------------------------------------------------ */

export async function listConcepts(filter: { briefId?: string; stage?: StageId } = {}) {
  const all = await list<UgcConcept>(COL.concepts);
  return all.filter((c) => (!filter.briefId || c.briefId === filter.briefId) && (!filter.stage || c.stage === filter.stage));
}

export async function getConceptFull(id: string): Promise<ConceptFull | null> {
  const concept = await get<UgcConcept>(COL.concepts, id);
  if (!concept) return null;
  const [brief, reviews, videos, results, learnings] = await Promise.all([
    get<UgcBrief>(COL.briefs, concept.briefId),
    list<UgcReview>(COL.reviews),
    list<UgcVideo>(COL.videos),
    list<UgcResult>(COL.results),
    list<UgcLearning>(COL.learnings),
  ]);
  return {
    concept,
    brief,
    reviews: reviews.filter((r) => r.conceptId === id),
    videos: videos.filter((v) => v.conceptId === id).sort((a, b) => b.version - a.version),
    results: results.filter((r) => r.conceptId === id).sort((a, b) => b.date.localeCompare(a.date)),
    learnings: learnings.filter((l) => l.conceptId === id),
  };
}

const withIds = <T extends { id?: string }>(items: T[] | undefined) => (items ?? []).map((x) => ({ ...x, id: x.id ?? shortId() }));

function normalizeConcept<T extends { hooks?: z.input<typeof hookInput>[]; scenes?: z.input<typeof sceneInput>[] }>(c: T) {
  return { ...c, hooks: c.hooks ? withIds(c.hooks) : undefined, scenes: c.scenes ? withIds(c.scenes) : undefined };
}

const unknownFormat = (f: string) => (FORMATS.some((x) => x.id === f) ? null : `format: "${f}" non esiste. Usa uno di: ${FORMATS.map((x) => x.id).join(", ")}`);

export async function createConcept(input: z.input<typeof conceptInput>, by: string): Promise<Result<UgcConcept>> {
  const brief = await get<UgcBrief>(COL.briefs, input.briefId);
  if (!brief) return fail("briefId: brief inesistente");
  const bad = unknownFormat(input.format);
  if (bad) return fail(bad);
  const n = normalizeConcept(input);
  const concept = await put<UgcConcept>(
    COL.concepts,
    stamp(
      strip({
        ...input,
        hooks: n.hooks ?? [],
        scenes: n.scenes ?? [],
        story: { hook: "", buildup: "", payoff: "", cta: "", ...(input.story ?? {}) },
        stage: input.stage ?? "idea",
        by,
      }),
    ),
  );
  await logChange({ by, action: "nuovo concept", title: concept.title, conceptId: concept.id, briefId: brief.id });
  if (concept.stage !== "idea") await onStage(concept, "idea", by);
  return ok(concept);
}

export async function updateConcept(id: string, patch: Partial<z.input<typeof conceptPatch>>, by: string): Promise<Result<UgcConcept>> {
  const current = await get<UgcConcept>(COL.concepts, id);
  if (!current) return fail("Concept non trovato", 404);
  if (patch.format) {
    const bad = unknownFormat(patch.format);
    if (bad) return fail(bad);
  }
  const { note, ...fields } = patch;
  const n = normalizeConcept(fields);
  const next: UgcConcept = strip({
    ...current,
    ...fields,
    hooks: n.hooks ?? current.hooks,
    scenes: n.scenes ?? current.scenes,
    story: { ...current.story, ...(fields.story ?? {}) },
    updatedAt: Date.now(),
  });
  // Un solo hook "scelto".
  if (patch.hooks && next.hooks.filter((h) => h.chosen).length > 1) {
    let seen = false;
    next.hooks = next.hooks.map((h) => (h.chosen && !seen ? ((seen = true), h) : { ...h, chosen: false }));
  }
  await put(COL.concepts, next);
  const changed = Object.keys(fields).filter((k) => k !== "stage");
  if (changed.length) await logChange({ by, action: `concept modificato (${changed.join(", ")})`, title: next.title, conceptId: id, briefId: next.briefId });
  if (patch.stage && patch.stage !== current.stage) await onStage(next, current.stage, by, note);
  return ok(next);
}

export async function deleteConcept(id: string, by: string): Promise<Result<true>> {
  const full = await getConceptFull(id);
  if (!full) return fail("Concept non trovato", 404);
  await Promise.all([
    remove(COL.reviews, full.reviews.map((r) => r.id)),
    remove(COL.videos, full.videos.map((v) => v.id)),
    remove(COL.results, full.results.map((r) => r.id)),
  ]);
  await remove(COL.concepts, [id]);
  await logChange({ by, action: "concept eliminato", title: full.concept.title, briefId: full.concept.briefId });
  return ok(true);
}

/** Cambia fase (anche da parte tua, es. "Pronto" → "In test"). */
export async function setStage(id: string, stage: StageId, by: string, note?: string): Promise<Result<UgcConcept>> {
  return updateConcept(id, { stage, note }, by);
}

/**
 * Effetti di un cambio di fase: registro, sveglia del bot che ha il ruolo di quella fase,
 * Annuncio a Branko quando un video è pronto o diventa vincente.
 */
async function onStage(concept: UgcConcept, from: StageId, by: string, note?: string) {
  const to = stageOf(concept.stage);
  await logChange({ by, action: `${stageOf(from).label} → ${to.label}${note ? ` (${note})` : ""}`, title: concept.title, conceptId: concept.id, briefId: concept.briefId });

  if (concept.stage === "pronto") {
    await createAlert({
      source: "UGC Factory",
      level: "importante",
      title: `Video pronto: ${concept.title}`.slice(0, 120),
      body: "Il critico l'ha approvato. Guardalo e decidi se metterlo in test.",
      link: `/ugc/${concept.id}`,
      dedupeKey: `ugc-pronto-${concept.id}`,
    }).catch(() => {});
  }
  if (concept.stage === "vincente") {
    await createAlert({
      source: "UGC Factory",
      level: "importante",
      title: `Vincente: ${concept.title}`.slice(0, 120),
      body: note ?? "Un video funziona: è il momento di farne varianti e di spingerlo.",
      link: `/ugc/${concept.id}`,
      dedupeKey: `ugc-vincente-${concept.id}`,
    }).catch(() => {});
  }

  const settings = await getSettings();
  const role = to.role as RoleId | "tu" | null;
  if (!settings.autoWake || !role || role === "tu") return;
  const bot = settings.roles[role];
  if (!bot || bot === by) return;
  await wakeWithin(bot, { kind: "ugc", text: `Lavoro per te (${to.label}): «${concept.title}». ${to.todo}${note ? `\nNota: ${note}` : ""}` });
}

/* ------------------------------------------------------------------ */
/* Revisioni del critico                                               */
/* ------------------------------------------------------------------ */

/**
 * Gate (fase "gate"): approvato → script, da rifare → idea, scartato → scartato.
 * Revisione video (fase "revisione"): approvato → pronto, da rifare → produzione, scartato → scartato.
 */
export async function addReview(conceptId: string, input: z.input<typeof reviewInput>, by: string): Promise<Result<{ review: UgcReview; concept: UgcConcept }>> {
  const concept = await get<UgcConcept>(COL.concepts, conceptId);
  if (!concept) return fail("Concept non trovato", 404);
  if (concept.stage !== "gate" && concept.stage !== "revisione") {
    return fail(`Si revisiona solo nelle fasi "Da approvare" (gate) e "Revisione video". Ora è in "${stageOf(concept.stage).label}".`, 409);
  }
  const stage = concept.stage;
  let videoId = input.videoId;
  if (stage === "revisione") {
    const videos = (await list<UgcVideo>(COL.videos)).filter((v) => v.conceptId === conceptId).sort((a, b) => b.version - a.version);
    videoId ??= videos[0]?.id;
    if (!videoId) return fail("Non c'è nessun video da revisionare.", 409);
    const video = videos.find((v) => v.id === videoId);
    if (!video) return fail("videoId: video inesistente per questo concept");
    const status = input.verdict === "approvato" ? "approvato" : input.verdict === "scartato" ? "scartato" : "bozza";
    await put(COL.videos, { ...video, status, updatedAt: Date.now() });
  }
  const review = await put<UgcReview>(COL.reviews, stamp(strip({ ...input, fix: input.fix ?? [], videoId, conceptId, stage, by })));
  const next: StageId =
    input.verdict === "scartato" ? "scartato" : stage === "gate" ? (input.verdict === "approvato" ? "script" : "idea") : input.verdict === "approvato" ? "pronto" : "produzione";
  const note = input.verdict === "approvato" ? `voto ${input.score}/10` : input.fix?.length ? `da correggere: ${input.fix.join("; ")}` : `voto ${input.score}/10`;
  const updated = await updateConcept(conceptId, { stage: next, note: note.slice(0, 1000) }, by);
  if (!updated.ok) return updated;
  return ok({ review, concept: updated.value });
}

/* ------------------------------------------------------------------ */
/* Video                                                               */
/* ------------------------------------------------------------------ */

export async function addVideo(conceptId: string, input: z.input<typeof videoInput>, by: string): Promise<Result<{ video: UgcVideo; concept: UgcConcept }>> {
  const concept = await get<UgcConcept>(COL.concepts, conceptId);
  if (!concept) return fail("Concept non trovato", 404);
  const versions = (await list<UgcVideo>(COL.videos)).filter((v) => v.conceptId === conceptId).map((v) => v.version);
  const status = input.status ?? "in revisione";
  const video = await put<UgcVideo>(
    COL.videos,
    stamp(strip({ ...input, qa: input.qa ?? {}, status, version: Math.max(0, ...versions) + 1, conceptId, by })),
  );
  await logChange({ by, action: `video v${video.version} caricato`, title: concept.title, conceptId, briefId: concept.briefId });
  // Un video "in revisione" caricato in produzione manda il concept dal critico.
  let current = concept;
  if (status === "in revisione" && (concept.stage === "produzione" || concept.stage === "script")) {
    const moved = await updateConcept(conceptId, { stage: "revisione", note: `video v${video.version}` }, by);
    if (moved.ok) current = moved.value;
  }
  return ok({ video, concept: current });
}

export async function updateVideo(id: string, patch: z.input<typeof videoPatch>, by: string): Promise<Result<UgcVideo>> {
  const current = await get<UgcVideo>(COL.videos, id);
  if (!current) return fail("Video non trovato", 404);
  const video = await put<UgcVideo>(COL.videos, strip({ ...current, ...patch, qa: { ...current.qa, ...(patch.qa ?? {}) }, updatedAt: Date.now() }));
  const concept = await get<UgcConcept>(COL.concepts, current.conceptId);
  await logChange({ by, action: `video v${video.version} modificato`, title: concept?.title ?? "video", conceptId: current.conceptId });
  return ok(video);
}

export async function deleteVideo(id: string, by: string): Promise<Result<true>> {
  const video = await get<UgcVideo>(COL.videos, id);
  if (!video) return fail("Video non trovato", 404);
  const results = (await list<UgcResult>(COL.results)).filter((r) => r.videoId === id);
  await remove(COL.results, results.map((r) => r.id));
  await remove(COL.videos, [id]);
  await logChange({ by, action: `video v${video.version} eliminato`, title: "video", conceptId: video.conceptId });
  return ok(true);
}

/* ------------------------------------------------------------------ */
/* Risultati e Playbook                                                */
/* ------------------------------------------------------------------ */

export async function addResult(videoId: string, input: z.input<typeof resultInput>, by: string): Promise<Result<UgcResult>> {
  const video = await get<UgcVideo>(COL.videos, videoId);
  if (!video) return fail("Video non trovato", 404);
  // Stesso video + piattaforma + giorno: aggiorna invece di duplicare.
  const twin = (await list<UgcResult>(COL.results)).find((r) => r.videoId === videoId && r.platform === input.platform && r.date === input.date);
  const roas = input.roas ?? (input.revenue && input.spend ? input.revenue / input.spend : undefined);
  const result = await put<UgcResult>(
    COL.results,
    twin ? strip({ ...twin, ...input, roas, by, updatedAt: Date.now() }) : stamp(strip({ ...input, roas, videoId, conceptId: video.conceptId, by })),
  );
  if (video.status !== "pubblicato") await put(COL.videos, { ...video, status: "pubblicato", updatedAt: Date.now() });
  const concept = await get<UgcConcept>(COL.concepts, video.conceptId);
  await logChange({ by, action: `numeri ${input.platform} ${input.date}`, title: concept?.title ?? "video", conceptId: video.conceptId });
  if (concept && (concept.stage === "pronto" || concept.stage === "revisione")) await updateConcept(concept.id, { stage: "in_test" }, by);
  return ok(result);
}

export async function deleteResult(id: string): Promise<Result<true>> {
  if (!(await get(COL.results, id))) return fail("Risultato non trovato", 404);
  await remove(COL.results, [id]);
  return ok(true);
}

export async function listLearnings() {
  const all = await list<UgcLearning>(COL.learnings);
  // Prima i fissati, poi i provati, poi le ipotesi; dentro, i più recenti.
  const rank = (l: UgcLearning) => (l.pinned ? 0 : l.strength === "provato" ? 1 : 2);
  return all.sort((a, b) => rank(a) - rank(b) || b.createdAt - a.createdAt);
}

export async function addLearning(input: z.input<typeof learningInput>, by: string): Promise<Result<UgcLearning>> {
  const learning = await put<UgcLearning>(COL.learnings, stamp(strip({ ...input, strength: input.strength ?? "ipotesi", by })));
  await logChange({ by, action: `playbook (${input.kind})`, title: input.text.slice(0, 80), conceptId: input.conceptId });
  return ok(learning);
}

export async function updateLearning(id: string, patch: z.input<typeof learningPatch>, by: string): Promise<Result<UgcLearning>> {
  const current = await get<UgcLearning>(COL.learnings, id);
  if (!current) return fail("Voce non trovata", 404);
  const learning = await put<UgcLearning>(COL.learnings, strip({ ...current, ...patch, updatedAt: Date.now() }));
  await logChange({ by, action: "playbook modificato", title: learning.text.slice(0, 80) });
  return ok(learning);
}

export async function deleteLearning(id: string): Promise<Result<true>> {
  if (!(await get(COL.learnings, id))) return fail("Voce non trovata", 404);
  await remove(COL.learnings, [id]);
  return ok(true);
}

/* ------------------------------------------------------------------ */
/* Coda di lavoro per ruolo e panoramica                               */
/* ------------------------------------------------------------------ */

/** Cosa c'è da fare per un ruolo, dal più vecchio (chi aspetta da più tempo prima). */
export async function queue(role: RoleId) {
  const stages = STAGES.filter((s) => s.role === role).map((s) => s.id as StageId);
  const concepts = (await list<UgcConcept>(COL.concepts)).filter((c) => stages.includes(c.stage)).sort((a, b) => a.updatedAt - b.updatedAt);
  const items: { kind: string; id: string; title: string; stage?: StageId; todo: string; since: number }[] = concepts.map((c) => ({
    kind: "concept",
    id: c.id,
    title: c.title,
    stage: c.stage,
    todo: stageOf(c.stage).todo,
    since: c.updatedAt,
  }));
  if (role === "stratega") {
    // Brief attivi senza ricerca o senza angoli.
    for (const b of await listBriefs()) {
      if (b.status !== "attivo") continue;
      if (!b.research) items.push({ kind: "brief", id: b.id, title: b.title, todo: "Fai la ricerca: ad dei competitor e frasi vere dei clienti.", since: b.updatedAt });
      else if (!b.angles.length) items.push({ kind: "brief", id: b.id, title: b.title, todo: "Proponi 3–5 angoli di vendita diversi.", since: b.updatedAt });
      else if (!b.active) items.push({ kind: "brief", id: b.id, title: b.title, todo: "Nessun concept in lavorazione: è ora di farne partire di nuovi (regista).", since: b.updatedAt });
    }
  }
  return items;
}

export async function overview() {
  const [concepts, briefs, videos, learnings, settings, log] = await Promise.all([
    list<UgcConcept>(COL.concepts),
    list<UgcBrief>(COL.briefs),
    list<UgcVideo>(COL.videos),
    list<UgcLearning>(COL.learnings),
    getSettings(),
    getLog({ limit: 40 }),
  ]);
  const byStage = Object.fromEntries(STAGES.map((s) => [s.id, concepts.filter((c) => c.stage === s.id).length])) as Record<StageId, number>;
  return { byStage, briefs: briefs.length, videos: videos.length, learnings: learnings.length, settings, log };
}

/** Tutti i video con concept e numeri riassunti, per la tabella dei risultati. */
export async function videosWithResults() {
  const [videos, results, concepts] = await Promise.all([list<UgcVideo>(COL.videos), list<UgcResult>(COL.results), list<UgcConcept>(COL.concepts)]);
  return videos.map((v) => ({
    video: v,
    concept: concepts.find((c) => c.id === v.conceptId) ?? null,
    results: results.filter((r) => r.videoId === v.id).sort((a, b) => b.date.localeCompare(a.date)),
  }));
}
