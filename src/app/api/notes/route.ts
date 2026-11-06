import { after } from "next/server";
import { MAX_TEXT, type BotId, type Note } from "@/lib/bots";
import { deleteNote, getBots, getNote, saveNote } from "@/lib/store";
import { wakeBot } from "@/lib/wake";

// Annunci in bacheca. Solo per te (protetto da password via proxy.ts);
// i bot li leggono da GET /api/board, ognuno solo quelli visibili a lui.

const bad = (error: string, status = 400) => Response.json({ error }, { status });

async function parseVisibleTo(value: unknown): Promise<BotId[] | null> {
  if (!Array.isArray(value)) return null;
  const ids = new Set((await getBots()).map((b) => b.id));
  return [...new Set(value.filter((v): v is BotId => typeof v === "string" && ids.has(v)))];
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return bad("L'annuncio è vuoto");
  if (text.length > MAX_TEXT) return bad("Annuncio troppo lungo");

  const note: Note = {
    id: crypto.randomUUID(),
    text,
    visibleTo: (await parseVisibleTo(body?.visibleTo)) ?? [],
    ts: Date.now(),
  };
  await saveNote(note);
  // Sveglia i bot che possono leggerla.
  after(() => Promise.all(note.visibleTo.map((b) => wakeBot(b, { kind: "nota", text }))));
  return Response.json({ note });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const note = typeof body?.id === "string" ? await getNote(body.id) : null;
  if (!note) return bad("Annuncio non trovato", 404);

  if (body.text !== undefined) {
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return bad("L'annuncio è vuoto");
    if (text.length > MAX_TEXT) return bad("Annuncio troppo lungo");
    note.text = text;
  }
  if (body.visibleTo !== undefined) {
    const visibleTo = await parseVisibleTo(body.visibleTo);
    if (!visibleTo) return bad("visibleTo deve essere una lista di bot");
    note.visibleTo = visibleTo;
  }
  note.updatedAt = Date.now();
  await saveNote(note);
  return Response.json({ note });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !(await getNote(id))) return bad("Annuncio non trovato", 404);
  await deleteNote(id);
  return Response.json({ ok: true });
}
