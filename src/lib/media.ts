import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStore } from "@netlify/blobs";
import type { Media } from "./bots";

// Dove finiscono i file caricati (dai bot o da te):
// - MEDIA_DIR impostata (server proprio, es. la VM): sul disco, un file per media + il suo tipo accanto;
// - su Netlify: Netlify Blobs;
// - in locale senza niente: in memoria (si perdono al riavvio).
const MB = 1024 * 1024;
export const MAX_UPLOAD = (Number(process.env.MAX_UPLOAD_MB) || 20) * MB;

// Solo foto e video "veri": niente SVG/HTML, che servite dal nostro dominio potrebbero eseguire script.
const ALLOWED = /^(image\/(jpeg|png|gif|webp|avif|heic|heif)|video\/(mp4|webm|quicktime|ogg|x-m4v))$/;
const ID = /^[0-9a-f-]{36}$/i;

type Stored = { data: ArrayBuffer; mime: string };
const mem = ((globalThis as { __mediaMem?: Map<string, Stored> }).__mediaMem ??= new Map());

const mediaDir = () => process.env.MEDIA_DIR?.trim() || null;

function blobs() {
  if (!process.env.NETLIFY && !process.env.NETLIFY_BLOBS_CONTEXT) return null;
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
  const dir = mediaDir();
  if (dir) {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, id), Buffer.from(data));
    await writeFile(path.join(dir, `${id}.json`), JSON.stringify({ mime }));
  } else {
    const store = blobs();
    if (store) await store.set(id, data, { metadata: { mime } });
    else mem.set(id, { data, mime });
  }
  return { url: `/api/media/${id}`, type: kindOf(mime) };
}

export async function readMedia(id: string): Promise<Stored | null> {
  if (!ID.test(id)) return null;
  const dir = mediaDir();
  if (dir) {
    try {
      const [buf, meta] = await Promise.all([readFile(path.join(dir, id)), readFile(path.join(dir, `${id}.json`), "utf8")]);
      const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      return { data, mime: String(JSON.parse(meta).mime ?? "application/octet-stream") };
    } catch {
      return null;
    }
  }
  const store = blobs();
  if (!store) return mem.get(id) ?? null;
  const entry = await store.getWithMetadata(id, { type: "arrayBuffer" });
  if (!entry) return null;
  return { data: entry.data, mime: String(entry.metadata?.mime ?? "application/octet-stream") };
}

/* ------------------------------------------------------------------ */
/* Media mandati dagli agent (bacheca, UGC Factory)                    */
/* ------------------------------------------------------------------ */

export const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i;

/** Input sbagliato dell'agent: il messaggio va restituito così com'è con un 400. */
export class MediaInputError extends Error {}

/** Un elemento media può essere: un link, { url, type? }, oppure { data: base64, mime }. */
export async function toMedia(item: unknown): Promise<Media> {
  if (typeof item === "string") {
    if (item.startsWith("data:")) return fromBase64(item);
    return fromUrl(item);
  }
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    if (typeof o.url === "string") return fromUrl(o.url, o.type);
    if (typeof o.data === "string") return fromBase64(o.data, o.mime ?? o.type);
  }
  throw new MediaInputError("Elemento media non valido: usa un link, { url } oppure { data, mime }");
}

export function fromUrl(url: string, type?: unknown): Media {
  if (!/^https?:\/\//i.test(url)) throw new MediaInputError(`Link non valido: ${url.slice(0, 80)}`);
  const kind = type === "video" || type === "image" ? type : VIDEO_EXT.test(url) ? "video" : "image";
  return { url, type: kind };
}

export async function fromBase64(input: string, mimeHint?: unknown): Promise<Media> {
  const match = /^data:([^;,]+);base64,([\s\S]*)$/.exec(input);
  const mime = (match?.[1] ?? (typeof mimeHint === "string" ? mimeHint : "")).toLowerCase();
  const bytes = Buffer.from(match ? match[2] : input, "base64");
  return storeFile(new Uint8Array(bytes).buffer, mime);
}

/** Controlla formato e dimensione, poi salva. */
export async function storeFile(data: ArrayBuffer, mime: string): Promise<Media> {
  if (!isAllowedMime(mime)) throw new MediaInputError(`Formato non supportato: ${mime || "sconosciuto"} (solo foto e video)`);
  if (data.byteLength > MAX_UPLOAD) throw new MediaInputError("File troppo grande: per i video pesanti manda un link");
  if (!data.byteLength) throw new MediaInputError("File vuoto");
  return saveMedia(data, mime);
}
