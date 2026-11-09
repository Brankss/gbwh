"use client";

import { useState, type ReactNode } from "react";
import type { Bot } from "@/lib/bots";
import type { PresenceView } from "@/lib/presence";
import { STAGES, stageOf, type StageId, type UgcBrief, type UgcConcept, type UgcLogEntry, type UgcQuestion, type UgcSettings } from "@/lib/ugc";
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
  /** Domande dei bot (rare): aperte, con risposta, chiuse da poco. */
  questions: UgcQuestion[];
  /** Ultimo segnale di vita dei bot (heartbeat): online se recente, e cosa stanno facendo. */
  presence: PresenceView[];
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

/* ------------------------------------------------------------------ */
/* Chiavi SWR, nomi e formati condivisi dalle pagine /ugc               */
/* ------------------------------------------------------------------ */

export const UGC_KEY = "/api/ugc";
export const UGC_VIDEOS_KEY = "/api/ugc/videos";
export const UGC_LEARNINGS_KEY = "/api/ugc/learnings";
export const briefKey = (id: string) => `/api/ugc/briefs/${id}`;

/** Nome leggibile di chi ha fatto qualcosa: "tu" è Branko, gli altri sono bot. */
export const whoName = (bots: Bot[] | undefined, id: string | undefined | null) =>
  !id ? "—" : id === "tu" ? "Branko" : (bots?.find((b) => b.id === id)?.name ?? id);

/** Come whoName, ma per un bot non ancora in bacheca usa il nome che manda col segnale di vita. */
export function nameOf(data: Pick<UgcOverview, "bots" | "presence">, id: string | undefined | null) {
  if (!id || id === "tu" || data.bots.some((b) => b.id === id)) return whoName(data.bots, id);
  return data.presence?.find((p) => p.agent === id.toLowerCase())?.name || id;
}

/** Chi lavora in una fase: tu, il bot assegnato al ruolo, oppure nessuno. */
export function stageTurn(stage: StageId, settings: UgcSettings | undefined, bots: Bot[] | undefined) {
  const role = stageOf(stage).role as string | null;
  if (role === "tu") return { role: "Tu", who: "Tocca a te", assigned: true };
  if (!role) return { role: "", who: "", assigned: false };
  const bot = settings?.roles[role as keyof UgcSettings["roles"]];
  return { role: role[0].toUpperCase() + role.slice(1), who: bot ? whoName(bots, bot) : "nessuno assegnato", assigned: !!bot };
}

/** L'hook scelto del concept (o il primo, se nessuno è segnato). */
export const chosenHook = (c: UgcConcept) => c.hooks.find((h) => h.chosen) ?? c.hooks[0];

const nf = (digits: number) => new Intl.NumberFormat("it-IT", { maximumFractionDigits: digits, minimumFractionDigits: digits });
export const fmtRoas = (n?: number) => (n === undefined ? "—" : `${nf(2).format(n)}×`);
export const fmtPct = (n?: number) => (n === undefined ? "—" : `${nf(1).format(n)}%`);

/** Contenitore unico per un gruppo: righe separate da un filo, niente pila di card. */
export const GROUP = "matte divide-y divide-line overflow-hidden rounded-[1.25rem]";
/** Riga cliccabile dentro un GROUP. */
export const ROW_LINK = "block px-4 py-3 transition-colors hover:bg-white/[0.035] focus-visible:bg-white/[0.05] focus-visible:outline-none";

/** Salvataggio di un modale: stato occupato, errore leggibile, chiusura a fine lavoro. */
export function useSave(onDone?: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onDone?.();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, run, setError };
}

export function FormError({ children }: { children?: ReactNode }) {
  return children ? <p className="rounded-xl border border-[#e66767]/25 bg-[#e66767]/[0.07] px-3 py-2 text-sm text-[#ec8585]">{children}</p> : null;
}

/** Piccola etichetta neutra (tipo, stato, piattaforma). */
export function Tag({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${
        strong ? "bg-white/[0.12] text-fg" : "border border-white/10 text-[#a8a8a8]"
      }`}
    >
      {children}
    </span>
  );
}

/** Righe finte mentre arrivano i dati, nello stesso contenitore delle righe vere. */
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className={`${GROUP} animate-pulse`} aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-2 px-4 py-3.5">
          <div className="h-3.5 w-2/3 rounded-full bg-white/[0.06]" />
          <div className="h-3 w-1/3 rounded-full bg-white/[0.04]" />
        </div>
      ))}
    </div>
  );
}

/** Interruttore acceso/spento (area di tocco ≥ 36px). */
export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="press grid h-9 w-12 shrink-0 place-items-center"
    >
      <span className={`relative h-6 w-10 rounded-full transition-colors ${on ? "chrome border-0!" : "bg-white/[0.08] ring-1 ring-white/10"}`}>
        <span
          className={`absolute top-0.5 size-5 rounded-full shadow transition-all ${on ? "left-[1.125rem] bg-black" : "left-0.5 bg-[#8c8c8c]"}`}
        />
      </span>
    </button>
  );
}

/** Freccia del "Indietro" nelle pagine di dettaglio. */
export const BACK_CLASS = "grid size-9 shrink-0 place-items-center press rounded-full text-[#b4b4b4] hover:bg-white/[0.07] hover:text-fg";
