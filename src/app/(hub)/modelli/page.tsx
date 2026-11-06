"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, PageBody, PageHeader, Pills, Section } from "@/components/kit";
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
        title="Modelli AI"
        subtitle="I migliori del momento, benchmark alla mano"
        actions={
          <Link href="/modelli/confronta">
            <Button icon="compare">Confronta</Button>
          </Link>
        }
      />
      <PageBody wide>
        <KindTabs
          value={kind}
          onChange={(k) => {
            setKind(k);
            setBench(null);
          }}
          data={data}
        />
        {res && <SourceBar data={data} configured={res.configured} onSynced={() => mutate()} />}

        {!res ? (
          <div className="h-60 animate-pulse rounded-[1.25rem] bg-surface-2" />
        ) : !category?.models.length ? (
          <NoModelsData configured={res.configured} />
        ) : (
          <>
            <div className="space-y-2">
              {kind === "llm" && (
                <Pills
                  value={org}
                  onChange={setOrg}
                  options={[
                    { value: "seguite", label: "Aziende che segui" },
                    { value: "tutte", label: "Tutte" },
                  ]}
                />
              )}
              <Pills
                value={open}
                onChange={setOpen}
                options={[
                  { value: "tutti", label: "Open e chiusi" },
                  { value: "open", label: "Solo open weights" },
                  { value: "chiusi", label: "Solo chiusi" },
                ]}
              />
              {benchmarks.length > 1 && main && (
                <Pills value={main.key} onChange={setBench} options={benchmarks.map((b) => ({ value: b.key, label: b.label }))} />
              )}
            </div>

            {main && (
              <section className="matte space-y-4 rounded-[1.5rem] p-4 md:p-5">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">{main.label}</h2>
                    {main.description && <p className="text-xs text-muted">{main.description}</p>}
                  </div>
                  <OpenLegend />
                </div>
                <RankingChart models={models} benchmark={main} limit={all ? undefined : 20} />
                <Button small variant="ghost" onClick={() => setAll((a) => !a)}>
                  {all ? "Mostra i primi 20" : "Mostra tutti"}
                </Button>
              </section>
            )}

            {benchmarks.length > 1 && (
              <Section title="Tutti i benchmark">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {benchmarks.map((b) => (
                    <button
                      key={b.key}
                      onClick={() => {
                        setBench(b.key);
                        document.getElementById("page-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className={`matte space-y-2.5 rounded-[1.25rem] p-4 text-left transition-colors hover:bg-[#171717] ${b.key === main?.key ? "ring-1 ring-white/40" : ""}`}
                    >
                      <div className="font-medium">{b.label}</div>
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
