"use client";

import { useRef, useState } from "react";
import { BOTS, MAX_TEXT, type BotId, type Note } from "@/lib/bots";
import { Avatar, PinIcon, useAutosize } from "./ui";

const ALL: BotId[] = BOTS.map((b) => b.id);
const dateFmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

type Api = (method: "POST" | "PATCH" | "DELETE", body?: object, query?: string) => Promise<Note | null>;

/** Bacheca annunci: note che scegli tu quali bot possono leggere. */
export function Notes({ notes, onChanged }: { notes: Note[] | null; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);

  const api: Api = async (method, body, query = "") => {
    setError(null);
    try {
      const res = await fetch(`/api/notes${query}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Qualcosa è andato storto");
      onChanged();
      return data.note ?? null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore di rete");
      return null;
    }
  };

  return (
    <div className="scroll-thin flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 pb-28 md:px-6">
        <NewNote api={api} />
        {error && <p className="text-sm text-red-500">{error}</p>}

        {notes === null ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-[1.25rem] bg-surface-2" />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center text-muted animate-pop">
            <Avatar name="Annunci" size={56}>
              <PinIcon className="size-6" />
            </Avatar>
            <p>Nessun annuncio. Scrivine uno qui sopra 📌</p>
          </div>
        ) : (
          <div className="columns-1 gap-3 sm:columns-2">
            {notes.map((n) => (
              <NoteCard key={n.id} note={n} api={api} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NewNote({ api }: { api: Api }) {
  const [text, setText] = useState("");
  const [visibleTo, setVisibleTo] = useState<BotId[]>(ALL);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutosize(ref, text, 260);

  const publish = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const note = await api("POST", { text, visibleTo });
    setBusy(false);
    if (note) setText("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        publish();
      }}
      className="gloss space-y-3 rounded-[1.5rem] p-4"
    >
      <textarea
        ref={ref}
        rows={2}
        value={text}
        maxLength={MAX_TEXT}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            publish();
          }
        }}
        placeholder="Scrivi un annuncio…"
        aria-label="Nuovo annuncio"
        className="scroll-thin block w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-muted"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Audience value={visibleTo} onChange={setVisibleTo} />
        <button
          disabled={!text.trim() || busy}
          className="orb ml-auto rounded-full px-4 py-1.5 text-sm font-medium transition-all enabled:hover:brightness-150 enabled:active:scale-95 disabled:opacity-30"
        >
          {busy ? "Pubblico…" : "Pubblica"}
        </button>
      </div>
    </form>
  );
}

function NoteCard({ note, api }: { note: Note; api: Api }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutosize(ref, draft, 400);

  const save = async () => {
    if (!draft.trim()) return;
    if (await api("PATCH", { id: note.id, text: draft })) setEditing(false);
  };

  return (
    <article className="matte mb-3 break-inside-avoid space-y-3 rounded-[1.25rem] p-4 animate-pop">
      {editing ? (
        <textarea
          ref={ref}
          autoFocus
          value={draft}
          maxLength={MAX_TEXT}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Modifica annuncio"
          className="field block w-full resize-none text-[15px] leading-relaxed"
        />
      ) : (
        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{note.text}</p>
      )}

      <Audience
        small
        value={note.visibleTo}
        onChange={(visibleTo) => api("PATCH", { id: note.id, visibleTo })}
      />

      <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
        <span>
          {dateFmt.format(note.updatedAt ?? note.ts)}
          {note.updatedAt ? " · modificato" : ""}
        </span>
        <div className="flex gap-3">
          {editing ? (
            <>
              <button
                onClick={() => {
                  setDraft(note.text);
                  setEditing(false);
                }}
                className="hover:text-fg"
              >
                Annulla
              </button>
              <button onClick={save} className="font-medium text-fg">
                Salva
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setDraft(note.text);
                  setEditing(true);
                }}
                className="hover:text-fg"
              >
                Modifica
              </button>
              <button
                onClick={() => confirm("Eliminare questo annuncio?") && api("DELETE", undefined, `?id=${note.id}`)}
                className="hover:text-red-400"
              >
                Elimina
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

/** Scelta di chi può vedere l'annuncio: un chip per bot, acceso = lo vede. */
function Audience({ value, onChange, small }: { value: BotId[]; onChange: (v: BotId[]) => void; small?: boolean }) {
  const toggle = (id: BotId) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`mr-0.5 text-muted ${small ? "text-[11px]" : "text-xs"}`}>
        {value.length ? "Visibile a" : "Solo tu"}
      </span>
      {BOTS.map((b) => {
        const on = value.includes(b.id);
        return (
          <button
            key={b.id}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(b.id)}
            className={`flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-0.5 transition-all active:scale-95 ${
              small ? "text-[11px]" : "text-xs"
            } ${on ? "gloss" : "border border-line text-muted opacity-60 hover:opacity-100"}`}
          >
            <Avatar name={b.name} size={small ? 16 : 20} />
            {b.name}
          </button>
        );
      })}
    </div>
  );
}
