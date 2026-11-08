"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { Pills } from "@/components/kit";
import { FORMATS, HOOK_TYPES, PRINCIPLES, REVIEW_RUBRIC, SCRIPT_RULES, type Format, type RubricItem } from "@/lib/ugc-library";
import { GROUP, Tag } from "./common";

// La libreria creativa (src/lib/ugc-library.ts), in sola lettura: il "gusto" che i bot seguono.

type Part = "format" | "hook" | "principi" | "critico" | "script";

const STAGE_LABEL: Record<RubricItem["stage"], string> = { gate: "gate", revisione: "video", entrambi: "gate e video" };

export function Library() {
  const [part, setPart] = useState<Part>("format");
  return (
    <div className="space-y-3">
      <Pills
        value={part}
        onChange={setPart}
        options={[
          { value: "format", label: "Format", count: FORMATS.length },
          { value: "hook", label: "Hook", count: HOOK_TYPES.length },
          { value: "principi", label: "Principi", count: PRINCIPLES.length },
          { value: "critico", label: "Critico", count: REVIEW_RUBRIC.length },
          { value: "script", label: "Script", count: SCRIPT_RULES.length },
        ]}
      />
      {part === "format" && <Formats />}
      {part === "hook" && <Hooks />}
      {part === "principi" && <Principles />}
      {part === "critico" && <Rubric />}
      {part === "script" && <ScriptRules />}
    </div>
  );
}

const Soon = () => <p className="rounded-[1.25rem] border border-dashed border-white/10 px-4 py-6 text-center text-sm text-muted">In preparazione.</p>;

function Formats() {
  const [open, setOpen] = useState<string | null>(null);
  if (!FORMATS.length) return <Soon />;
  return (
    <div className={GROUP}>
      {FORMATS.map((f) => (
        <FormatRow key={f.id} f={f} open={open === f.id} onToggle={() => setOpen(open === f.id ? null : f.id)} />
      ))}
    </div>
  );
}

function FormatRow({ f, open, onToggle }: { f: Format; open: boolean; onToggle: () => void }) {
  const hasMore = f.structure.length > 0 || !!f.example || f.pitfalls.length > 0;
  return (
    <div>
      <button
        onClick={onToggle}
        disabled={!hasMore}
        aria-expanded={hasMore ? open : undefined}
        className="flex min-h-12 w-full items-start gap-3 px-4 py-3 text-left transition-colors enabled:hover:bg-white/[0.035]"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">{f.name}</span>
          {f.when && <span className={`mt-0.5 block text-[13px] leading-snug text-muted ${open ? "" : "line-clamp-2"}`}>{f.when}</span>}
        </span>
        {hasMore && <Icon name="forward" className={`mt-1 size-4 shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`} />}
      </button>
      {open && (
        <div className="space-y-4 px-4 pb-4">
          {f.structure.length > 0 && (
            <Block title="Struttura">
              <ol className="space-y-1.5">
                {f.structure.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-snug">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[11px] font-semibold tabular-nums">{i + 1}</span>
                    <span className="pt-px">{s}</span>
                  </li>
                ))}
              </ol>
            </Block>
          )}
          {f.example && (
            <Block title="Esempio">
              <p className="border-l border-white/15 pl-3 text-sm leading-relaxed text-[#c4c4c4]">{f.example}</p>
            </Block>
          )}
          {f.pitfalls.length > 0 && (
            <Block title="Cosa lo rovina">
              <Bullets items={f.pitfalls} tone="#ec8585" />
            </Block>
          )}
        </div>
      )}
    </div>
  );
}

function Hooks() {
  if (!HOOK_TYPES.length) return <Soon />;
  return (
    <div className={GROUP}>
      {HOOK_TYPES.map((h) => (
        <div key={h.id} className="space-y-1.5 px-4 py-3">
          <p className="text-[15px] font-medium">{h.name}</p>
          {h.why && <p className="text-[13px] leading-snug text-muted">{h.why}</p>}
          {h.examples.length > 0 && (
            <ul className="space-y-1 pt-0.5">
              {h.examples.map((e, i) => (
                <li key={i} className="border-l border-white/15 pl-2.5 text-[13px] leading-snug text-[#c4c4c4]">
                  “{e}”
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function Principles() {
  if (!PRINCIPLES.length) return <Soon />;
  return (
    <ol className={GROUP}>
      {PRINCIPLES.map((p, i) => (
        <li key={i} className="flex gap-3 px-4 py-3">
          <span className="w-5 shrink-0 pt-0.5 text-right text-xs text-muted tabular-nums">{i + 1}</span>
          <span className="min-w-0 space-y-0.5">
            <span className="block text-[15px] font-medium">{p.title}</span>
            {p.text && <span className="block text-[13px] leading-snug text-muted">{p.text}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Rubric() {
  if (!REVIEW_RUBRIC.length) return <Soon />;
  return (
    <ul className={GROUP}>
      {REVIEW_RUBRIC.map((r) => (
        <li key={r.id} className="flex items-start gap-3 px-4 py-3">
          <span className="min-w-0 flex-1 text-sm leading-snug">{r.question}</span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            <Tag>{STAGE_LABEL[r.stage]}</Tag>
            <Weight value={r.weight} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Weight({ value }: { value: number }) {
  // Pesi piccoli (1–5) come tacche; qualsiasi altra scala come numero.
  if (!(value >= 1 && value <= 5 && Number.isInteger(value))) return <span className="text-[11px] text-muted tabular-nums">peso {value}</span>;
  const n = value;
  return (
    <span className="flex gap-0.5" aria-label={`peso ${value}`} title={`peso ${value}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`h-1 w-2.5 rounded-full ${i < n ? "bg-[#d4d4d4]" : "bg-white/10"}`} />
      ))}
    </span>
  );
}

function ScriptRules() {
  if (!SCRIPT_RULES.length) return <Soon />;
  return (
    <ol className={GROUP}>
      {SCRIPT_RULES.map((r, i) => (
        <li key={i} className="flex gap-3 px-4 py-3 text-sm leading-snug">
          <span className="w-5 shrink-0 text-right text-xs text-muted tabular-nums">{i + 1}</span>
          <span className="min-w-0">{r}</span>
        </li>
      ))}
    </ol>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-[#a8a8a8] uppercase">{title}</p>
      {children}
    </div>
  );
}

function Bullets({ items, tone }: { items: string[]; tone: string }) {
  return (
    <ul className="space-y-1.5">
      {items.map((s, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-snug">
          <span className="mt-[0.45rem] size-1.5 shrink-0 rounded-full" style={{ background: tone }} />
          {s}
        </li>
      ))}
    </ul>
  );
}
