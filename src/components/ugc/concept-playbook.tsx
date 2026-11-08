"use client";

import { useState } from "react";
import { send } from "@/lib/client";
import { LEARNING_KINDS, type LearningKind, type UgcLearning } from "@/lib/ugc";
import { Block, Btn, Chip, EmptyRow, ErrorLine, F, Panel, Row, Seg, TextArea, agoAt, fieldClass, useAction, type ConceptCtx } from "./concept-ui";

// Playbook: le lezioni nate da questo concept. Registro: chi ha fatto cosa.

const KIND_LABEL: Record<LearningKind, string> = { hook: "Hook", format: "Format", angolo: "Angolo", produzione: "Produzione", errore: "Errore", regola: "Regola" };

export function ConceptPlaybook({ ctx }: { ctx: ConceptCtx }) {
  const { learnings } = ctx.data;
  const [adding, setAdding] = useState(false);
  const sorted = [...learnings].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.createdAt - a.createdAt);

  return (
    <Block
      id="playbook"
      title={`Playbook${learnings.length ? ` · ${learnings.length}` : ""}`}
      action={
        !adding && (
          <Btn variant="quiet" icon="plus" onClick={() => setAdding(true)} className="-my-2 -mr-2">
            Lezione
          </Btn>
        )
      }
    >
      <Panel>
        {adding && <AddLearning ctx={ctx} onDone={() => setAdding(false)} />}
        {sorted.length === 0
          ? !adding && <EmptyRow icon="spark">Nessuna lezione da questo concept. Cosa ha funzionato, o cosa non rifaresti?</EmptyRow>
          : sorted.map((l) => <LearningRow key={l.id} l={l} ctx={ctx} />)}
      </Panel>
    </Block>
  );
}

function LearningRow({ l, ctx }: { l: UgcLearning; ctx: ConceptCtx }) {
  const { error, run } = useAction();
  const del = () => confirm("Eliminare questa lezione dal Playbook?") && run(() => ctx.act(() => send("DELETE", `/api/ugc/learnings/${l.id}`), (d) => ({ ...d, learnings: d.learnings.filter((x) => x.id !== l.id) })));
  return (
    <Row className="flex items-start gap-2">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip>{KIND_LABEL[l.kind]}</Chip>
          <Chip strong={l.strength === "provato"} tone={l.strength === "provato" ? "#199e70" : undefined}>
            {l.strength}
          </Chip>
          <span className="text-[11px] text-muted">
            {ctx.who(l.by)}
            {ctx.now ? ` · ${agoAt(l.createdAt, ctx.now)}` : ""}
          </span>
        </div>
        <p className="text-[15px] leading-relaxed">{l.text}</p>
        {l.evidence && <p className="text-[13px] leading-relaxed text-muted">{l.evidence}</p>}
        {error && <ErrorLine>{error}</ErrorLine>}
      </div>
      <Btn variant="quiet" icon="trash" label="Elimina lezione" onClick={del} className="-mt-1 -mr-2" />
    </Row>
  );
}

function AddLearning({ ctx, onDone }: { ctx: ConceptCtx; onDone: () => void }) {
  const [kind, setKind] = useState<LearningKind>("hook");
  const [text, setText] = useState("");
  const [strength, setStrength] = useState<"ipotesi" | "provato">("ipotesi");
  const [evidence, setEvidence] = useState("");
  const { busy, error, run, setError } = useAction();

  const submit = async () => {
    if (!text.trim()) return setError("Scrivi la lezione.");
    const ok = await run(() =>
      ctx.act(() => send("POST", "/api/ugc/learnings", { kind, text: text.trim(), strength, evidence: evidence.trim() || undefined, conceptId: ctx.id }, ["/api/ugc"])),
    );
    if (ok) onDone();
  };

  return (
    <div className="bg-white/[0.015]">
      <Row className="space-y-4">
        <h3 className="text-[13px] font-semibold">Nuova lezione</h3>
        <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <F label="Tipo">
            <select value={kind} onChange={(e) => setKind(e.target.value as LearningKind)} className={fieldClass}>
              {LEARNING_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </F>
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-[#b4b4b4]">Quanto è sicura</span>
            <Seg
              ariaLabel="Quanto è sicura"
              value={strength}
              onChange={setStrength}
              options={[
                { value: "ipotesi", label: "Ipotesi" },
                { value: "provato", label: "Provato dai numeri" },
              ]}
            />
          </div>
        </div>
        <F label="Lezione">
          <TextArea value={text} onChange={setText} placeholder="Es. Gli hook con una domanda diretta tengono il 30% in più" />
        </F>
        <F label="Prova" hint="facoltativa">
          <TextArea value={evidence} onChange={setEvidence} rows={1} placeholder="Numeri, confronto, link" />
        </F>
      </Row>
      <Row className="flex flex-wrap items-center justify-end gap-2">
        {error && <ErrorLine className="mr-auto basis-full sm:basis-auto">{error}</ErrorLine>}
        <Btn onClick={onDone} disabled={busy}>
          Annulla
        </Btn>
        <Btn variant="chrome" onClick={submit} disabled={busy}>
          {busy ? "Salvo…" : "Aggiungi al Playbook"}
        </Btn>
      </Row>
    </div>
  );
}

export function ConceptLog({ ctx }: { ctx: ConceptCtx }) {
  const { log } = ctx.data;
  const [all, setAll] = useState(false);
  const shown = all ? log : log.slice(0, 8);
  return (
    <Block id="registro" title="Registro">
      <Panel>
        {log.length === 0 ? (
          <EmptyRow icon="clock">Nessuna modifica registrata.</EmptyRow>
        ) : (
          <>
            <ol className="px-4 py-2 md:px-5">
              {shown.map((e, i) => (
                <li key={`${e.at}-${i}`} className="py-1.5 text-[13px] leading-relaxed sm:flex sm:items-baseline sm:gap-3">
                  <span className="hidden w-[6.5rem] shrink-0 truncate text-xs text-muted tabular-nums sm:block">{agoAt(e.at, ctx.now)}</span>
                  <span className="block min-w-0 flex-1">
                    <span className="font-medium">{ctx.who(e.by)}</span> <span className="text-[#b4b4b4]">{e.action}</span>
                    <span className="ml-1.5 text-xs text-muted sm:hidden">· {agoAt(e.at, ctx.now)}</span>
                  </span>
                </li>
              ))}
            </ol>
            {log.length > 8 && (
              <button onClick={() => setAll(!all)} className="press flex h-11 w-full items-center justify-center text-[13px] font-medium text-muted hover:bg-white/[0.03] hover:text-fg">
                {all ? "Mostra meno" : `Mostra tutto (${log.length})`}
              </button>
            )}
          </>
        )}
      </Panel>
    </Block>
  );
}
