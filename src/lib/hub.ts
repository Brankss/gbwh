import "server-only";
import { get, list, put, stamp, type Doc } from "./db";
import type { Ad, Alert, Checkpoint, LearningKind, MediaItem, MediaRef, Product, Project, Upload } from "./schemas";
import { alertInput } from "./schemas";
import { getSnapshot } from "./store";

/* ------------------------------------------------------------------ */
/* Annunci importanti                                                  */
/* ------------------------------------------------------------------ */

/** Quanti annunci può mandare una stessa fonte in 24 ore: la casella deve restare pulita. */
export const ALERTS_PER_SOURCE_PER_DAY = 5;
const DEDUPE_WINDOW = 7 * 24 * 60 * 60 * 1000;

export type AlertResult =
  | { ok: true; alert: Alert; deduped: boolean }
  | { ok: false; status: number; error: string };

/**
 * Crea un annuncio, con due freni anti-rumore:
 * - stesso `dedupeKey` dalla stessa fonte negli ultimi 7 giorni → aggiorna quello, non ne crea un altro;
 * - massimo 5 annunci nuovi per fonte nelle 24 ore.
 */
export async function createAlert(raw: unknown): Promise<AlertResult> {
  const parsed = alertInput.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const input = parsed.data;
  const all = await list<Alert>("alerts");
  const now = Date.now();

  if (input.dedupeKey) {
    const twin = all.find(
      (a) => a.source === input.source && a.dedupeKey === input.dedupeKey && !a.archivedAt && now - a.createdAt < DEDUPE_WINDOW,
    );
    if (twin) {
      const updated: Alert = { ...twin, ...input, updatedAt: now, readAt: undefined, repeats: (twin.repeats ?? 1) + 1 };
      await put("alerts", updated);
      return { ok: true, alert: updated, deduped: true };
    }
  }

  const recent = all.filter((a) => a.source === input.source && now - a.createdAt < 24 * 60 * 60 * 1000).length;
  if (recent >= ALERTS_PER_SOURCE_PER_DAY) {
    return {
      ok: false,
      status: 429,
      error: `Limite raggiunto: ${ALERTS_PER_SOURCE_PER_DAY} annunci al giorno per fonte. Manda solo le cose che contano davvero.`,
    };
  }

  const alert = await put<Alert>("alerts", stamp(input));
  return { ok: true, alert, deduped: false };
}

/* ------------------------------------------------------------------ */
/* Progetti + checkpoint                                               */
/* ------------------------------------------------------------------ */

export type Knowledge = { kind: LearningKind; text: string; author: string; at: number; checkpointId: string };

export type ProjectSummary = Project & { latest: Checkpoint | null; checkpoints: number; knowledge: number };

export async function listProjects(): Promise<ProjectSummary[]> {
  const [projects, checkpoints] = await Promise.all([list<Project>("projects"), list<Checkpoint>("checkpoints")]);
  return projects
    .map((p) => {
      const own = checkpoints.filter((c) => c.projectId === p.id);
      return {
        ...p,
        latest: own[0] ?? null,
        checkpoints: own.length,
        knowledge: own.reduce((n, c) => n + c.learnings.length, 0),
      };
    })
    .sort((a, b) => (b.latest?.createdAt ?? b.updatedAt) - (a.latest?.createdAt ?? a.updatedAt));
}

export async function getProjectFull(id: string) {
  const project = await get<Project>("projects", id);
  if (!project) return null;
  const checkpoints = (await list<Checkpoint>("checkpoints")).filter((c) => c.projectId === id);
  const knowledge: Knowledge[] = checkpoints.flatMap((c) =>
    c.learnings.map((l) => ({ ...l, author: c.author, at: c.createdAt, checkpointId: c.id })),
  );
  return { project, checkpoints, knowledge };
}

/* ------------------------------------------------------------------ */
/* Media: tutto quello che arriva dai bot + i tuoi upload              */
/* ------------------------------------------------------------------ */

export async function listMedia(): Promise<MediaItem[]> {
  const [{ bots, inbox }, uploads] = await Promise.all([getSnapshot(), list<Upload>("uploads")]);
  const nameOf = (id: string) => bots.find((b) => b.id === id)?.name ?? id;

  const fromBots: MediaItem[] = Object.values(inbox).flatMap((messages) =>
    messages.flatMap((m) =>
      (m.media ?? []).map((media, i) => ({
        id: `${m.id}:${i}`,
        url: media.url,
        type: media.type,
        source: m.from === "me" ? "tu" : m.bot,
        sourceName: m.from === "me" ? "Tu" : nameOf(m.bot),
        caption: m.text || undefined,
        createdAt: m.ts,
      })),
    ),
  );
  const mine: MediaItem[] = uploads.map((u) => ({
    id: `upload:${u.id}`,
    url: u.url,
    type: u.type,
    source: "tu",
    sourceName: "Tu",
    caption: u.name,
    createdAt: u.createdAt,
  }));
  return [...fromBots, ...mine].sort((a, b) => b.createdAt - a.createdAt);
}

/* ------------------------------------------------------------------ */
/* Collegamento automatico dei media a prodotti e pubblicità           */
/* ------------------------------------------------------------------ */

type Linkable = Doc & { name: string; media: MediaRef[] };

/** Cerca per id esatto oppure per nome (senza maiuscole/spazi extra). */
function findByRef<T extends Linkable>(items: T[], ref: string) {
  const key = ref.trim().toLowerCase();
  return items.find((i) => i.id === ref) ?? items.find((i) => i.name.trim().toLowerCase() === key) ?? null;
}

export type LinkResult = { product?: { id: string; name: string } | null; ad?: { id: string; name: string } | null };

/**
 * Un bot manda un media dicendo a cosa serve ("product": "Lampada luna", "ad": "<id>"):
 * lo aggiungiamo alla scheda del prodotto e/o della pubblicità, senza doppioni.
 * null = riferimento indicato ma non trovato.
 */
export async function linkMedia(refs: { product?: string; ad?: string }, media: MediaRef[]): Promise<LinkResult> {
  const out: LinkResult = {};
  const attach = async <T extends Linkable>(col: string, ref: string, max: number) => {
    const item = findByRef(await list<T>(col), ref);
    if (!item) return null;
    const merged = [...item.media, ...media.filter((m) => !item.media.some((x) => x.id === m.id))].slice(-max);
    await put(col, { ...item, media: merged, updatedAt: Date.now() });
    return { id: item.id, name: item.name };
  };
  if (refs.product) out.product = media.length ? await attach<Product>("products", refs.product, 50) : null;
  if (refs.ad) out.ad = media.length ? await attach<Ad>("ads", refs.ad, 20) : null;
  return out;
}

/** Elenco compatto per gli agent: così sanno a quale prodotto/pubblicità riferirsi. */
export async function listCatalog() {
  const [products, ads] = await Promise.all([list<Product>("products"), list<Ad>("ads")]);
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    price: p.price,
    media: p.media.length,
    ads: ads.filter((a) => a.productId === p.id).map((a) => ({ id: a.id, name: a.name, status: a.status, platform: a.platform })),
  }));
}
