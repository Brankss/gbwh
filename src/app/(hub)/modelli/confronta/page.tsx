"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Empty, IconButton, PageBody, PageHeader, Tabs, inputClass } from "@/components/kit";
import { CompareGroup, SERIES } from "@/components/model-charts";
import { KindTabs, NoModelsData, SourceBar, useModels } from "@/components/models-common";
import { formatScore, type ModelKind } from "@/lib/models";

const MAX_PICKS = SERIES.length;
const STORAGE = "models:compare";

/** Slot fissi: ogni modello scelto tiene il suo colore anche se ne togli un altro. */
type Slots = (string | null)[];

function readSlots(): Record<ModelKind, Slots> {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { llm: [], image: [], video: [] };
}

export default function ComparePage() {
  const { data: res, mutate } = useModels();
  const data = res?.data ?? null;
  const [kind, setKind] = useState<ModelKind>("llm");
  const [slotsByKind, setSlotsByKind] = useState<Record<ModelKind, Slots>>(readSlots);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grafici" | "tabella">("grafici");

  const category = data?.[kind];
  const slots = useMemo(() => slotsByKind[kind] ?? [], [slotsByKind, kind]);
  const save = (next: Slots) => {
    const all = { ...slotsByKind, [kind]: next };
    setSlotsByKind(all);
    try {
      localStorage.setItem(STORAGE, JSON.stringify(all));
    } catch {}
  };

  const picks = useMemo(
    () =>
      slots
        .map((id, slot) => ({ slot, model: category?.models.find((m) => m.id === id) }))
        .filter((p): p is { slot: number; model: NonNullable<typeof p.model> } => !!p.model),
    [slots, category],
  );

  const toggle = (id: string) => {
    const at = slots.indexOf(id);
    if (at >= 0) {
      const next = [...slots];
      next[at] = null; // libera lo slot senza ricolorare gli altri
      return save(next);
    }
    const free = slots.findIndex((s) => s === null);
    if (free >= 0) {
      const next = [...slots];
      next[free] = id;
      return save(next);
    }
    if (slots.length < MAX_PICKS) save([...slots, id]);
  };

  const results = (category?.models ?? [])
    .filter((m) => `${m.name} ${m.org}`.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 40);
  const benchmarks = (category?.benchmarks ?? []).filter((b) => picks.some((p) => p.model.scores[b.key] !== undefined));
  const maxOf = (key: string) => Math.max(...(category?.models ?? []).map((m) => m.scores[key] ?? 0), 0) || 1;

  return (
    <>
      <PageHeader
        wide
        title="Confronta modelli"
        subtitle={`Scegli fino a ${MAX_PICKS} modelli`}
        back={<IconButton href="/modelli" icon="back" label="Modelli" />}
      />
      <PageBody wide>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <KindTabs value={kind} onChange={setKind} data={data} />
          {res && <SourceBar data={data} configured={res.configured} onSynced={() => mutate()} />}
        </div>

        {!res ? (
          <div className="skeleton h-60 rounded-2xl" />
        ) : !category?.models.length ? (
          <NoModelsData configured={res.configured} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-8">
            {/* Scelta modelli */}
            <aside className="space-y-3">
              {picks.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label="Legenda">
                  {picks.map(({ model, slot }) => (
                    <li key={model.id} className="flex h-8 items-center gap-1.5 rounded-full bg-white/[0.06] pr-0.5 pl-2.5 text-[13px] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]">
                      <span className="size-2.5 rounded-[3px]" style={{ background: SERIES[slot] }} />
                      <span className="max-w-[10rem] truncate">{model.name}</span>
                      <button onClick={() => toggle(model.id)} aria-label={`Togli ${model.name}`} className="hit grid size-7 place-items-center rounded-full text-muted hover:bg-white/[0.08] hover:text-fg">
                        <Icon name="close" className="size-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <input className={inputClass} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca modello o azienda…" />
              <ul className="panel scroll-thin max-h-[50dvh] space-y-px overflow-y-auto rounded-2xl p-1.5 lg:max-h-[65dvh]">
                {results.map((m) => {
                  const slot = slots.indexOf(m.id);
                  const full = slot < 0 && picks.length >= MAX_PICKS;
                  return (
                    <li key={m.id}>
                      <button
                        onClick={() => toggle(m.id)}
                        disabled={full}
                        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-white/[0.05] disabled:opacity-40"
                      >
                        <span
                          className={`grid size-5 shrink-0 place-items-center rounded-full text-white ${slot >= 0 ? "" : "border border-white/20"}`}
                          style={slot >= 0 ? { background: SERIES[slot] } : undefined}
                        >
                          {slot >= 0 && <Icon name="check" className="size-3" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{m.name}</span>
                          <span className="block text-[11px] text-muted">
                            {m.org}
                            {m.open === true ? " · open" : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
                {!results.length && <li className="px-3 py-2 text-sm text-muted">Nessun modello trovato</li>}
              </ul>
            </aside>

            {/* Risultati */}
            <div className="min-w-0 space-y-4">
              {picks.length === 0 ? (
                <Empty icon="compare" title="Scegli i modelli da confrontare">
                  Ogni modello ha il suo colore fisso: lo ritrovi uguale in tutti i grafici.
                </Empty>
              ) : (
                <>
                  <Tabs
                    value={view}
                    onChange={setView}
                    options={[
                      { value: "grafici", label: "Grafici" },
                      { value: "tabella", label: "Tabella" },
                    ]}
                  />
                  {view === "grafici" ? (
                    <div className="grid gap-3 xl:grid-cols-2">
                      {benchmarks.map((b) => (
                        <CompareGroup key={b.key} benchmark={b} picks={picks} max={maxOf(b.key)} />
                      ))}
                    </div>
                  ) : (
                    <div className="panel overflow-x-auto rounded-2xl">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-line text-left text-xs text-muted">
                            <th className="px-4 py-3 font-medium">Benchmark</th>
                            {picks.map(({ model, slot }) => (
                              <th key={model.id} className="px-3 py-3 text-right font-medium whitespace-nowrap">
                                <span className="mr-1.5 inline-block size-2 rounded-[2px]" style={{ background: SERIES[slot] }} />
                                {model.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {benchmarks.map((b) => (
                            <tr key={b.key} className="border-b border-line last:border-0">
                              <td className="px-4 py-2.5 whitespace-nowrap">{b.label}</td>
                              {picks.map(({ model }) => (
                                <td key={model.id} className="px-3 py-2.5 text-right text-muted tabular-nums">
                                  {model.scores[b.key] === undefined ? "—" : formatScore(model.scores[b.key], b.unit)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}
