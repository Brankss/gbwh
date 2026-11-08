"use client";

import { useState } from "react";
import { send } from "@/lib/client";
import type { Hook } from "@/lib/ugc";
import { HOOK_TYPES, hookTypeOf } from "@/lib/ugc-library";
import { Block, Btn, Chip, EditBar, EditToggle, EmptyRow, ErrorLine, F, Panel, Row, StarIcon, TextArea, fieldClass, move, tempId, useAction, type ConceptCtx } from "./concept-ui";

// Hook: le prime parole/immagini del video. Se ne scrivono almeno 3, se ne sceglie uno.

const typeName = (id: string) => hookTypeOf(id)?.name ?? id;

export function ConceptHooks({ ctx }: { ctx: ConceptCtx }) {
  const hooks = ctx.data.concept.hooks;
  const [draft, setDraft] = useState<Hook[] | null>(null);
  const { busy, error, run, setError } = useAction();
  const star = useAction();

  const choose = (id: string) => {
    const next = hooks.map((h) => ({ ...h, chosen: h.id === id ? !h.chosen : false }));
    star.run(() => ctx.act(() => send("PATCH", ctx.key, { hooks: next }), (d) => ({ ...d, concept: { ...d.concept, hooks: next } })));
  };

  const start = (add = false) => setDraft([...hooks.map((h) => ({ ...h })), ...(add || !hooks.length ? [blank()] : [])]);

  const save = async () => {
    if (!draft) return;
    const rows = draft.map((h) => ({ ...h, text: h.text.trim(), visual: h.visual?.trim() || undefined })).filter((h) => h.text || h.visual);
    if (rows.some((h) => !h.text)) return setError("Ogni hook ha bisogno del testo.");
    const ok = await run(() => ctx.act(() => send("PATCH", ctx.key, { hooks: rows }), (d) => ({ ...d, concept: { ...d.concept, hooks: rows } })));
    if (ok) setDraft(null);
  };

  const missing = Math.max(0, 3 - hooks.length);

  return (
    <Block id="hook" title={`Hook${hooks.length ? ` · ${hooks.length}` : ""}`} action={!draft && hooks.length > 0 && <EditToggle onClick={() => start()} />}>
      {draft ? (
        <Panel>
          {draft.map((h, i) => (
            <Row key={h.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted tabular-nums">Hook {i + 1}</span>
                <span className="flex-1" />
                <Btn variant="quiet" icon="back" label="Sposta su" onClick={() => setDraft(move(draft, i, -1))} disabled={i === 0} className="rotate-90" />
                <Btn variant="quiet" icon="forward" label="Sposta giù" onClick={() => setDraft(move(draft, i, 1))} disabled={i === draft.length - 1} className="rotate-90" />
                <Btn variant="quiet" icon="trash" label="Elimina hook" onClick={() => setDraft(draft.filter((x) => x.id !== h.id))} />
              </div>
              <TextArea value={h.text} onChange={(v) => setDraft(draft.map((x) => (x.id === h.id ? { ...x, text: v } : x)))} placeholder="Cosa si sente o si legge nel primo secondo" ariaLabel={`Testo hook ${i + 1}`} />
              <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
                <F label="Tipo">
                  <select value={h.type} onChange={(e) => setDraft(draft.map((x) => (x.id === h.id ? { ...x, type: e.target.value } : x)))} className={fieldClass}>
                    {!hookTypeOf(h.type) && <option value={h.type}>{h.type}</option>}
                    {HOOK_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </F>
                <F label="Visivo" hint="cosa si vede">
                  <TextArea value={h.visual ?? ""} onChange={(v) => setDraft(draft.map((x) => (x.id === h.id ? { ...x, visual: v } : x)))} rows={1} placeholder="Es. primo piano della mano che…" />
                </F>
              </div>
              <TypeHint id={h.type} />
            </Row>
          ))}
          <Row className="py-2.5">
            <Btn variant="quiet" icon="plus" onClick={() => setDraft([...draft, blank()])} className="-ml-2">
              Aggiungi hook
            </Btn>
          </Row>
          <EditBar onCancel={() => setDraft(null)} onSave={save} busy={busy} error={error} />
        </Panel>
      ) : (
        <Panel>
          {hooks.length === 0 ? (
            <EmptyRow icon="spark" action={<Btn icon="plus" onClick={() => start(true)}>Scrivi</Btn>}>
              Ancora nessun hook. Ne servono almeno 3 diversi da testare.
            </EmptyRow>
          ) : (
            hooks.map((h) => (
              <div key={h.id} className={`flex items-start gap-1 py-2 pr-4 pl-1.5 md:pr-5 ${h.chosen ? "bg-white/[0.035]" : ""}`}>
                <button
                  onClick={() => choose(h.id)}
                  disabled={star.busy}
                  aria-pressed={!!h.chosen}
                  aria-label={h.chosen ? "Hook scelto (tocca per togliere)" : "Scegli questo hook"}
                  className={`press grid size-10 shrink-0 place-items-center rounded-full ${h.chosen ? "text-white drop-shadow-[0_0_8px_rgb(255_255_255/0.45)]" : "text-[#5a5a5a] hover:text-[#b4b4b4]"}`}
                >
                  <StarIcon filled={!!h.chosen} />
                </button>
                <div className="min-w-0 flex-1 py-1.5">
                  <p className={`text-[15px] leading-snug ${h.chosen ? "font-medium" : ""}`}>«{h.text}»</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Chip strong={h.chosen}>{typeName(h.type)}</Chip>
                    {h.chosen && <span className="text-[11px] font-medium text-[#b4b4b4]">scelto</span>}
                  </div>
                  {h.visual && <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{h.visual}</p>}
                </div>
              </div>
            ))
          )}
          {hooks.length > 0 && (missing > 0 || star.error) && (
            <Row className="flex flex-wrap items-center gap-2 py-2.5">
              {star.error ? (
                <ErrorLine>{star.error}</ErrorLine>
              ) : (
                <p className="flex-1 text-[13px] text-muted">
                  {missing === 1 ? "Manca 1 hook" : `Mancano ${missing} hook`} per arrivare a 3: più alternative, più possibilità di trovare quello che ferma lo scroll.
                </p>
              )}
              {missing > 0 && (
                <Btn variant="quiet" icon="plus" onClick={() => start(true)} className="-mr-2">
                  Aggiungi
                </Btn>
              )}
            </Row>
          )}
        </Panel>
      )}
    </Block>
  );
}

const blank = (): Hook => ({ id: tempId(), text: "", type: HOOK_TYPES[0]?.id ?? "problema", visual: "" });

function TypeHint({ id }: { id: string }) {
  const t = hookTypeOf(id);
  if (!t || (!t.why && !t.examples.length)) return null;
  return (
    <p className="text-xs leading-relaxed text-muted">
      {t.why}
      {t.examples[0] && <span className="text-[#b4b4b4]"> Es. «{t.examples[0]}»</span>}
    </p>
  );
}
