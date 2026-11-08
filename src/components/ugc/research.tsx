"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Button, Field, Modal, Section, inputClass } from "@/components/kit";
import type { Bot } from "@/lib/bots";
import { ago, send } from "@/lib/client";
import { RESEARCH_KINDS, type ResearchKind, type UgcResearch } from "@/lib/ugc";
import { FormError, GROUP, UGC_KEY, briefKey, useSave, whoName } from "./common";

// Ricerca di un brief, raggruppata per tipo: ad dei competitor, voce dei clienti, insight, trend.

const KIND_LABEL: Record<ResearchKind, string> = {
  "ad competitor": "Ad dei competitor",
  "voce cliente": "Voce dei clienti",
  insight: "Insight",
  trend: "Trend",
};

const KIND_HINT: Record<ResearchKind, string> = {
  "ad competitor": "Cosa fa l'ad, in due righe: hook, format, cosa mostra",
  "voce cliente": "La frase esatta di un cliente (recensione, commento, Reddit…)",
  insight: "Una verità sul target che nessuno dice",
  trend: "Il trend, il suono o il format che gira adesso",
};

export function ResearchSection({ briefId, items, bots }: { briefId: string; items: UgcResearch[]; bots?: Bot[] }) {
  const [adding, setAdding] = useState<ResearchKind | null>(null);
  const groups = RESEARCH_KINDS.map((k) => ({ kind: k, rows: items.filter((r) => r.kind === k).sort((a, b) => b.createdAt - a.createdAt) }));

  const del = async (r: UgcResearch) => {
    if (!confirm("Eliminare questa voce di ricerca?")) return;
    await send("DELETE", `/api/ugc/research/${r.id}`, undefined, [briefKey(briefId), UGC_KEY]).catch((e) => alert(e.message));
  };

  return (
    <Section
      title={`Ricerca${items.length ? ` · ${items.length}` : ""}`}
      action={
        <Button variant="ghost" icon="plus" onClick={() => setAdding("voce cliente")}>
          Aggiungi
        </Button>
      }
    >
      {!items.length && (
        <p className="text-sm text-muted">Ancora niente. Le frasi vere dei clienti e gli ad dei competitor che funzionano sono la materia prima degli hook.</p>
      )}
      <div className="space-y-4">
        {groups
          .filter((g) => g.rows.length)
          .map((g) => (
            <div key={g.kind} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <h3 className="text-sm font-semibold">{KIND_LABEL[g.kind]}</h3>
                <span className="text-xs text-muted tabular-nums">{g.rows.length}</span>
                <button
                  onClick={() => setAdding(g.kind)}
                  aria-label={`Aggiungi: ${KIND_LABEL[g.kind]}`}
                  className="press ml-auto grid size-9 place-items-center rounded-full text-muted hover:bg-white/[0.06] hover:text-fg"
                >
                  <Icon name="plus" className="size-4" />
                </button>
              </div>
              <div className={GROUP}>
                {g.rows.map((r) => (
                  <div key={r.id} className="flex gap-2 py-3 pr-1.5 pl-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className={`text-[15px] leading-snug whitespace-pre-wrap ${g.kind === "voce cliente" ? "text-[#dcdcdc]" : ""}`}>
                        {g.kind === "voce cliente" ? `“${r.text}”` : r.text}
                      </p>
                      {r.why && <p className="text-[13px] leading-snug text-muted">{r.why}</p>}
                      <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[11px] text-muted">
                        {r.source && <span>{r.source}</span>}
                        {r.url && (
                          <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#a8a8a8] hover:text-fg">
                            <Icon name="link" className="size-3" /> link
                          </a>
                        )}
                        {(r.source || r.url) && <span aria-hidden>·</span>}
                        <span>
                          {whoName(bots, r.by)} · {ago(r.createdAt)}
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => del(r)}
                      aria-label="Elimina voce"
                      className="press grid size-9 shrink-0 place-items-center rounded-full text-muted/60 hover:bg-white/[0.06] hover:text-[#ec8585]"
                    >
                      <Icon name="trash" className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
      {adding && <ResearchForm briefId={briefId} kind={adding} onClose={() => setAdding(null)} />}
    </Section>
  );
}

function ResearchForm({ briefId, kind: initial, onClose }: { briefId: string; kind: ResearchKind; onClose: () => void }) {
  const [f, setF] = useState({ kind: initial, text: "", why: "", source: "", url: "" });
  const { error, busy, run } = useSave(onClose);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <Modal
      title="Nuova ricerca"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button disabled={!f.text.trim() || busy} onClick={() => run(() => send("POST", `/api/ugc/briefs/${briefId}/research`, f, [briefKey(briefId), UGC_KEY]))}>
            Aggiungi
          </Button>
        </>
      }
    >
      <Field label="Tipo">
        <select className={inputClass} value={f.kind} onChange={set("kind")}>
          {RESEARCH_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Cosa">
        <textarea className={`${inputClass} min-h-24 resize-y`} value={f.text} onChange={set("text")} placeholder={KIND_HINT[f.kind]} autoFocus />
      </Field>
      <Field label="Perché conta" hint="facoltativo">
        <textarea className={`${inputClass} min-h-16 resize-y`} value={f.why} onChange={set("why")} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Fonte">
          <input className={inputClass} value={f.source} onChange={set("source")} placeholder="TikTok, Amazon, Reddit…" />
        </Field>
        <Field label="Link">
          <input className={inputClass} value={f.url} onChange={set("url")} placeholder="https://…" inputMode="url" />
        </Field>
      </div>
      <FormError>{error}</FormError>
    </Modal>
  );
}
