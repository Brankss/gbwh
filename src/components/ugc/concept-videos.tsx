"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { send } from "@/lib/client";
import { QA_CHECKS, VIDEO_STATUS, type UgcVideo, type VideoStatus } from "@/lib/ugc";
import { ConceptMedia } from "./concept-media";
import { Block, Btn, Chip, ErrorLine, F, Panel, Row, Seg, VIDEO_TONE, agoAt, fieldClass, useAction, type ConceptCtx } from "./concept-ui";

// Video: versioni dalla più nuova, con checklist di qualità, stato e caricamento di una nuova versione.

export function ConceptVideos({ ctx }: { ctx: ConceptCtx }) {
  const { videos } = ctx.data;
  return (
    <Block id="video" title={`Video${videos.length ? ` · ${videos.length}` : ""}`}>
      <Panel>
        <Upload ctx={ctx} empty={videos.length === 0} />
        {videos.map((v) => (
          <Version key={v.id} v={v} ctx={ctx} latest={v.id === videos[0].id} />
        ))}
      </Panel>
    </Block>
  );
}

/* ------------------------------------------------------------------ */
/* Una versione                                                        */
/* ------------------------------------------------------------------ */

function Version({ v, ctx, latest }: { v: UgcVideo; ctx: ConceptCtx; latest: boolean }) {
  const hooks = ctx.data.concept.hooks;
  const done = QA_CHECKS.filter((c) => v.qa[c.id]).length;
  const { error, run } = useAction();
  const url = `/api/ugc/videos/${v.id}`;
  const [notes, setNotes] = useState<string | null>(null);
  // Le versioni vecchie restano chiuse: si apre solo quella che serve.
  const [open, setOpen] = useState(latest);

  const patch = (p: Partial<Pick<UgcVideo, "status" | "hookId" | "notes" | "qa">>) =>
    run(() =>
      ctx.act(
        () => send("PATCH", url, p),
        (d) => ({ ...d, videos: d.videos.map((x) => (x.id === v.id ? { ...x, ...p, qa: { ...x.qa, ...(p.qa ?? {}) } } : x)) }),
      ),
    );

  const del = () => {
    if (!confirm(`Eliminare la versione v${v.version}${ctx.data.results.some((r) => r.videoId === v.id) ? " e i suoi numeri" : ""}?`)) return;
    run(() => ctx.act(() => send("DELETE", url), (d) => ({ ...d, videos: d.videos.filter((x) => x.id !== v.id) })));
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="press flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] md:px-5">
        <span className="relative h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-black shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]">
          {v.media.type === "video" ? (
            <video src={`${v.media.url}#t=0.1`} muted playsInline preload="metadata" className="size-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.media.url} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold tabular-nums">v{v.version}</span>
            <Chip tone={VIDEO_TONE[v.status]}>{v.status}</Chip>
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted">
            {ctx.now ? agoAt(v.createdAt, ctx.now) : ""} · QA {done}/{QA_CHECKS.length}
            {v.notes ? ` · ${v.notes}` : ""}
          </span>
        </span>
        <Icon name="forward" className="size-4 shrink-0 text-muted" />
      </button>
    );
  }

  return (
    <article className="grid gap-4 px-4 py-4 md:grid-cols-[240px_minmax(0,1fr)] md:gap-5 md:px-5">
      <div className="self-start overflow-hidden rounded-2xl bg-black shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]">
        <ConceptMedia media={v.media} className="mx-auto max-h-[50vh] md:max-h-[420px]" />
      </div>

      <div className="min-w-0 space-y-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[17px] font-semibold tabular-nums">v{v.version}</span>
              <Chip tone={VIDEO_TONE[v.status]}>{v.status}</Chip>
              {latest && <span className="text-[11px] text-muted">ultima</span>}
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {ctx.who(v.by)}
              {ctx.now ? ` · ${agoAt(v.createdAt, ctx.now)}` : ""}
              {v.durationSec ? ` · ${v.durationSec} s` : ""}
            </p>
          </div>
          <a href={v.media.url} target="_blank" rel="noreferrer" aria-label="Apri il file" title="Apri il file" className="press grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-white/[0.06] hover:text-fg">
            <Icon name="link" className="size-4" />
          </a>
          <Btn variant="quiet" icon="trash" label={`Elimina v${v.version}`} onClick={del} />
          {!latest && <Btn variant="quiet" icon="close" label="Chiudi" onClick={() => setOpen(false)} />}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Stato">
            <select value={v.status} onChange={(e) => patch({ status: e.target.value as VideoStatus })} className={fieldClass}>
              {VIDEO_STATUS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </F>
          <F label="Hook usato">
            <select value={v.hookId ?? ""} onChange={(e) => patch({ hookId: e.target.value })} className={fieldClass} disabled={!hooks.length}>
              <option value="">{hooks.length ? "Non indicato" : "Nessun hook"}</option>
              {hooks.map((h, i) => (
                <option key={h.id} value={h.id}>
                  {i + 1}. {h.text.length > 48 ? `${h.text.slice(0, 48)}…` : h.text}
                </option>
              ))}
            </select>
          </F>
        </div>

        {notes === null ? (
          <div className="flex items-start gap-2">
            <p className={`min-w-0 flex-1 text-[15px] leading-relaxed whitespace-pre-wrap ${v.notes ? "" : "text-muted italic"}`}>{v.notes || "Nessuna nota"}</p>
            <Btn variant="quiet" onClick={() => setNotes(v.notes ?? "")} className="-my-1.5 -mr-2">
              {v.notes ? "Modifica" : "Aggiungi nota"}
            </Btn>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} aria-label="Note" className={`${fieldClass} resize-y leading-relaxed`} />
            <div className="flex justify-end gap-2">
              <Btn onClick={() => setNotes(null)}>Annulla</Btn>
              <Btn variant="chrome" onClick={async () => (await patch({ notes: notes.trim() })) && setNotes(null)}>
                Salva
              </Btn>
            </div>
          </div>
        )}

        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-xs">
            <span className="font-medium text-[#b4b4b4]">Controllo qualità</span>
            <span className={`tabular-nums ${done === QA_CHECKS.length ? "text-[#4fc79b]" : "text-muted"}`}>
              {done}/{QA_CHECKS.length}
            </span>
          </div>
          <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-2xl border border-white/[0.07]">
            {QA_CHECKS.map((c) => {
              const on = !!v.qa[c.id];
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => patch({ qa: { [c.id]: !on } })}
                    className="press flex min-h-10 w-full items-center gap-3 px-3 py-2 text-left text-[13px] hover:bg-white/[0.03]"
                  >
                    <span className={`grid size-5 shrink-0 place-items-center rounded-md border ${on ? "border-transparent bg-white text-black" : "border-white/20"}`}>
                      {on && <Icon name="check" className="size-3.5" />}
                    </span>
                    <span className={on ? "text-fg" : "text-[#b4b4b4]"}>{c.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        {error && <ErrorLine>{error}</ErrorLine>}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Nuova versione: file o link                                         */
/* ------------------------------------------------------------------ */

/** Upload multipart con avanzamento (fetch non lo dà). */
function uploadFile(url: string, form: FormData, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      if (xhr.status === 401) {
        // Sessione scaduta: ricarica pulita sul login, come in lib/client.ts.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        location.href = "/login";
        return reject(new Error("Sessione scaduta"));
      }
      let msg = `Errore ${xhr.status}`;
      try {
        msg = JSON.parse(xhr.responseText).error ?? msg;
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("Connessione persa durante il caricamento"));
    xhr.send(form);
  });
}

const guessType = (url: string): "video" | "image" => (/\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(url) ? "image" : "video");

function Upload({ ctx, empty }: { ctx: ConceptCtx; empty: boolean }) {
  const { concept } = ctx.data;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"file" | "link">("file");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [hookId, setHookId] = useState(() => concept.hooks.find((h) => h.chosen)?.id ?? "");
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const { busy, error, run, setError } = useAction();
  const moves = concept.stage === "produzione" || concept.stage === "script";

  const reset = () => {
    setFile(null);
    setLink("");
    setNotes("");
    setProgress(null);
    setOpen(false);
  };

  const submit = async () => {
    const url = `${ctx.key}/videos`;
    if (mode === "file") {
      if (!file) return setError("Scegli un file.");
      const form = new FormData();
      form.set("file", file);
      if (notes.trim()) form.set("notes", notes.trim());
      if (hookId) form.set("hookId", hookId);
      setProgress(0);
      const ok = await run(() => ctx.act(() => uploadFile(url, form, setProgress)));
      if (ok) reset();
      else setProgress(null);
    } else {
      const u = link.trim();
      if (!/^https?:\/\//i.test(u)) return setError("Incolla un link che inizia con https://");
      const ok = await run(() => ctx.act(() => send("POST", url, { media: { url: u, type: guessType(u) }, hookId: hookId || undefined, notes: notes.trim() || undefined })));
      if (ok) reset();
    }
  };

  if (!open) {
    return (
      <Row className="flex flex-wrap items-center gap-3 py-3">
        {empty && (
          <span className="orb grid size-8 shrink-0 place-items-center rounded-full">
            <Icon name="film" className="size-3.5" />
          </span>
        )}
        <p className="min-w-44 flex-1 text-[13px] text-muted">
          {empty ? "Nessuna versione ancora. Di solito la carica il producer dopo lo script. " : ""}
          {moves ? "Una nuova versione manda il concept in revisione dal critico." : empty ? "" : "Carica una nuova versione del video."}
        </p>
        <div className="ml-auto">
          <Btn icon="upload" variant={concept.stage === "produzione" ? "chrome" : "ghost"} onClick={() => setOpen(true)}>
            {empty ? "Carica video" : "Nuova versione"}
          </Btn>
        </div>
      </Row>
    );
  }

  return (
    <div className="space-y-4 bg-white/[0.015] px-4 py-4 md:px-5">
      <div className="flex items-center gap-2">
        <h3 className="flex-1 text-[13px] font-semibold">Nuova versione</h3>
        <Btn variant="quiet" icon="close" label="Chiudi" onClick={reset} disabled={busy} className="-my-1.5 -mr-2" />
      </div>
      <Seg
        ariaLabel="Come caricarla"
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
        }}
        options={[
          { value: "file", label: "File" },
          { value: "link", label: "Link" },
        ]}
      />
      {mode === "file" ? (
        <div>
          <input
            ref={input}
            type="file"
            accept="video/*,image/*"
            hidden
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="press flex min-h-20 w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/15 px-4 py-4 text-center hover:border-white/30 hover:bg-white/[0.02]"
          >
            <Icon name={file ? "film" : "upload"} className="size-5 text-[#b4b4b4]" />
            {file ? (
              <>
                <span className="max-w-full truncate text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted">{file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1024 / 1024).toFixed(1).replace(".", ",")} MB`} · tocca per cambiare</span>
              </>
            ) : (
              <>
                <span className="text-sm font-medium">Scegli un video o un&apos;immagine</span>
                <span className="text-xs text-muted">Fino a 20 MB</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <F label="Link al file">
          <input value={link} onChange={(e) => setLink(e.target.value)} type="url" inputMode="url" placeholder="https://…/video.mp4" className={fieldClass} />
        </F>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="Hook usato">
          <select value={hookId} onChange={(e) => setHookId(e.target.value)} className={fieldClass}>
            <option value="">Non indicato</option>
            {concept.hooks.map((h, i) => (
              <option key={h.id} value={h.id}>
                {i + 1}. {h.text.length > 48 ? `${h.text.slice(0, 48)}…` : h.text}
              </option>
            ))}
          </select>
        </F>
        <F label="Note" hint="facoltative">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldClass} placeholder="Cosa cambia rispetto a prima" />
        </F>
      </div>
      {progress !== null && (
        <div className="space-y-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="chrome h-full rounded-full border-0! transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-muted tabular-nums">{progress < 100 ? `Caricamento ${progress}%` : "Salvo…"}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {error && <ErrorLine className="mr-auto basis-full sm:basis-auto">{error}</ErrorLine>}
        <Btn onClick={reset} disabled={busy}>
          Annulla
        </Btn>
        <Btn variant="chrome" icon="upload" onClick={submit} disabled={busy || (mode === "file" ? !file : !link.trim())}>
          {busy ? "Carico…" : "Carica"}
        </Btn>
      </div>
    </div>
  );
}
