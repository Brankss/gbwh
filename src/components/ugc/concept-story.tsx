"use client";

import { useState } from "react";
import { send } from "@/lib/client";
import type { Story } from "@/lib/ugc";
import { Block, EditBar, EditToggle, Panel, Row, TextArea, useAction, type ConceptCtx } from "./concept-ui";

// Storia in 4 battute: hook → build-up → payoff → CTA.

const BEATS: { key: keyof Story; label: string; hint: string }[] = [
  { key: "hook", label: "Hook", hint: "Cosa ferma il pollice" },
  { key: "buildup", label: "Build-up", hint: "Tensione: problema, dubbio, attesa" },
  { key: "payoff", label: "Payoff", hint: "La prova: il prodotto risolve" },
  { key: "cta", label: "CTA", hint: "Cosa fare adesso" },
];

export function ConceptStory({ ctx }: { ctx: ConceptCtx }) {
  const story = ctx.data.concept.story;
  const [draft, setDraft] = useState<Story | null>(null);
  const { busy, error, run } = useAction();
  const filled = BEATS.filter((b) => story[b.key]?.trim()).length;

  const save = async () => {
    if (!draft) return;
    const next = Object.fromEntries(BEATS.map((b) => [b.key, draft[b.key].trim()])) as Story;
    const ok = await run(() => ctx.act(() => send("PATCH", ctx.key, { story: next }), (d) => ({ ...d, concept: { ...d.concept, story: next } })));
    if (ok) setDraft(null);
  };

  return (
    <Block id="storia" title="Storia" action={!draft && <EditToggle onClick={() => setDraft({ hook: story.hook ?? "", buildup: story.buildup ?? "", payoff: story.payoff ?? "", cta: story.cta ?? "" })}>{filled ? "Modifica" : "Scrivi"}</EditToggle>}>
      <Panel>
        <Row className="py-4">
          <ol className="relative">
            {BEATS.map((b, i) => {
              const text = story[b.key]?.trim();
              const last = i === BEATS.length - 1;
              return (
                <li key={b.key} className={`relative flex gap-3.5 ${last ? "" : "pb-5"}`}>
                  {/* filo che unisce le battute */}
                  {!last && <span aria-hidden className="absolute top-7 bottom-0 left-[13px] w-px bg-gradient-to-b from-white/20 to-white/[0.04]" />}
                  <span
                    className={`relative grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums ${
                      draft || text ? "orb" : "border border-dashed border-white/15 text-muted"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-baseline gap-2">
                      <span className="shrink-0 text-[13px] font-semibold whitespace-nowrap">{b.label}</span>
                      <span className="truncate text-xs text-muted">{b.hint}</span>
                    </div>
                    {draft ? (
                      <div className="mt-2">
                        <TextArea value={draft[b.key]} onChange={(v) => setDraft({ ...draft, [b.key]: v })} ariaLabel={b.label} />
                      </div>
                    ) : (
                      <p className={`mt-1 text-[15px] leading-relaxed whitespace-pre-wrap ${text ? "" : "text-muted italic"}`}>{text || "Da scrivere"}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </Row>
        {draft && <EditBar onCancel={() => setDraft(null)} onSave={save} busy={busy} error={error} />}
      </Panel>
    </Block>
  );
}
