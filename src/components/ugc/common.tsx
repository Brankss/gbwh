"use client";

import type { Bot } from "@/lib/bots";
import { STAGES, stageOf, type StageId, type UgcBrief, type UgcConcept, type UgcLogEntry, type UgcSettings } from "@/lib/ugc";
import type { BriefSummary } from "@/lib/ugc-store";

// Pezzi condivisi dalle pagine della UGC Factory.

/** Risposta di GET /api/ugc. */
export type UgcOverview = {
  byStage: Record<StageId, number>;
  briefs: number;
  videos: number;
  learnings: number;
  settings: UgcSettings;
  log: UgcLogEntry[];
  briefList: BriefSummary[];
  concepts: UgcConcept[];
  bots: Bot[];
};

/** Colore di ogni fase: grigi per il lavoro creativo, argento quando tocca a te, colori per l'esito. */
export const STAGE_TONE: Record<StageId, string> = {
  idea: "#8a8a8a",
  gate: "#c98500",
  script: "#a8a8a8",
  produzione: "#3987e5",
  revisione: "#c98500",
  pronto: "#e8e8e8",
  in_test: "#d55181",
  vincente: "#199e70",
  scartato: "#5a5a5a",
};

export function StageBadge({ stage, small }: { stage: StageId; small?: boolean }) {
  const s = stageOf(stage);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 font-medium whitespace-nowrap ${small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}
    >
      <span className="size-1.5 rounded-full" style={{ background: STAGE_TONE[stage] }} />
      {s.label}
    </span>
  );
}

export const STAGE_ORDER = STAGES.map((s) => s.id);

export const briefTitle = (briefs: (UgcBrief | BriefSummary)[], id: string) => briefs.find((b) => b.id === id)?.title ?? "Brief";
