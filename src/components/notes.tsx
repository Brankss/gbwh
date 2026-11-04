"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BOTS, MAX_TEXT, type BotId, type Note } from "@/lib/bots";
import { Avatar, PinIcon, useAutosize } from "./ui";

const ALL: BotId[] = BOTS.map((b) => b.id);
const nameOf = (id: BotId) => BOTS.find((b) => b.id === id)?.name ?? id;
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
      className="gloss relative z-10 space-y-3 rounded-[1.5rem] p-4"
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
      <AudiencePicker value={visibleTo} onChange={setVisibleTo} />
      <div className="flex justify-end">
        <button
          disabled={!text.trim() || busy}
          className="orb rounded-full px-4 py-1.5 text-sm font-medium transition-all enabled:hover:brightness-150 enabled:active:scale-95 disabled:opacity-30"
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
  const [audience, setAudience] = useState<BotId[]>(note.visibleTo);
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutosize(ref, draft, 400);

  const startEdit = () => {
    setDraft(note.text);
    setAudience(note.visibleTo);
    setEditing(true);
  };

  const save = async () => {
    if (!draft.trim()) return;
    if (await api("PATCH", { id: note.id, text: draft, visibleTo: audience })) setEditing(false);
  };

  return (
    <article
      className={`matte relative mb-3 break-inside-avoid space-y-3 rounded-[1.25rem] p-4 animate-pop ${editing ? "z-20" : ""}`}
    >
      {editing ? (
        <>
          <textarea
            ref={ref}
            autoFocus
            value={draft}
            maxLength={MAX_TEXT}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Modifica annuncio"
            className="field block w-full resize-none text-[15px] leading-relaxed"
          />
          <AudiencePicker value={audience} onChange={setAudience} />
        </>
      ) : (
        <>
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{note.text}</p>
          <AudienceView value={note.visibleTo} />
        </>
      )}

      <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
        <span>
          {dateFmt.format(note.updatedAt ?? note.ts)}
          {note.updatedAt ? " · modificato" : ""}
        </span>
        <div className="flex gap-3">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="hover:text-fg">
                Annulla
              </button>
              <button onClick={save} className="font-medium text-fg">
                Salva
              </button>
            </>
          ) : (
            <>
              <button onClick={startEdit} className="hover:text-fg">
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

/** Chi vede l'annuncio, in sola lettura. */
function AudienceView({ value }: { value: BotId[] }) {
  if (!value.length) return <p className="text-[11px] text-muted">🔒 Solo tu</p>;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="text-muted">Visibile a</span>
      {value.map((id) => (
        <span key={id} className="gloss flex items-center gap-1 rounded-full py-0.5 pr-2 pl-0.5">
          <Avatar name={nameOf(id)} size={16} />
          {nameOf(id)}
        </span>
      ))}
    </div>
  );
}

/**
 * Selettore a tendina multiplo: i bot scelti stanno in cima, nel campo, ognuno con la sua ×.
 * Si può scrivere per filtrare; ↑ ↓ per muoversi, Invio per scegliere, ⌫ a campo vuoto toglie l'ultimo.
 */
function AudiencePicker({ value, onChange }: { value: BotId[]; onChange: (v: BotId[]) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const menu = useRef<HTMLDivElement>(null);

  // Se la tendina si apre vicino al fondo dello schermo, scorri quanto basta per vederla tutta.
  useEffect(() => {
    if (open) menu.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open]);

  const options = BOTS.filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase()));
  const toggle = (id: BotId) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
    setQuery("");
  };

  // Clic fuori dal selettore = chiudi.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setCursor((c) => (options.length ? (c + step + options.length) % options.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = options[Math.min(cursor, options.length - 1)];
      if (open && opt) toggle(opt.id);
      else setOpen(true);
    } else if (e.key === "Backspace" && !query && value.length) {
      onChange(value.slice(0, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrap} className="relative">
      <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
        <span>Chi può vederlo</span>
        <span>{value.length ? `${value.length} di ${BOTS.length}` : "nessuno = solo tu"}</span>
      </div>

      <div
        onClick={() => {
          setOpen(true);
          input.current?.focus();
        }}
        className={`field relative flex min-h-11 cursor-text flex-wrap items-center gap-1.5 py-1.5! pr-9! pl-1.5! ${
          open ? "border-[#2e2e2e]! shadow-[0_0_0_4px_var(--ring)]" : ""
        }`}
      >
        {value.map((id) => (
          <span key={id} className="gloss flex items-center gap-1.5 rounded-full py-0.5 pr-1 pl-0.5 text-sm animate-pop">
            <Avatar name={nameOf(id)} size={20} />
            {nameOf(id)}
            <button
              type="button"
              aria-label={`Togli ${nameOf(id)}`}
              onClick={(e) => {
                e.stopPropagation();
                toggle(id);
              }}
              className="grid size-5 place-items-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-fg"
            >
              <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label="Cerca bot"
          placeholder={value.length ? "" : "Scegli i bot…"}
          className={`h-7 bg-transparent text-sm outline-none placeholder:text-muted ${
            open || !value.length ? "w-8 min-w-8 flex-1 px-1.5" : "w-0 min-w-0 p-0"
          }`}
        />
        <svg
          viewBox="0 0 24 24"
          className={`pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>

      {open && (
        <div ref={menu} className="matte absolute inset-x-0 top-full z-30 mt-1.5 scroll-mb-6 overflow-hidden rounded-2xl shadow-[0_16px_40px_-12px_rgb(0_0_0/0.9)] animate-pop">
          <div className="flex items-center gap-3 border-b border-line px-3 py-2 text-xs text-muted">
            <button type="button" onClick={() => onChange(ALL)} className="hover:text-fg">
              Tutti
            </button>
            <button type="button" onClick={() => onChange([])} className="hover:text-fg">
              Nessuno
            </button>
            <button type="button" onClick={() => setOpen(false)} className="gloss ml-auto rounded-full px-3 py-1 font-medium">
              Fatto
            </button>
          </div>
          <ul id={listId} role="listbox" aria-multiselectable className="scroll-thin max-h-64 overflow-y-auto p-1">
            {options.length === 0 && <li className="px-3 py-2 text-sm text-muted">Nessun bot con questo nome</li>}
            {options.map((b, i) => {
              const selected = value.includes(b.id);
              return (
                <li
                  key={b.id}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => {
                    toggle(b.id);
                    input.current?.focus();
                  }}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors ${
                    i === cursor ? "bg-white/6" : ""
                  }`}
                >
                  <Avatar name={b.name} size={26} />
                  <span className={`flex-1 ${selected ? "font-medium" : "text-muted"}`}>{b.name}</span>
                  <span
                    className={`grid size-5 place-items-center rounded-full transition-all ${
                      selected ? "bg-white text-black" : "border border-line"
                    }`}
                  >
                    {selected && (
                      <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
