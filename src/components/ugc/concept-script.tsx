"use client";

import { useState } from "react";
import { send } from "@/lib/client";
import { totalSeconds, type Scene } from "@/lib/ugc";
import { SCRIPT_RULES } from "@/lib/ugc-library";
import { Block, Btn, Disclosure, EditBar, EditToggle, EmptyRow, F, Panel, Row, TextArea, fieldClass, move, parseNum, tempId, useAction, type ConceptCtx } from "./concept-ui";

// Script / storyboard: scene numerate con secondi, inquadratura, azione, battuta, testo a schermo.

type DraftScene = Omit<Scene, "sec"> & { sec: string };

const fmtSec = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));

export function ConceptScript({ ctx }: { ctx: ConceptCtx }) {
  const { scenes, durationSec } = ctx.data.concept;
  const [draft, setDraft] = useState<DraftScene[] | null>(null);
  const { busy, error, run, setError } = useAction();

  const start = (add = false) =>
    setDraft([
      ...scenes.map((s) => ({ ...s, sec: fmtSec(s.sec), line: s.line ?? "", onScreen: s.onScreen ?? "", notes: s.notes ?? "" })),
      ...(add || !scenes.length ? [blank()] : []),
    ]);

  const save = async () => {
    if (!draft) return;
    const rows = draft.filter((s) => s.shot.trim() || s.action.trim() || s.line?.trim() || s.onScreen?.trim() || s.notes?.trim());
    const out: Scene[] = [];
    for (const [i, s] of rows.entries()) {
      const sec = parseNum(s.sec);
      if (sec === undefined || Number.isNaN(sec) || sec < 0.5 || sec > 120) return setError(`Scena ${i + 1}: secondi tra 0,5 e 120.`);
      if (!s.shot.trim() || !s.action.trim()) return setError(`Scena ${i + 1}: servono inquadratura e azione.`);
      out.push({
        id: s.id,
        sec,
        shot: s.shot.trim(),
        action: s.action.trim(),
        line: s.line?.trim() || undefined,
        onScreen: s.onScreen?.trim() || undefined,
        notes: s.notes?.trim() || undefined,
      });
    }
    const ok = await run(() => ctx.act(() => send("PATCH", ctx.key, { scenes: out }), (d) => ({ ...d, concept: { ...d.concept, scenes: out } })));
    if (ok) setDraft(null);
  };

  const total = totalSeconds(draft ? draft.map((s) => ({ ...s, sec: parseNum(s.sec) || 0 })) : scenes);
  const off = durationSec ? Math.abs(total - durationSec) / durationSec : 0;

  const totals = (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px]">
      <span className="font-semibold tabular-nums">{fmtSec(total)} s</span>
      {durationSec ? (
        <span className={`tabular-nums ${off > 0.2 ? "text-[#e0a640]" : "text-muted"}`}>
          su {durationSec} s di target{off > 0.2 && (total > durationSec ? " · troppo lungo" : " · troppo corto")}
        </span>
      ) : (
        <span className="text-muted">totali</span>
      )}
      <span className="text-muted">
        · {(draft ?? scenes).length} {(draft ?? scenes).length === 1 ? "scena" : "scene"}
      </span>
    </div>
  );

  const rules = SCRIPT_RULES.length > 0 && (
    <Row className="py-2">
      <Disclosure label="Regole per uno script che l'AI gira bene">
        <ul className="space-y-1.5 pb-1 text-[13px] leading-relaxed text-muted">
          {SCRIPT_RULES.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-[#b4b4b4]">·</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </Disclosure>
    </Row>
  );

  // Inizio di ogni scena sulla timeline del video.
  const starts = scenes.map((_, i) => totalSeconds(scenes.slice(0, i)));
  return (
    <Block id="script" title="Script" action={!draft && scenes.length > 0 && <EditToggle onClick={() => start()} />}>
      {draft ? (
        <Panel>
          <Row className="py-3">{totals}</Row>
          {rules}
          {draft.map((s, i) => {
            const upd = (patch: Partial<DraftScene>) => setDraft(draft.map((x) => (x.id === s.id ? { ...x, ...patch } : x)));
            return (
              <Row key={s.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="orb grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums">{i + 1}</span>
                  <span className="flex-1" />
                  <Btn variant="quiet" icon="back" label="Sposta su" onClick={() => setDraft(move(draft, i, -1))} disabled={i === 0} className="rotate-90" />
                  <Btn variant="quiet" icon="forward" label="Sposta giù" onClick={() => setDraft(move(draft, i, 1))} disabled={i === draft.length - 1} className="rotate-90" />
                  <Btn variant="quiet" icon="trash" label="Elimina scena" onClick={() => setDraft(draft.filter((x) => x.id !== s.id))} />
                </div>
                <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
                  <F label="Secondi">
                    <input value={s.sec} onChange={(e) => upd({ sec: e.target.value })} inputMode="decimal" className={`${fieldClass} tabular-nums`} placeholder="3" />
                  </F>
                  <F label="Inquadratura">
                    <input value={s.shot} onChange={(e) => upd({ shot: e.target.value })} className={fieldClass} placeholder="Primo piano, selfie…" />
                  </F>
                </div>
                <F label="Azione">
                  <TextArea value={s.action} onChange={(v) => upd({ action: v })} placeholder="Cosa succede in scena" />
                </F>
                <F label="Battuta" hint="cosa dice">
                  <TextArea value={s.line ?? ""} onChange={(v) => upd({ line: v })} rows={1} />
                </F>
                <div className="grid gap-3 sm:grid-cols-2">
                  <F label="Testo a schermo">
                    <input value={s.onScreen ?? ""} onChange={(e) => upd({ onScreen: e.target.value })} className={fieldClass} />
                  </F>
                  <F label="Note">
                    <input value={s.notes ?? ""} onChange={(e) => upd({ notes: e.target.value })} className={fieldClass} placeholder="Musica, ritmo, prodotto…" />
                  </F>
                </div>
              </Row>
            );
          })}
          <Row className="py-2.5">
            <Btn variant="quiet" icon="plus" onClick={() => setDraft([...draft, blank()])} className="-ml-2">
              Aggiungi scena
            </Btn>
          </Row>
          <EditBar onCancel={() => setDraft(null)} onSave={save} busy={busy} error={error} />
        </Panel>
      ) : scenes.length === 0 ? (
        <Panel>
          <EmptyRow icon="film" action={<Btn icon="plus" onClick={() => start(true)}>Scrivi</Btn>}>
            Nessuna scena. Lo script si scrive dopo il via libera del critico: scene da 2–5 secondi.
          </EmptyRow>
          {rules}
        </Panel>
      ) : (
        <Panel>
          <Row className="py-3">{totals}</Row>
          {scenes.map((s, i) => {
            const from = starts[i];
            const to = from + (s.sec || 0);
            return (
              <div key={s.id} className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3 px-4 py-3.5 md:grid-cols-[4.5rem_minmax(0,1fr)] md:px-5">
                <div className="pt-0.5 text-center">
                  <span className="orb mx-auto grid size-7 place-items-center rounded-full text-[11px] font-semibold tabular-nums">{i + 1}</span>
                  <span className="mt-1.5 block text-[11px] leading-tight text-muted tabular-nums">
                    {fmtSec(from)}–{fmtSec(to)}s
                  </span>
                </div>
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[11px] font-medium tracking-[0.06em] text-[#b4b4b4] uppercase">{s.shot}</span>
                    <span className="text-[11px] text-muted tabular-nums">{fmtSec(s.sec)} s</span>
                  </div>
                  <p className="text-[15px] leading-relaxed">{s.action}</p>
                  {s.line && <p className="border-l-2 border-white/20 pl-3 text-[15px] leading-relaxed text-[#d8d8d8] italic">«{s.line}»</p>}
                  {s.onScreen && (
                    <p className="text-[13px]">
                      <span className="mr-1.5 rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#c4c4c4] uppercase">Testo</span>
                      <span className="font-medium">{s.onScreen}</span>
                    </p>
                  )}
                  {s.notes && <p className="text-[13px] leading-relaxed text-muted">{s.notes}</p>}
                </div>
              </div>
            );
          })}
          {rules}
        </Panel>
      )}
    </Block>
  );
}

const blank = (): DraftScene => ({ id: tempId(), sec: "3", shot: "", action: "", line: "", onScreen: "", notes: "" });
