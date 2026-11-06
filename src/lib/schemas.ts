import { z } from "zod";

// Messaggi di errore in italiano (li leggono sia tu che gli agent).
z.config(z.locales.it());

// Schemi condivisi (server e client): cosa si può salvare in ogni sezione dell'hub.

type Doc = { id: string; createdAt: number; updatedAt: number };

const text = (max: number) => z.string().trim().max(max);
const optText = (max: number) => text(max).optional().transform((v) => v || undefined);
const money = z.number().min(0).max(1e9).optional();

export const mediaRef = z.object({
  id: z.string().min(1).max(120),
  url: z.string().min(1).max(2000),
  type: z.enum(["image", "video"]),
});
export type MediaRef = z.infer<typeof mediaRef>;

/* ---------- Progetti e checkpoint ---------- */

export const PROJECT_STATUS = ["attivo", "in pausa", "idea", "completato"] as const;

export const projectInput = z.object({
  name: text(80).min(1),
  emoji: optText(8),
  status: z.enum(PROJECT_STATUS).default("attivo"),
  area: optText(40),
  description: optText(2000),
  links: z.array(z.object({ label: text(60).min(1), url: z.url() })).max(20).default([]),
});
export type Project = z.infer<typeof projectInput> & Doc;

export const LEARNING_KINDS = ["errore", "esperienza", "ricerca", "correzione"] as const;
export type LearningKind = (typeof LEARNING_KINDS)[number];

export const learning = z.object({ kind: z.enum(LEARNING_KINDS), text: text(1000).min(1) });

/** Un checkpoint = "a che punto siamo" + cosa abbiamo imparato. Lo scrivi tu o un agent. */
export const checkpointInput = z.object({
  projectId: z.string().min(1),
  summary: text(4000).min(1),
  progress: z.number().int().min(0).max(100).optional(),
  next: z.array(text(300).min(1)).max(20).default([]),
  learnings: z.array(learning).max(30).default([]),
  author: text(40).min(1).default("tu"),
});
export type Checkpoint = z.infer<typeof checkpointInput> & Doc;

/* ---------- Dropshipping ---------- */

export const PRODUCT_STATUS = ["idea", "in test", "vincente", "scartato"] as const;

export const productInput = z.object({
  name: text(120).min(1),
  status: z.enum(PRODUCT_STATUS).default("idea"),
  cost: money,
  price: money,
  supplierUrl: z.url().optional().or(z.literal("").transform(() => undefined)),
  storeUrl: z.url().optional().or(z.literal("").transform(() => undefined)),
  notes: optText(4000),
  media: z.array(mediaRef).max(50).default([]),
});
export type Product = z.infer<typeof productInput> & Doc;

export const AD_PLATFORMS = ["TikTok", "Meta", "Google", "Pinterest", "Snapchat", "Altro"] as const;
export const AD_STATUS = ["bozza", "attiva", "in pausa", "finita"] as const;

export const adInput = z.object({
  name: text(120).min(1),
  productId: z.string().max(60).optional().transform((v) => v || undefined),
  platform: z.enum(AD_PLATFORMS).default("TikTok"),
  status: z.enum(AD_STATUS).default("bozza"),
  budget: money,
  spend: money,
  revenue: money,
  clicks: z.number().int().min(0).optional(),
  purchases: z.number().int().min(0).optional(),
  notes: optText(4000),
  media: z.array(mediaRef).max(20).default([]),
});
export type Ad = z.infer<typeof adInput> & Doc;

/* ---------- Annunci importanti (casella per te) ---------- */

export const ALERT_LEVELS = ["importante", "urgente"] as const;

export const alertInput = z.object({
  title: text(120).min(1),
  body: optText(2000),
  level: z.enum(ALERT_LEVELS),
  source: text(40).min(1),
  link: optText(500),
  dedupeKey: optText(120),
});
export type Alert = z.infer<typeof alertInput> & Doc & { readAt?: number; archivedAt?: number; repeats?: number };

/* ---------- Media caricati da te ---------- */

export type Upload = Doc & { url: string; type: "image" | "video"; name?: string };

/* ---------- Media unificati (bot + upload) ---------- */

export type MediaItem = {
  id: string;
  url: string;
  type: "image" | "video";
  source: string; // id del bot oppure "tu"
  sourceName: string;
  caption?: string;
  createdAt: number;
};
