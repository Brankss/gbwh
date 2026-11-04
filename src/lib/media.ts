import "server-only";
import { getStore } from "@netlify/blobs";
import type { Media } from "./bots";

// I file caricati dall'agent finiscono su Netlify Blobs; in locale (fuori da Netlify) in memoria.
export const MAX_UPLOAD = 20 * 1024 * 1024;

// Solo foto e video "veri": niente SVG/HTML, che servite dal nostro dominio potrebbero eseguire script.
const ALLOWED = /^(image\/(jpeg|png|gif|webp|avif|heic|heif)|video\/(mp4|webm|quicktime|ogg|x-m4v))$/;

type Stored = { data: ArrayBuffer; mime: string };
const mem = ((globalThis as { __mediaMem?: Map<string, Stored> }).__mediaMem ??= new Map());

function blobs() {
  try {
    return getStore({ name: "media", consistency: "strong" });
  } catch {
    return null; // Fuori da Netlify: nessun contesto Blobs disponibile.
  }
}

export function kindOf(mime: string): Media["type"] {
  return mime.startsWith("video/") ? "video" : "image";
}

export function isAllowedMime(mime: string) {
  return ALLOWED.test(mime);
}

/** Salva il file e restituisce il Media da mettere nel messaggio. */
export async function saveMedia(data: ArrayBuffer, mime: string): Promise<Media> {
  const id = crypto.randomUUID();
  const store = blobs();
  if (store) await store.set(id, data, { metadata: { mime } });
  else mem.set(id, { data, mime });
  return { url: `/api/media/${id}`, type: kindOf(mime) };
}

export async function readMedia(id: string): Promise<Stored | null> {
  const store = blobs();
  if (!store) return mem.get(id) ?? null;
  const entry = await store.getWithMetadata(id, { type: "arrayBuffer" });
  if (!entry) return null;
  return { data: entry.data, mime: String(entry.metadata?.mime ?? "application/octet-stream") };
}
