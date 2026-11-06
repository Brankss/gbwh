"use client";

import { formatScore, type Benchmark, type ModelEntry } from "@/lib/models";

/**
 * Palette categorica (validata con lo script dataviz sullo sfondo scuro #141414):
 * 6 slot fissi, assegnati al modello quando lo scegli e mai ricolorati.
 */
export const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300"] as const;
const OPEN_COLOR = SERIES[1];
const CLOSED_COLOR = SERIES[0];

export function sortedFor(models: ModelEntry[], b: Benchmark) {
  return models
    .filter((m) => m.scores[b.key] !== undefined)
    .sort((x, y) => (b.higherIsBetter ? y.scores[b.key] - x.scores[b.key] : x.scores[b.key] - y.scores[b.key]));
}

export function OpenLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[3px]" style={{ background: CLOSED_COLOR }} /> Chiuso
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[3px]" style={{ background: OPEN_COLOR }} /> Open weights
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[3px] border border-line" /> Non dichiarato
      </span>
    </div>
  );
}

/** Classifica a barre orizzontali per un benchmark: colore = open/chiuso, tooltip al passaggio o al tocco. */
export function RankingChart({ models, benchmark, limit, compact }: { models: ModelEntry[]; benchmark: Benchmark; limit?: number; compact?: boolean }) {
  const ranked = sortedFor(models, benchmark);
  const shown = limit ? ranked.slice(0, limit) : ranked;
  const max = Math.max(...ranked.map((m) => m.scores[benchmark.key]), 0) || 1;

  if (!shown.length) return <p className="text-sm text-muted">Nessun modello con questo dato.</p>;

  return (
    <ol className={compact ? "space-y-1" : "space-y-1.5"} aria-label={`Classifica ${benchmark.label}`}>
      {shown.map((m, i) => {
        const v = m.scores[benchmark.key];
        const color = m.open === true ? OPEN_COLOR : m.open === false ? CLOSED_COLOR : undefined;
        return (
          <li
            key={m.id}
            tabIndex={compact ? undefined : 0}
            className={`group relative grid items-center gap-2 rounded-lg outline-none focus-visible:ring-1 focus-visible:ring-white/30 ${
              compact ? "grid-cols-[minmax(0,7.5rem)_1fr_3rem] text-xs" : "grid-cols-[1.5rem_minmax(0,11rem)_1fr_3.5rem] text-sm"
            }`}
          >
            {!compact && <span className="text-right text-xs text-muted tabular-nums">{i + 1}</span>}
            <span className="truncate" title={m.name}>
              {m.name}
            </span>
            <span className="relative h-2.5">
              <span
                className="absolute inset-y-0 left-0 rounded-r-[4px] transition-[width] duration-500"
                style={{
                  width: `${Math.max(2, (v / max) * 100)}%`,
                  background: color ?? "transparent",
                  border: color ? undefined : "1px solid var(--muted)",
                }}
              />
            </span>
            <span className="text-right text-muted tabular-nums">{formatScore(v, benchmark.unit)}</span>

            {/* Tooltip */}
            <span className="pointer-events-none absolute bottom-full left-6 z-10 mb-1 hidden w-max max-w-[16rem] rounded-xl border border-line bg-[#0b0b0b] px-3 py-2 text-xs shadow-xl group-hover:block group-focus:block">
              <span className="block font-medium text-fg">{m.name}</span>
              <span className="block text-muted">
                {m.org} · {m.open === true ? "open weights" : m.open === false ? "chiuso" : "licenza non dichiarata"}
                {m.openGuessed ? " (stimato)" : ""}
              </span>
              <span className="mt-1 block text-fg">
                {benchmark.label}: {formatScore(v, benchmark.unit)} · #{i + 1} di {ranked.length}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Confronto: per ogni benchmark una barra per modello scelto, ognuno col suo colore fisso. */
export function CompareGroup({
  benchmark,
  picks,
  max,
}: {
  benchmark: Benchmark;
  picks: { model: ModelEntry; slot: number }[];
  max: number;
}) {
  const withValue = picks.filter((p) => p.model.scores[benchmark.key] !== undefined);
  const best = withValue.length
    ? withValue.reduce((a, b) =>
        benchmark.higherIsBetter
          ? b.model.scores[benchmark.key] > a.model.scores[benchmark.key] ? b : a
          : b.model.scores[benchmark.key] < a.model.scores[benchmark.key] ? b : a,
      )
    : null;

  return (
    <div className="matte space-y-2.5 rounded-[1.25rem] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-medium">{benchmark.label}</h3>
        <span className="text-[11px] text-muted">{benchmark.higherIsBetter ? "più alto è meglio" : "più basso è meglio"}</span>
      </div>
      {benchmark.description && <p className="-mt-1.5 text-xs text-muted">{benchmark.description}</p>}
      <ul className="space-y-[2px]">
        {picks.map(({ model, slot }) => {
          const v = model.scores[benchmark.key];
          return (
            <li key={model.id} className="grid grid-cols-[minmax(0,8rem)_1fr_3.5rem] items-center gap-2 text-sm">
              <span className="truncate text-xs text-muted" title={model.name}>
                {model.name}
              </span>
              <span className="relative h-3">
                {v !== undefined && (
                  <span
                    className="absolute inset-y-0 left-0 rounded-r-[4px] transition-[width] duration-500"
                    style={{ width: `${Math.max(2, (v / max) * 100)}%`, background: SERIES[slot] }}
                    title={`${model.name}: ${formatScore(v, benchmark.unit)}`}
                  />
                )}
              </span>
              <span className={`text-right text-xs tabular-nums ${best?.model.id === model.id ? "font-semibold text-fg" : "text-muted"}`}>
                {v === undefined ? "n.d." : formatScore(v, benchmark.unit)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
