"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Empty, Field, Modal, Pills, Section, inputClass } from "@/components/kit";
import { Icon } from "@/components/icons";
import { PinIcon } from "@/components/ui";
import { ago, send, useApi } from "@/lib/client";
import { LEARNING_KINDS, type LearningKind, type UgcLearning } from "@/lib/ugc";
import { FormError, GROUP, SkeletonRows, Tag, UGC_KEY, UGC_LEARNINGS_KEY, useSave, whoName, type UgcOverview } from "./common";
import { Library } from "./library";

// Tab "Playbook": cosa abbiamo imparato (dai numeri) e la libreria che i bot seguono.

type Strength = "tutte" | UgcLearning["strength"];
const refresh = [UGC_LEARNINGS_KEY, UGC_KEY];

export function Playbook({ data }: { data: UgcOverview }) {
  const { data: res } = useApi<{ items: UgcLearning[] }>(UGC_LEARNINGS_KEY);
  const [kind, setKind] = useState<"tutte" | LearningKind>("tutte");
  const [strength, setStrength] = useState<Strength>("tutte");
  const [editing, setEditing] = useState<UgcLearning | "new" | null>(null);

  const items = res?.items ?? [];
  const shown = items.filter((l) => (kind === "tutte" || l.kind === kind) && (strength === "tutte" || l.strength === strength));
  const conceptTitle = (id?: string) => (id ? data.concepts.find((c) => c.id === id)?.title : undefined);

  return (
    <div className="space-y-8">
      <Section
        title="Lezioni"
        action={
          <Button variant="ghost" icon="plus" onClick={() => setEditing("new")}>
            Aggiungi
          </Button>
        }
      >
        {!res ? (
          <SkeletonRows rows={3} />
        ) : !items.length ? (
          <Empty icon="star" title="Il Playbook è vuoto">
            Qui finisce cosa funziona e cosa no, detto dai numeri. L&apos;analista lo scrive dopo ogni test; puoi aggiungere anche tu.
          </Empty>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <Pills
                  value={kind}
                  onChange={setKind}
                  options={[
                    { value: "tutte" as const, label: "Tutte", count: items.length },
                    ...LEARNING_KINDS.filter((k) => items.some((l) => l.kind === k)).map((k) => ({ value: k, label: k, count: items.filter((l) => l.kind === k).length })),
                  ]}
                />
              </div>
              <Segmented
                value={strength}
                onChange={setStrength}
                options={[
                  { value: "tutte", label: "Tutte" },
                  { value: "provato", label: "Provate" },
                  { value: "ipotesi", label: "Ipotesi" },
                ]}
              />
            </div>
            {shown.length ? (
              <div className={GROUP}>
                {shown.map((l) => (
                  <LearningRow key={l.id} l={l} data={data} conceptTitle={conceptTitle(l.conceptId)} onEdit={() => setEditing(l)} />
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted">Nessuna lezione con questi filtri.</p>
            )}
          </>
        )}
      </Section>

      <Section title="Libreria">
        <p className="-mt-1 text-sm text-muted">Il gusto che i bot seguono: format, hook, principi, la griglia del critico e le regole per gli script.</p>
        <Library />
      </Section>

      {editing && <LearningForm learning={editing === "new" ? undefined : editing} data={data} onClose={() => setEditing(null)} />}
    </div>
  );
}

function LearningRow({ l, data, conceptTitle, onEdit }: { l: UgcLearning; data: UgcOverview; conceptTitle?: string; onEdit: () => void }) {
  const [busy, setBusy] = useState(false);
  const patch = async (body: Partial<UgcLearning>) => {
    setBusy(true);
    try {
      await send("PATCH", `/api/ugc/learnings/${l.id}`, body, refresh);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex gap-1 py-1 pr-1.5 pl-4">
      <div className="min-w-0 flex-1 space-y-1.5 py-2">
        <button onClick={onEdit} className="block w-full space-y-1.5 text-left" aria-label={`Modifica: ${l.text}`}>
          <span className="flex flex-wrap items-center gap-1.5">
            <Tag>{l.kind}</Tag>
            <Tag strong={l.strength === "provato"}>{l.strength}</Tag>
          </span>
          <span className="block text-[15px] leading-snug">{l.text}</span>
          {l.evidence && <span className="block text-[13px] leading-snug text-muted">{l.evidence}</span>}
        </button>
        <p className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted">
          <span className="shrink-0">
            {whoName(data.bots, l.by)} · {ago(l.updatedAt)}
          </span>
          {conceptTitle && l.conceptId && (
            <Link href={`/ugc/${l.conceptId}`} className="truncate text-[#a8a8a8] underline decoration-white/20 underline-offset-2 hover:text-fg">
              {conceptTitle}
            </Link>
          )}
          {l.strength === "ipotesi" && (
            <button
              onClick={() => patch({ strength: "provato" })}
              disabled={busy}
              className="press -my-2 ml-auto inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-2.5 font-medium whitespace-nowrap text-[#b4b4b4] hover:bg-white/[0.06] hover:text-fg"
            >
              <Icon name="check" className="size-3.5" /> Segna provato
            </button>
          )}
        </p>
      </div>
      <div className="shrink-0 pt-1">
        <button
          onClick={() => patch({ pinned: !l.pinned })}
          disabled={busy}
          aria-pressed={!!l.pinned}
          aria-label={l.pinned ? "Togli dai fissati" : "Fissa in cima"}
          title={l.pinned ? "Fissata" : "Fissa in cima"}
          className={`press grid size-9 place-items-center rounded-full hover:bg-white/[0.06] ${l.pinned ? "text-fg" : "text-muted/60 hover:text-fg"}`}
        >
          <PinIcon className={`size-4 ${l.pinned ? "fill-current" : ""}`} />
        </button>
      </div>
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex shrink-0 self-start rounded-full border border-white/10 p-0.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`press h-8 rounded-full px-3 text-[13px] ${o.value === value ? "bg-white/[0.1] font-semibold text-fg" : "text-muted hover:text-fg"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function LearningForm({ learning, data, onClose }: { learning?: UgcLearning; data: UgcOverview; onClose: () => void }) {
  const [f, setF] = useState({
    kind: learning?.kind ?? ("hook" as LearningKind),
    text: learning?.text ?? "",
    strength: learning?.strength ?? ("ipotesi" as UgcLearning["strength"]),
    evidence: learning?.evidence ?? "",
    conceptId: learning?.conceptId ?? "",
    pinned: learning?.pinned ?? false,
  });
  const { error, busy, run } = useSave(onClose);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const body = { ...f, conceptId: f.conceptId || undefined };

  return (
    <Modal
      title={learning ? "Lezione" : "Nuova lezione"}
      onClose={onClose}
      footer={
        <>
          {learning && (
            <span className="mr-auto">
              <Button
                variant="danger"
                icon="trash"
                onClick={() => confirm("Eliminare questa lezione?") && run(() => send("DELETE", `/api/ugc/learnings/${learning.id}`, undefined, refresh))}
              />
            </span>
          )}
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button
            disabled={!f.text.trim() || busy}
            onClick={() => run(() => (learning ? send("PATCH", `/api/ugc/learnings/${learning.id}`, body, refresh) : send("POST", UGC_LEARNINGS_KEY, body, refresh)))}
          >
            Salva
          </Button>
        </>
      }
    >
      <Field label="Cosa abbiamo imparato">
        <textarea className={`${inputClass} min-h-24 resize-y`} value={f.text} onChange={set("text")} autoFocus={!learning} placeholder="Es. Gli hook con una domanda diretta tengono il 30% in più nei primi 3 secondi" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo">
          <select className={inputClass} value={f.kind} onChange={set("kind")}>
            {LEARNING_KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </Field>
        <Field label="Forza">
          <select className={inputClass} value={f.strength} onChange={set("strength")}>
            <option value="ipotesi">ipotesi</option>
            <option value="provato">provato (dai numeri)</option>
          </select>
        </Field>
      </div>
      <Field label="Prova" hint="numeri, test, esempi">
        <textarea className={`${inputClass} min-h-20 resize-y`} value={f.evidence} onChange={set("evidence")} />
      </Field>
      <Field label="Concept collegato" hint="facoltativo">
        <select className={inputClass} value={f.conceptId} onChange={set("conceptId")}>
          <option value="">— nessuno —</option>
          {data.concepts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex min-h-9 items-center gap-2.5 text-sm">
        <input type="checkbox" className="size-4 accent-white" checked={f.pinned} onChange={(e) => setF((x) => ({ ...x, pinned: e.target.checked }))} />
        Fissa in cima al Playbook
      </label>
      <FormError>{error}</FormError>
    </Modal>
  );
}
