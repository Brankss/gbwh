import type { NextRequest } from "next/server";
import { safeEqual } from "@/lib/auth";
import { BOT_IDS, MAX_TEXT, isBotId, type BotId, type Media, type Message } from "@/lib/bots";
import { MAX_UPLOAD, isAllowedMime, saveMedia } from "@/lib/media";
import { addMessage, getSnapshot, markRead } from "@/lib/store";

/**
 * Bacheca pubblica per l'agent. Stesso indirizzo per leggere e per rispondere.
 *
 * Auth: header `Authorization: Bearer <INBOUND_SECRET>` oppure `?token=<INBOUND_SECRET>`.
 *
 * LEGGERE i messaggi nuovi:
 *   GET /api/board?bot=berlu&since=<cursor>
 *   -> { messages: [{ id, bot, from, text, ts, at }], cursor, notes: [{ id, text, at }] }
 *   `notes` sono gli annunci che hai reso visibili a quel bot (arrivano sempre tutti).
 *   Al giro dopo si passa `since=<cursor>` ricevuto. Senza `bot` arrivano tutti e tre.
 *   Di default solo i messaggi scritti da te; con `&all=1` anche le risposte dei bot (utile come contesto).
 *
 * RISPONDERE (testo, foto, video):
 *   POST /api/board?bot=berlu   { "message": "ciao", "media": ["https://.../foto.jpg"] }
 *   - media: link, { url, type: "image"|"video" } oppure { data: <base64>, mime: "image/png" }
 *     (anche i campi image / images / video / videos vanno bene)
 *   - oppure multipart/form-data con campo "message" e uno o più file in "file"
 *   Il testo può stare in message / text / content / reply / caption, o essere testo semplice.
 */

const noStore = { "Cache-Control": "no-store" };

function authError(request: NextRequest): Response | null {
  const secret = process.env.INBOUND_SECRET;
  if (!secret) return Response.json({ error: "INBOUND_SECRET non configurato" }, { status: 503 });
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.nextUrl.searchParams.get("token") ?? "";
  return safeEqual(provided, secret) ? null : Response.json({ error: "Non autorizzato" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const denied = authError(request);
  if (denied) return denied;

  const params = request.nextUrl.searchParams;
  const botParam = params.get("bot")?.toLowerCase();
  if (botParam && !isBotId(botParam)) return Response.json({ error: "Bot sconosciuto" }, { status: 400 });

  const bots: BotId[] = botParam ? [botParam as BotId] : BOT_IDS;
  const since = Number(params.get("since")) || 0;
  const all = params.get("all") === "1";

  // Preso PRIMA di leggere: tutto quello che c'è nello snapshot è più vecchio di così.
  const readAt = Date.now();
  const { inbox, read, notes } = await getSnapshot();

  const messages = bots
    .flatMap((b) => inbox[b])
    .filter((m) => m.ts > since && (all || m.from === "me"))
    .sort((a, b) => a.ts - b.ts)
    .map((m) => ({ ...m, at: new Date(m.ts).toISOString() }));

  // Spunta "letto" in chat: solo per i bot che avevano messaggi tuoi non ancora letti.
  const toMark = bots.filter((b) =>
    messages.some((m) => m.bot === b && m.from === "me" && m.ts > (read[b] ?? 0)),
  );
  await markRead(toMark, readAt);

  const cursor = messages.reduce((max, m) => Math.max(max, m.ts), since);

  // Annunci: sempre tutti quelli visibili a questo bot (sono pochi e possono cambiare).
  const visibleNotes = notes
    .filter((n) => (botParam ? n.visibleTo.includes(botParam as BotId) : n.visibleTo.length > 0))
    .map(({ id, text, ts, updatedAt, visibleTo }) => ({
      id,
      text,
      at: new Date(updatedAt ?? ts).toISOString(),
      ...(botParam ? {} : { visibleTo }),
    }));

  return Response.json({ messages, cursor, notes: visibleNotes }, { headers: noStore });
}

const MAX_MEDIA = 10;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i;

class BadInput extends Error {}

/** Un elemento media può essere: un link, { url, type? }, oppure { data: base64, mime }. */
async function toMedia(item: unknown): Promise<Media> {
  if (typeof item === "string") {
    if (item.startsWith("data:")) return fromBase64(item);
    return fromUrl(item);
  }
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    if (typeof o.url === "string") return fromUrl(o.url, o.type);
    if (typeof o.data === "string") return fromBase64(o.data, o.mime ?? o.type);
  }
  throw new BadInput("Elemento media non valido: usa un link, { url } oppure { data, mime }");
}

function fromUrl(url: string, type?: unknown): Media {
  if (!/^https?:\/\//i.test(url)) throw new BadInput(`Link non valido: ${url.slice(0, 80)}`);
  const kind = type === "video" || type === "image" ? type : VIDEO_EXT.test(url) ? "video" : "image";
  return { url, type: kind };
}

async function fromBase64(input: string, mimeHint?: unknown): Promise<Media> {
  const match = /^data:([^;,]+);base64,([\s\S]*)$/.exec(input);
  const mime = (match?.[1] ?? (typeof mimeHint === "string" ? mimeHint : "")).toLowerCase();
  const bytes = Buffer.from(match ? match[2] : input, "base64");
  return storeFile(new Uint8Array(bytes).buffer, mime);
}

async function storeFile(data: ArrayBuffer, mime: string): Promise<Media> {
  if (!isAllowedMime(mime)) throw new BadInput(`Formato non supportato: ${mime || "sconosciuto"} (solo foto e video)`);
  if (data.byteLength > MAX_UPLOAD) throw new BadInput("File troppo grande: per i video pesanti manda un link");
  if (!data.byteLength) throw new BadInput("File vuoto");
  return saveMedia(data, mime);
}

const asList = (v: unknown) => (v == null ? [] : Array.isArray(v) ? v : [v]);

/** Legge la richiesta dell'agent: JSON, multipart/form-data (file) o testo semplice. */
async function parseReply(request: NextRequest) {
  const type = request.headers.get("content-type") ?? "";

  if (type.includes("multipart/form-data")) {
    const form = await request.formData();
    const field = (k: string) => (typeof form.get(k) === "string" ? (form.get(k) as string) : undefined);
    const files = ["file", "files", "media", "image", "video"].flatMap((k) => form.getAll(k));
    if (files.length > MAX_MEDIA) throw new BadInput(`Massimo ${MAX_MEDIA} allegati per messaggio`);
    const media: Media[] = [];
    for (const f of files) {
      media.push(typeof f === "string" ? await toMedia(f) : await storeFile(await f.arrayBuffer(), f.type.toLowerCase()));
    }
    return { bot: field("bot"), text: field("message") ?? field("text") ?? field("caption") ?? "", media };
  }

  const raw = await request.text();
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    body = parsed && typeof parsed === "object" ? parsed : { message: String(parsed) };
  } catch {
    body = { message: raw };
  }

  const items = [body.media, body.image, body.images, body.video, body.videos].flatMap(asList);
  if (items.length > MAX_MEDIA) throw new BadInput(`Massimo ${MAX_MEDIA} allegati per messaggio`);
  const media: Media[] = [];
  for (const item of items) media.push(await toMedia(item));

  const candidate = body.message ?? body.text ?? body.content ?? body.reply ?? body.caption;
  return { bot: typeof body.bot === "string" ? body.bot : undefined, text: typeof candidate === "string" ? candidate : "", media };
}

export async function POST(request: NextRequest) {
  const denied = authError(request);
  if (denied) return denied;

  // Il bot va controllato prima di salvare eventuali file.
  const queryBot = request.nextUrl.searchParams.get("bot")?.toLowerCase();
  if (queryBot && !isBotId(queryBot)) return Response.json({ error: "Bot sconosciuto" }, { status: 400 });

  let reply: Awaited<ReturnType<typeof parseReply>>;
  try {
    reply = await parseReply(request);
  } catch (err) {
    if (err instanceof BadInput) return Response.json({ error: err.message }, { status: 400 });
    throw err;
  }

  const bot = (queryBot ?? reply.bot ?? "").toLowerCase();
  if (!isBotId(bot)) return Response.json({ error: "Parametro 'bot' mancante o sconosciuto" }, { status: 400 });

  const text = reply.text.trim().slice(0, MAX_TEXT);
  if (!text && !reply.media.length) return Response.json({ error: "Messaggio vuoto: manda testo, foto o video" }, { status: 400 });

  const message: Message = { id: crypto.randomUUID(), bot, from: "bot", text, ts: Date.now() };
  if (reply.media.length) message.media = reply.media;
  await addMessage(message);

  return Response.json({ ok: true, id: message.id, media: message.media ?? [] }, { headers: noStore });
}
