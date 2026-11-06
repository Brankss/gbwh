import type { NextRequest } from "next/server";
import { agentAuthError as authError } from "@/lib/agent-auth";
import { MAX_TEXT, toBotId, toBotName, type BotId, type Media, type Message } from "@/lib/bots";
import { MAX_UPLOAD, isAllowedMime, saveMedia } from "@/lib/media";
import { linkMedia } from "@/lib/hub";
import { addMessage, ensureBot, getSnapshot, markRead } from "@/lib/store";

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
 * BOT NUOVI: se ?bot= non esiste ancora, alla prima risposta il bot viene creato da solo,
 *   con il nome passato in "name" (o bot_name / botName / sender, oppure ?name=).
 *
 * COLLEGARE UN MEDIA: aggiungi "product" (id o nome) e/o "ad" (id o nome): il media finisce
 *   anche sulla scheda del prodotto / della pubblicità. Elenco: GET /api/agent/products.
 *
 * RISPONDERE (testo, foto, video):
 *   POST /api/board?bot=berlu   { "message": "ciao", "media": ["https://.../foto.jpg"] }
 *   - media: link, { url, type: "image"|"video" } oppure { data: <base64>, mime: "image/png" }
 *     (anche i campi image / images / video / videos vanno bene)
 *   - oppure multipart/form-data con campo "message" e uno o più file in "file"
 *   Il testo può stare in message / text / content / reply / caption, o essere testo semplice.
 */

const noStore = { "Cache-Control": "no-store" };


export async function GET(request: NextRequest) {
  const denied = authError(request);
  if (denied) return denied;

  const params = request.nextUrl.searchParams;
  // Un bot che non esiste ancora non è un errore: semplicemente non ha messaggi (si crea alla prima risposta).
  const botParam = params.get("bot") ? toBotId(params.get("bot")) : null;
  const since = Number(params.get("since")) || 0;
  const all = params.get("all") === "1";

  // Preso PRIMA di leggere: tutto quello che c'è nello snapshot è più vecchio di così.
  const readAt = Date.now();
  const { bots: allBots, inbox, read, notes } = await getSnapshot();
  const bots: BotId[] = botParam ? [botParam] : allBots.map((b) => b.id);

  const messages = bots
    .flatMap((b) => inbox[b] ?? [])
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
    .filter((n) => (botParam ? n.visibleTo.includes(botParam) : n.visibleTo.length > 0))
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
    return {
      bot: field("bot"),
      name: field("name") ?? field("bot_name") ?? field("botName"),
      text: field("message") ?? field("text") ?? field("caption") ?? "",
      media,
      product: field("product"),
      ad: field("ad"),
    };
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
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  return {
    bot: str(body.bot),
    name: str(body.name) ?? str(body.bot_name) ?? str(body.botName) ?? str(body.sender),
    text: str(candidate) ?? "",
    media,
    product: str(body.product),
    ad: str(body.ad),
  };
}

export async function POST(request: NextRequest) {
  const denied = authError(request);
  if (denied) return denied;

  let reply: Awaited<ReturnType<typeof parseReply>>;
  try {
    reply = await parseReply(request);
  } catch (err) {
    if (err instanceof BadInput) return Response.json({ error: err.message }, { status: 400 });
    throw err;
  }

  // Bot: da ?bot= o dal body; se manca l'id ma c'è il nome, l'id si ricava dal nome.
  const query = request.nextUrl.searchParams;
  const name = toBotName(query.get("name") ?? reply.name);
  const bot = toBotId(query.get("bot") ?? reply.bot) ?? toBotId(name);
  if (!bot) return Response.json({ error: "Manca il bot: passa ?bot=<id> oppure un \"name\"" }, { status: 400 });

  const text = reply.text.trim().slice(0, MAX_TEXT);
  if (!text && !reply.media.length) return Response.json({ error: "Messaggio vuoto: manda testo, foto o video" }, { status: 400 });

  // Bot mai visto prima? Lo creiamo adesso, con il nome che si è dato.
  const known = await ensureBot(bot, name);
  if (!known) return Response.json({ error: "Troppi bot: limite raggiunto" }, { status: 409 });

  const message: Message = { id: crypto.randomUUID(), bot, from: "bot", text, ts: Date.now() };
  if (reply.media.length) message.media = reply.media;
  await addMessage(message);

  // "Questo video è per la lampada": il media finisce anche sulla scheda del prodotto / della pubblicità.
  const productRef = query.get("product") ?? reply.product;
  const adRef = query.get("ad") ?? reply.ad;
  const linked =
    productRef || adRef
      ? await linkMedia(
          { product: productRef ?? undefined, ad: adRef ?? undefined },
          (message.media ?? []).map((m, i) => ({ id: `${message.id}:${i}`, url: m.url, type: m.type })),
        )
      : undefined;

  return Response.json(
    { ok: true, id: message.id, bot: known.bot, created: known.created, media: message.media ?? [], ...(linked && { linked }) },
    { headers: noStore },
  );
}
