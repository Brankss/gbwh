"use client";

import { useState } from "react";
import { Button, PageBody, PageHeader, Pills, Section, Segmented } from "@/components/kit";
import { OpenLegend, RankingChart } from "@/components/model-charts";
import { KindTabs, NoModelsData, SourceBar, filterModels, useModels, type OpenScope, type OrgScope } from "@/components/models-common";
import type { ModelKind } from "@/lib/models";

export default function ModelsPage() {
  const { data: res, mutate } = useModels();
  const data = res?.data ?? null;
  const [kind, setKind] = useState<ModelKind>("llm");
  const [org, setOrg] = useState<OrgScope>("seguite");
  const [open, setOpen] = useState<OpenScope>("tutti");
  const [bench, setBench] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  const category = data?.[kind];
  const models = category ? filterModels(category.models, kind, org, open) : [];
  const benchmarks = category?.benchmarks ?? [];
  const main = benchmarks.find((b) => b.key === bench) ?? benchmarks[0];

  return (
    <>
      <PageHeader
        wide
        title="Modelli AI"
        subtitle="I migliori del momento, benchmark alla mano"
        actions={
          <Button href="/modelli/confronta" icon="compare">
            Confronta
          </Button>
        }
      />
      <PageBody wide>
        {/* Cosa guardi (tipo di modello) e da dove arrivano i dati */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <KindTabs
            value={kind}
            onChange={(k) => {
              setKind(k);
              setBench(null);
            }}
            data={data}
          />
          {res && <SourceBar data={data} configured={res.configured} onSynced={() => mutate()} />}
        </div>

        {!res ? (
          <div className="skeleton h-60 rounded-2xl" />
        ) : !category?.models.length ? (
          <NoModelsData configured={res.configured} />
        ) : (
          <>
            <div className="space-y-4">
              {/* Filtri: compatti, con un'etichetta ciascuno */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                {kind === "llm" && (
                  <Segmented
                    label="Aziende"
                    value={org}
                    onChange={setOrg}
                    options={[
                      { value: "seguite", label: "Che segui" },
                      { value: "tutte", label: "Tutte" },
                    ]}
                  />
                )}
                <Segmented
                  label="Licenza"
                  value={open}
                  onChange={setOpen}
                  options={[
                    { value: "tutti", label: "Open e chiusi" },
                    { value: "open", label: "Open weights" },
                    { value: "chiusi", label: "Chiusi" },
                  ]}
                />
              </div>

              {main && (
                <section className="panel overflow-hidden rounded-2xl">
                  {benchmarks.length > 1 && (
                    <div className="border-b border-line px-4 py-3 md:px-5">
                      <Pills label="Benchmark" value={main.key} onChange={setBench} options={benchmarks.map((b) => ({ value: b.key, label: b.label }))} />
                    </div>
                  )}
                  <div className="space-y-5 p-4 md:p-5">
                    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold tracking-tight">{main.label}</h2>
                        {main.description && <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{main.description}</p>}
                      </div>
                      <OpenLegend />
                    </div>
                    <RankingChart models={models} benchmark={main} limit={all ? undefined : 20} />
                  </div>
                  <div className="border-t border-line px-4 py-2.5 md:px-5">
                    <Button small variant="ghost" onClick={() => setAll((a) => !a)}>
                      {all ? "Mostra i primi 20" : "Mostra tutti"}
                    </Button>
                  </div>
                </section>
              )}
            </div>

            {benchmarks.length > 1 && (
              <Section title="Tutti i benchmark">
                <div className="stagger grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {benchmarks.map((b) => (
                    <button
                      key={b.key}
                      onClick={() => {
                        setBench(b.key);
                        document.getElementById("page-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      aria-pressed={b.key === main?.key}
                      className={`panel lift space-y-3 rounded-2xl p-4 text-left ${b.key === main?.key ? "border-white/25!" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{b.label}</span>
                        {b.key === main?.key && <span className="shrink-0 text-xs text-muted">selezionato</span>}
                      </div>
                      <RankingChart models={models} benchmark={b} limit={8} compact />
                    </button>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </PageBody>
    </>
  );
}
