"use client";

import { useState } from "react";
import { Button, Empty, PageBody, PageHeader } from "@/components/kit";
import { BriefForm } from "@/components/ugc/brief-form";
import { BriefList } from "@/components/ugc/briefs";
import { Chain } from "@/components/ugc/chain";
import { SkeletonRows, UGC_KEY, type UgcOverview } from "@/components/ugc/common";
import { NewConcept } from "@/components/ugc/new-concept";
import { Playbook } from "@/components/ugc/playbook";
import { ReadyStrip } from "@/components/ugc/ready";
import { Results } from "@/components/ugc/results";
import { Team } from "@/components/ugc/team";
import { useApi } from "@/lib/client";
import { ACTIVE_STAGES } from "@/lib/ugc";
import type { BriefSummary } from "@/lib/ugc-store";

type Tab = "catena" | "brief" | "playbook" | "risultati" | "squadra";

export default function UgcPage() {
  const { data, error } = useApi<UgcOverview>(UGC_KEY, { refreshInterval: 30_000 });
  const [tab, setTab] = useState<Tab>("catena");
  const [newConcept, setNewConcept] = useState(false);
  const [briefForm, setBriefForm] = useState<BriefSummary | "new" | null>(null);

  const live = data ? ACTIVE_STAGES.reduce((n, s) => n + data.byStage[s], 0) : undefined;
  // Brief creato partendo da "Nuovo concept" (non c'erano brief): poi si torna al concept.
  const [resume, setResume] = useState(false);
  const openNewBrief = () => {
    setNewConcept(false);
    setResume(true);
    setBriefForm("new");
  };
  const closeBrief = () => {
    setBriefForm(null);
    setResume(false);
  };
  const afterBrief = () => {
    if (resume) setNewConcept(true);
  };

  return (
    <>
      <PageHeader
        wide
        title="UGC Factory"
        subtitle="La catena dei video UGC"
        actions={
          <>
            <span className="hidden sm:contents">
              <Button variant="ghost" icon="plus" onClick={() => setBriefForm("new")}>
                Nuovo brief
              </Button>
            </span>
            <Button icon="plus" onClick={() => setNewConcept(true)} disabled={!data}>
              <span className="sm:hidden">Concept</span>
              <span className="hidden sm:inline">Nuovo concept</span>
            </Button>
          </>
        }
      />
      <PageBody wide>
        {error ? (
          <Empty icon="alert" title="Non riesco a caricare la factory">
            {error.message}
          </Empty>
        ) : (
          <>
            {data && <ReadyStrip data={data} />}

            {/* 5 sezioni a larghezza piena: su telefono ci stanno tutte senza scorrere di lato */}
            <div role="tablist" className="matte grid grid-cols-5 gap-1 rounded-2xl p-1">
              {(
                [
                  ["catena", "Catena", live],
                  ["brief", "Brief", data?.briefList.length],
                  ["playbook", "Playbook", undefined],
                  ["risultati", "Risultati", undefined],
                  ["squadra", "Squadra", undefined],
                ] as const
              ).map(([value, label, count]) => (
                <button
                  key={value}
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                  className={`press h-9 min-w-0 truncate rounded-xl px-1 text-[12px] font-medium min-[400px]:text-[13px] sm:text-sm ${
                    tab === value ? "gloss text-fg" : "border border-transparent text-muted hover:bg-white/[0.04] hover:text-fg"
                  }`}
                >
                  {label}
                  {count !== undefined && count > 0 && <span className="ml-1 hidden text-xs text-muted tabular-nums sm:inline">{count}</span>}
                </button>
              ))}
            </div>

            {!data ? (
              <SkeletonRows rows={4} />
            ) : tab === "catena" ? (
              <Chain data={data} />
            ) : tab === "brief" ? (
              <BriefList briefs={data.briefList} onNew={() => setBriefForm("new")} onEdit={setBriefForm} />
            ) : tab === "playbook" ? (
              <Playbook data={data} />
            ) : tab === "risultati" ? (
              <Results />
            ) : (
              <Team data={data} />
            )}
          </>
        )}
      </PageBody>

      {newConcept && data && <NewConcept briefs={data.briefList} onClose={() => setNewConcept(false)} onNewBrief={openNewBrief} />}
      {briefForm && <BriefForm brief={briefForm === "new" ? undefined : briefForm} onClose={closeBrief} onSaved={afterBrief} />}
    </>
  );
}
