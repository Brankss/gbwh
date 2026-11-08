"use client";

import Link from "next/link";
import { useState } from "react";
import { Empty, Pills } from "@/components/kit";
import { eur, useApi } from "@/lib/client";
import { summarize, type UgcConcept, type UgcResult, type UgcVideo } from "@/lib/ugc";
import { GROUP, ROW_LINK, STAGE_TONE, SkeletonRows, UGC_VIDEOS_KEY, fmtPct, fmtRoas } from "./common";

// Tab "Risultati": una riga per video, con i numeri sommati di tutte le piattaforme e i giorni.

type Item = { video: UgcVideo; concept: UgcConcept | null; results: UgcResult[] };
type SortKey = "roas" | "spend" | "hookRate" | "ctr" | "recenti";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "roas", label: "ROAS" },
  { value: "spend", label: "Spesa" },
  { value: "hookRate", label: "Hook rate" },
  { value: "ctr", label: "CTR" },
  { value: "recenti", label: "Recenti" },
];

export function Results() {
  const { data } = useApi<{ items: Item[] }>(UGC_VIDEOS_KEY);
  const [sort, setSort] = useState<SortKey>("roas");

  if (!data) return <SkeletonRows rows={4} />;
  if (!data.items.length) {
    return (
      <Empty icon="chart" title="Ancora nessun video">
        Quando il producer carica un video e arrivano i primi numeri (spesa, hook rate, CTR, ROAS), li trovi qui.
      </Empty>
    );
  }

  const rows = data.items.map((it) => ({ ...it, sum: summarize(it.results), platforms: [...new Set(it.results.map((r) => r.platform))] }));
  const value = (r: (typeof rows)[number]) => (sort === "recenti" ? r.video.createdAt : r.sum[sort]);
  // Chi non ha ancora numeri va in fondo, qualunque sia l'ordine.
  rows.sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === undefined && vb === undefined) return b.video.createdAt - a.video.createdAt;
    if (va === undefined) return 1;
    if (vb === undefined) return -1;
    return vb - va;
  });

  const all = summarize(data.items.flatMap((i) => i.results));
  const withNumbers = rows.filter((r) => r.results.length).length;

  return (
    <div className="space-y-4">
      <div className={`${GROUP} grid grid-cols-3 divide-x divide-y-0!`}>
        <Total label="Spesa" value={eur(all.spend)} />
        <Total label="Ricavi" value={eur(all.revenue)} />
        <Total label="ROAS" value={fmtRoas(all.roas)} />
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden shrink-0 text-xs text-muted sm:inline">Ordina per</span>
        <div className="min-w-0 flex-1">
          <Pills value={sort} onChange={setSort} options={SORTS} />
        </div>
      </div>

      <div className={GROUP}>
        {/* intestazione colonne (solo desktop) */}
        <div className="hidden grid-cols-[minmax(0,1fr)_repeat(4,6.5rem)] gap-3 px-4 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase md:grid">
          <span>Video</span>
          {(["spend", "hookRate", "ctr", "roas"] as const).map((k) => (
            <button key={k} onClick={() => setSort(k)} className={`text-right uppercase hover:text-fg ${sort === k ? "text-fg" : ""}`}>
              {SORTS.find((s) => s.value === k)!.label}
              {sort === k ? " ↓" : ""}
            </button>
          ))}
        </div>
        {rows.map((r) => (
          <Link
            key={r.video.id}
            href={r.concept ? `/ugc/${r.concept.id}` : "#"}
            className={`${ROW_LINK} md:grid md:grid-cols-[minmax(0,1fr)_repeat(4,6.5rem)] md:items-center md:gap-3`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {r.concept && <span className="size-1.5 shrink-0 rounded-full" style={{ background: STAGE_TONE[r.concept.stage] }} />}
                <span className="truncate text-[15px] font-medium">{r.concept?.title ?? "Concept eliminato"}</span>
                <span className="shrink-0 rounded-full bg-white/[0.08] px-1.5 py-px text-[11px] font-semibold text-[#c4c4c4] tabular-nums">v{r.video.version}</span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted">
                {r.platforms.length ? r.platforms.join(" · ") : "nessun numero ancora"}
                {r.sum.days ? ` · ${r.sum.days} ${r.sum.days === 1 ? "giorno" : "giorni"}` : ""}
              </p>
            </div>
            <div className={`mt-2.5 grid-cols-4 gap-2 md:contents ${r.results.length ? "grid" : "hidden"}`}>
              <Metric label="Spesa" value={eur(r.sum.spend)} on={sort === "spend"} />
              <Metric label="Hook" value={fmtPct(r.sum.hookRate)} on={sort === "hookRate"} />
              <Metric label="CTR" value={fmtPct(r.sum.ctr)} on={sort === "ctr"} />
              <Metric label="ROAS" value={fmtRoas(r.sum.roas)} on={sort === "roas"} strong />
            </div>
          </Link>
        ))}
      </div>
      <p className="text-xs text-muted">
        {rows.length} video, {withNumbers} con numeri. Hook rate e CTR sono medie pesate sulle impression.
      </p>
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-line px-3 py-3 sm:px-4">
      <div className="text-[11px] font-semibold tracking-[0.1em] text-[#a8a8a8] uppercase">{label}</div>
      <div className="mt-1 truncate text-lg font-bold tracking-tight tabular-nums sm:text-xl">{value}</div>
    </div>
  );
}

function Metric({ label, value, on, strong }: { label: string; value: string; on?: boolean; strong?: boolean }) {
  return (
    <div className="min-w-0 md:text-right">
      <div className="text-[10px] font-semibold tracking-[0.08em] text-muted uppercase md:hidden">{label}</div>
      <div className={`truncate text-sm tabular-nums ${value === "—" ? "text-muted/70" : on || strong ? "font-semibold text-fg" : "text-[#c4c4c4]"}`}>{value}</div>
    </div>
  );
}
