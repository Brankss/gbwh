"use client";

import { useRef, useState } from "react";
import { Button, Empty, PageBody, PageHeader, Section, SectionLink } from "@/components/kit";
import { BriefForm } from "@/components/ugc/brief-form";
import { UGC_KEY, type UgcOverview } from "@/components/ugc/common";
import { NewConcept } from "@/components/ugc/new-concept";
import { teamPulse } from "@/components/ugc/regia-events";
import { Feed } from "@/components/ugc/regia-feed";
import { Live } from "@/components/ugc/regia-live";
import { MoreLinks, Overflow } from "@/components/ugc/regia-more";
import { Numbers } from "@/components/ugc/regia-numbers";
import { StageDrawer } from "@/components/ugc/regia-stage";
import { TeamLive } from "@/components/ugc/regia-team";
import { Workflow, type WorkflowNode } from "@/components/ugc/workflow";
import { useApi, useNow } from "@/lib/client";

// UGC Factory, la regia: prima cosa è successo adesso (live), poi il ciclo a blocchi collegati,
// la squadra, i numeri e il feed. Le sezioni di lavoro (Brief, Playbook, Risultati, Squadra) stanno in fondo.
// I bot lavorano da soli: Branko guarda, e interviene solo se vuole (o se un video è pronto).

const LIVE_REFRESH = 8_000;

/** Da quale istante un evento conta come "appena arrivato" (per animarlo): tutto ciò che è dopo l'ultimo già visto. */
function useFreshSince(top: number | undefined) {
  const [seen, setSeen] = useState<{ top: number | undefined; fresh: number }>({ top, fresh: top ?? Infinity });
  if (seen.top !== top) setSeen({ top, fresh: seen.top === undefined ? (top ?? Infinity) : seen.top });
  return seen.fresh;
}

export default function UgcPage() {
  const { data, error } = useApi<UgcOverview>(UGC_KEY, { refreshInterval: LIVE_REFRESH });
  const now = useNow();
  const freshSince = useFreshSince(data ? (data.log[0]?.at ?? 0) : undefined);
  const [node, setNode] = useState<WorkflowNode | null>(null);
  const drawer = useRef<HTMLDivElement>(null);

  const [newConcept, setNewConcept] = useState(false);
  const [briefForm, setBriefForm] = useState(false);
  // Brief creato partendo da "Nuovo concept" (non c'erano brief): poi si torna al concept.
  const [resume, setResume] = useState(false);
  const openNewBrief = () => {
    setNewConcept(false);
    setResume(true);
    setBriefForm(true);
  };
  const closeBrief = () => {
    setBriefForm(false);
    setResume(false);
  };

  // Scelto un blocco: la lista della fase compare sotto lo schema; su telefono la si porta in vista.
  const pick = (n: WorkflowNode | null) => {
    setNode(n);
    if (n) requestAnimationFrame(() => drawer.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  const pulse = data ? teamPulse(data.settings, data.presence ?? []) : null;
  const subtitle = !pulse
    ? "Regia"
    : !pulse.team.length
      ? "● live · nessun bot in squadra"
      : pulse.online.length
        ? `● live · ${pulse.online.length} bot al lavoro`
        : "● live · squadra a riposo";

  return (
    <>
      <PageHeader
        wide
        title="UGC Factory"
        subtitle={subtitle}
        actions={
          <>
            <span className="hidden sm:contents">
              <Button variant="ghost" icon="plus" onClick={() => setBriefForm(true)}>
                Nuovo brief
              </Button>
            </span>
            <Button icon="plus" onClick={() => setNewConcept(true)} disabled={!data} label="Nuovo concept">
              {/* sotto i 360px resta solo il "+", così il titolo non si tronca */}
              <span className="max-[359px]:hidden sm:hidden">Concept</span>
              <span className="hidden sm:inline">Nuovo concept</span>
            </Button>
            <Overflow
              className="sm:hidden"
              items={[
                { label: "Nuovo brief", icon: "plus", onClick: () => setBriefForm(true) },
                { label: "Brief", icon: "folder", href: "/ugc/brief" },
                { label: "Playbook e libreria", icon: "star", href: "/ugc/playbook" },
                { label: "Risultati", icon: "chart", href: "/ugc/risultati" },
                { label: "Squadra", icon: "sliders", href: "/ugc/squadra" },
              ]}
            />
          </>
        }
      />
      <PageBody wide>
        {error ? (
          <Empty icon="alert" title="Non riesco a caricare la factory">
            {error.message}
          </Empty>
        ) : !data ? (
          <RegiaSkeleton />
        ) : (
          <div className="grid grid-cols-1 gap-8 md:gap-10 lg:grid-cols-12 lg:gap-x-6">
            <div className="min-w-0 lg:order-1 lg:col-span-7 xl:col-span-8">
              <Live data={data} now={now} freshSince={freshSince} onNewBrief={() => setBriefForm(true)} onNewConcept={() => setNewConcept(true)} />
            </div>

            <Section title="Il ciclo" className="min-w-0 lg:order-3 lg:col-span-12">
              <Workflow data={data} selected={node} onSelect={pick} />
              <div ref={drawer} className="scroll-mt-4 pt-1">
                <StageDrawer data={data} node={node} now={now} onClose={() => setNode(null)} />
              </div>
            </Section>

            <Section title="Squadra live" className="min-w-0 lg:order-2 lg:col-span-5 xl:col-span-4" action={<SectionLink href="/ugc/squadra">Gestisci</SectionLink>}>
              <TeamLive data={data} now={now} />
            </Section>

            <Section title="Numeri" className="min-w-0 lg:sticky lg:top-6 lg:order-5 lg:col-span-5 lg:self-start xl:col-span-4" action={<SectionLink href="/ugc/risultati">Risultati</SectionLink>}>
              <Numbers data={data} />
            </Section>

            <Section title="Feed" className="min-w-0 lg:order-4 lg:col-span-7 xl:col-span-8">
              <Feed data={data} now={now} freshSince={freshSince} />
            </Section>

            <Section title="Tutto il resto" className="min-w-0 lg:order-6 lg:col-span-12">
              <MoreLinks data={data} />
            </Section>
          </div>
        )}
      </PageBody>

      {newConcept && data && <NewConcept briefs={data.briefList} onClose={() => setNewConcept(false)} onNewBrief={openNewBrief} />}
      {briefForm && <BriefForm onClose={closeBrief} onSaved={() => resume && setNewConcept(true)} />}
    </>
  );
}

function RegiaSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8 md:gap-10 lg:grid-cols-12 lg:gap-x-6" aria-busy>
      <div className="space-y-3 lg:col-span-7 xl:col-span-8">
        <div className="skeleton h-4 w-16 rounded-full" />
        <div className="skeleton h-52 rounded-[1.25rem]" />
      </div>
      <div className="space-y-3 lg:col-span-5 xl:col-span-4">
        <div className="skeleton h-4 w-24 rounded-full" />
        <div className="skeleton h-52 rounded-[1.25rem]" />
      </div>
      <div className="space-y-3 lg:col-span-12">
        <div className="skeleton h-4 w-20 rounded-full" />
        <div className="skeleton h-44 rounded-[1.25rem]" />
      </div>
    </div>
  );
}
