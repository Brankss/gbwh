"use client";

import { useState } from "react";
import { send } from "@/lib/client";
import { FORMATS, formatOf, type Format } from "@/lib/ugc-library";
import { Block, Disclosure, EditBar, EditToggle, F, Missing, Pair, Panel, Row, TextArea, fieldClass, parseNum, useAction, type ConceptCtx } from "./concept-ui";

// Idea: angolo, format della libreria, perché ferma lo scroll, personaggio, durata.

type Draft = { title: string; angle: string; format: string; why: string; character: string; duration: string };

export function ConceptIdea({ ctx }: { ctx: ConceptCtx }) {
  const c = ctx.data.concept;
  const [draft, setDraft] = useState<Draft | null>(null);
  const { busy, error, run, setError } = useAction();
  const format = formatOf(c.format);

  const start = () =>
    setDraft({ title: c.title, angle: c.angle, format: c.format, why: c.why ?? "", character: c.character ?? "", duration: c.durationSec ? String(c.durationSec) : "" });

  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim() || !draft.angle.trim()) return setError("Titolo e angolo servono.");
    const duration = parseNum(draft.duration);
    if (Number.isNaN(duration) || (duration !== undefined && (duration < 3 || duration > 180))) return setError("Durata: un numero tra 3 e 180 secondi.");
    const patch = { title: draft.title.trim(), angle: draft.angle.trim(), format: draft.format, why: draft.why.trim(), character: draft.character.trim(), durationSec: duration };
    const ok = await run(() => ctx.act(() => send("PATCH", ctx.key, patch), (d) => ({ ...d, concept: { ...d.concept, ...patch, why: patch.why || undefined, character: patch.character || undefined } })));
    if (ok) setDraft(null);
  };

  const set = (k: keyof Draft) => (v: string) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  return (
    <Block id="idea" title="Idea" action={!draft && <EditToggle onClick={start} />}>
      {draft ? (
        <Panel>
          <Row className="space-y-4">
            <F label="Titolo">
              <input value={draft.title} onChange={(e) => set("title")(e.target.value)} className={fieldClass} maxLength={160} />
            </F>
            <F label="Angolo" hint="la leva di vendita">
              <TextArea value={draft.angle} onChange={set("angle")} placeholder="Es. «Smetti di buttare soldi in…»" />
            </F>
            <F label="Format">
              <select value={draft.format} onChange={(e) => set("format")(e.target.value)} className={fieldClass}>
                {FORMATS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </F>
            <F label="Perché ferma lo scroll">
              <TextArea value={draft.why} onChange={set("why")} placeholder="La tesi in una frase: cosa vede chi scrolla nei primi 2 secondi?" />
            </F>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
              <F label="Personaggio" hint="chi appare o parla">
                <TextArea value={draft.character} onChange={set("character")} rows={1} />
              </F>
              <F label="Durata (s)">
                <input value={draft.duration} onChange={(e) => set("duration")(e.target.value)} inputMode="numeric" placeholder="20" className={fieldClass} />
              </F>
            </div>
          </Row>
          <EditBar onCancel={() => setDraft(null)} onSave={save} busy={busy} error={error} />
        </Panel>
      ) : (
        <Panel>
          <Pair label="Angolo">{c.angle || <Missing />}</Pair>
          <Pair label="Format">
            <span className="font-medium">{format?.name ?? c.format}</span>
            {format && <FormatDetails format={format} />}
          </Pair>
          <Pair label="Ferma lo scroll">{c.why ? c.why : <Missing>Manca la tesi: perché qualcuno dovrebbe fermarsi?</Missing>}</Pair>
          <Pair label="Personaggio">{c.character || <Missing />}</Pair>
          <Pair label="Durata">{c.durationSec ? <span className="tabular-nums">{c.durationSec} s</span> : <Missing>Non indicata</Missing>}</Pair>
        </Panel>
      )}
    </Block>
  );
}

function FormatDetails({ format }: { format: Format }) {
  const empty = !format.when && !format.structure.length && !format.example && !format.pitfalls.length;
  return (
    <div className="mt-1">
      <Disclosure label="Come funziona questo format" icon="film">
        {empty ? (
          <p className="text-[13px] text-muted">I dettagli di questo format stanno arrivando nella libreria.</p>
        ) : (
          <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5 text-[13px] leading-relaxed">
            {format.when && (
              <div>
                <div className="mb-0.5 text-xs font-medium text-[#b4b4b4]">Quando usarlo</div>
                <p className="text-muted">{format.when}</p>
              </div>
            )}
            {format.structure.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-medium text-[#b4b4b4]">Struttura</div>
                <ol className="space-y-1">
                  {format.structure.map((s, i) => (
                    <li key={i} className="flex gap-2 text-muted">
                      <span className="w-4 shrink-0 text-right text-[#b4b4b4] tabular-nums">{i + 1}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {format.example && (
              <div>
                <div className="mb-0.5 text-xs font-medium text-[#b4b4b4]">Esempio</div>
                <p className="text-muted">{format.example}</p>
              </div>
            )}
            {format.pitfalls.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-medium text-[#b4b4b4]">Da evitare</div>
                <ul className="space-y-1">
                  {format.pitfalls.map((p, i) => (
                    <li key={i} className="flex gap-2 text-muted">
                      <span className="text-[#ec8585]">×</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Disclosure>
    </div>
  );
}
