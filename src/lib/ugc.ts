// UGC Factory: tipi, fasi e ruoli condivisi da browser, server e agent.
//
// La factory è una catena di montaggio per video pubblicitari UGC:
//   Brief (prodotto + target + problema + prove) → Ricerca (ad dei competitor, frasi vere dei clienti)
//   → Concept (angolo + format + hook + storia) → Gate del critico → Script (scene) → Produzione
//   → Revisione video → Pronto (decide Branko) → In test (numeri veri) → Vincente / Scartato
// Ogni passo lascia traccia qui, così il lavoro è ripetibile e la factory impara dai risultati
// (il Playbook), non dalla memoria di un singolo bot.

export type Doc = { id: string; createdAt: number; updatedAt: number };

/* ------------------------------------------------------------------ */
/* Ruoli della squadra                                                 */
/* ------------------------------------------------------------------ */

export const ROLES = [
  { id: "stratega", label: "Stratega", does: "Brief, ricerca (ad dei competitor, voce dei clienti) e angoli di vendita." },
  { id: "regista", label: "Regista", does: "Concept (angolo, format, hook, storia) e poi lo script scena per scena." },
  { id: "critico", label: "Critico", does: "Gate prima di produrre (il concept ferma lo scroll?) e revisione del video montato." },
  { id: "producer", label: "Producer", does: "Genera le scene, monta il video, controlla la qualità e lo carica." },
  { id: "analista", label: "Analista", does: "Legge i numeri dei video in test e scrive nel Playbook cosa funziona." },
] as const;
export type RoleId = (typeof ROLES)[number]["id"];
export const ROLE_IDS = ROLES.map((r) => r.id) as [RoleId, ...RoleId[]];

/* ------------------------------------------------------------------ */
/* Fasi della catena                                                   */
/* ------------------------------------------------------------------ */

export const STAGES = [
  { id: "idea", label: "Idea", role: "regista", todo: "Scrivi il concept: angolo, format, 3+ hook, storia (hook → build-up → payoff → CTA) e perché ferma lo scroll." },
  { id: "gate", label: "Da approvare", role: "critico", todo: "Giudica il concept PRIMA che si spenda per produrlo: approvato, da rifare (con correzioni) o scartato." },
  { id: "script", label: "Script", role: "regista", todo: "Scrivi le scene (2–5 s l'una): inquadratura, azione, battuta, testo a schermo. Poi passa a produzione." },
  { id: "produzione", label: "Produzione", role: "producer", todo: "Genera le scene, monta (ritmo, sottotitoli, musica), controlla la qualità e carica il video." },
  { id: "revisione", label: "Revisione video", role: "critico", todo: "Guarda il video montato: qualità tecnica e forza dei primi 3 secondi. Approva, rimanda o scarta." },
  { id: "pronto", label: "Pronto", role: "tu", todo: "Branko guarda il video e decide se metterlo in test." },
  { id: "in_test", label: "In test", role: "analista", todo: "Il video è online: aggiungi i numeri (spesa, hook rate, CTR, ROAS) e capisci cosa funziona." },
  { id: "vincente", label: "Vincente", role: "analista", todo: "Funziona: scrivi nel Playbook perché, e proponi varianti (nuovi hook sullo stesso corpo)." },
  { id: "scartato", label: "Scartato", role: null, todo: "Fermo. Se c'è una lezione, è nel Playbook." },
] as const;
export type StageId = (typeof STAGES)[number]["id"];
export const STAGE_IDS = STAGES.map((s) => s.id) as [StageId, ...StageId[]];
export const stageOf = (id: string) => STAGES.find((s) => s.id === id) ?? STAGES[0];
/** Fasi "vive" (la catena, senza i risultati finali). */
export const ACTIVE_STAGES: StageId[] = ["idea", "gate", "script", "produzione", "revisione", "pronto", "in_test"];

/* ------------------------------------------------------------------ */
/* Documenti                                                           */
/* ------------------------------------------------------------------ */

export type Angle = { id: string; text: string; why?: string };

export type UgcBrief = Doc & {
  title: string;
  /** Prodotto della sezione Dropshipping, se collegato. */
  productId?: string;
  productName: string;
  productUrl?: string;
  /** Chi compra: età, situazione, cosa desidera. */
  target: string;
  /** Il problema o il desiderio da cui parte tutto. */
  problem: string;
  /** Cosa ottiene chi compra. */
  promise?: string;
  /** Prove: numeri, recensioni, dimostrazioni. */
  proof?: string;
  offer?: string;
  /** Dubbi tipici di chi non compra. */
  objections?: string;
  notes?: string;
  angles: Angle[];
  status: "attivo" | "in pausa" | "chiuso";
  by: string;
};

export const RESEARCH_KINDS = ["ad competitor", "voce cliente", "insight", "trend"] as const;
export type ResearchKind = (typeof RESEARCH_KINDS)[number];

export type UgcResearch = Doc & {
  briefId: string;
  kind: ResearchKind;
  text: string;
  url?: string;
  source?: string;
  /** Perché funziona / perché conta. */
  why?: string;
  by: string;
};

export type Hook = { id: string; text: string; type: string; visual?: string; chosen?: boolean };
export type Story = { hook: string; buildup: string; payoff: string; cta: string };
export type Scene = { id: string; sec: number; shot: string; action: string; line?: string; onScreen?: string; notes?: string };

export type UgcConcept = Doc & {
  briefId: string;
  title: string;
  stage: StageId;
  angle: string;
  /** Id di un format della libreria (src/lib/ugc-library.ts). */
  format: string;
  /** La tesi: perché qualcuno dovrebbe fermarsi a guardarlo. */
  why?: string;
  /** Chi appare / parla. */
  character?: string;
  durationSec?: number;
  hooks: Hook[];
  story: Story;
  scenes: Scene[];
  /** Agent che ci sta lavorando adesso. */
  owner?: string;
  by: string;
};

export const VERDICTS = ["approvato", "da rifare", "scartato"] as const;
export type Verdict = (typeof VERDICTS)[number];

export type UgcReview = Doc & {
  conceptId: string;
  videoId?: string;
  stage: "gate" | "revisione";
  verdict: Verdict;
  /** 1–10. */
  score: number;
  /** Fermerebbe lo scroll? */
  scrollStop: boolean;
  good?: string;
  fix: string[];
  by: string;
};

export const VIDEO_STATUS = ["bozza", "in revisione", "approvato", "pubblicato", "scartato"] as const;
export type VideoStatus = (typeof VIDEO_STATUS)[number];

export const QA_CHECKS = [
  { id: "mani", label: "Mani e corpo naturali" },
  { id: "prodotto", label: "Prodotto fedele (forma, logo, colori)" },
  { id: "labiale", label: "Labiale e voce a tempo" },
  { id: "testo", label: "Testi a schermo leggibili e giusti" },
  { id: "audio", label: "Audio pulito, musica non copre la voce" },
  { id: "ritmo", label: "Ritmo: nessun punto morto" },
  { id: "etichetta", label: "Etichetta AI pronta per TikTok" },
] as const;
export type QaId = (typeof QA_CHECKS)[number]["id"];

export type UgcVideo = Doc & {
  conceptId: string;
  version: number;
  /** Quale hook del concept usa questa versione. */
  hookId?: string;
  media: { url: string; type: "video" | "image" };
  durationSec?: number;
  status: VideoStatus;
  qa: Partial<Record<QaId, boolean>>;
  notes?: string;
  /** Pubblicità collegata nella sezione Dropshipping. */
  adId?: string;
  by: string;
};

export type UgcResult = Doc & {
  videoId: string;
  conceptId: string;
  platform: string;
  /** Giorno a cui si riferiscono i numeri (AAAA-MM-GG). */
  date: string;
  spend?: number;
  impressions?: number;
  /** % di chi guarda i primi 3 secondi. */
  hookRate?: number;
  /** % di chi arriva a metà / fine. */
  holdRate?: number;
  ctr?: number;
  cpc?: number;
  purchases?: number;
  revenue?: number;
  roas?: number;
  notes?: string;
  by: string;
};

export const LEARNING_KINDS = ["hook", "format", "angolo", "produzione", "errore", "regola"] as const;
export type LearningKind = (typeof LEARNING_KINDS)[number];

export type UgcLearning = Doc & {
  kind: LearningKind;
  text: string;
  /** "ipotesi" finché non lo dicono i numeri, poi "provato". */
  strength: "ipotesi" | "provato";
  evidence?: string;
  conceptId?: string;
  videoId?: string;
  pinned?: boolean;
  by: string;
};

/**
 * Domanda di un bot a Branko: rara, solo quando serve davvero (i bot decidono da soli).
 * Compare negli aggiornamenti live. aperta → risposta (Branko ha risposto) → chiusa (il bot l'ha letta).
 */
export type UgcQuestion = Doc & {
  by: string;
  text: string;
  /** Risposte rapide proposte dal bot (Branko può anche scrivere libero). */
  options?: string[];
  conceptId?: string;
  briefId?: string;
  status: "aperta" | "risposta" | "chiusa";
  answer?: string;
  answeredAt?: number;
};

export type UgcSettings = {
  /** Quale bot fa quale ruolo: viene svegliato quando c'è lavoro per lui. */
  roles: Record<RoleId, string | null>;
  autoWake: boolean;
};

export const DEFAULT_UGC_SETTINGS: UgcSettings = {
  roles: { stratega: null, regista: null, critico: null, producer: null, analista: null },
  autoWake: true,
};

export type UgcLogEntry = { at: number; by: string; action: string; title: string; conceptId?: string; briefId?: string };

/** Concept completo, come lo vede la pagina di dettaglio. */
export type ConceptFull = {
  concept: UgcConcept;
  brief: UgcBrief | null;
  reviews: UgcReview[];
  videos: UgcVideo[];
  results: UgcResult[];
  learnings: UgcLearning[];
};

/* ------------------------------------------------------------------ */
/* Calcoli                                                             */
/* ------------------------------------------------------------------ */

/** Somma dei risultati di un video (o di un concept): totali e medie pesate. */
export function summarize(results: UgcResult[]) {
  const sum = (k: keyof UgcResult) => results.reduce((s, r) => s + (typeof r[k] === "number" ? (r[k] as number) : 0), 0);
  const spend = sum("spend");
  const revenue = sum("revenue");
  const impressions = sum("impressions");
  const purchases = sum("purchases");
  // Hook rate e CTR: media pesata sulle impression quando ci sono, altrimenti media semplice.
  const avg = (k: "hookRate" | "holdRate" | "ctr") => {
    const rows = results.filter((r) => typeof r[k] === "number");
    if (!rows.length) return undefined;
    const w = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
    return w ? rows.reduce((s, r) => s + (r[k] as number) * (r.impressions ?? 0), 0) / w : rows.reduce((s, r) => s + (r[k] as number), 0) / rows.length;
  };
  const roasRows = results.filter((r) => typeof r.roas === "number");
  return {
    spend: spend || undefined,
    revenue: revenue || undefined,
    impressions: impressions || undefined,
    purchases: purchases || undefined,
    hookRate: avg("hookRate"),
    holdRate: avg("holdRate"),
    ctr: avg("ctr"),
    roas: spend && revenue ? revenue / spend : roasRows.length ? roasRows.reduce((s, r) => s + r.roas!, 0) / roasRows.length : undefined,
    days: results.length,
  };
}

export const totalSeconds = (scenes: Scene[]) => scenes.reduce((s, x) => s + (x.sec || 0), 0);
