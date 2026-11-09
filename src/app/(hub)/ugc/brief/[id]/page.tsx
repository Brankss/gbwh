"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { Button, Empty, PageBody, PageHeader, Section } from "@/components/kit";
import { BriefForm } from "@/components/ugc/brief-form";
import {
  BACK_CLASS,
  FormError,
  GROUP,
  ROW_LINK,
  SkeletonRows,
  StageBadge,

  UGC_KEY,
  briefKey,
  chosenHook,
  useSave,
  whoName,
  type UgcOverview,
} from "@/components/ugc/common";
import { NewConcept } from "@/components/ugc/new-concept";
import { ResearchSection } from "@/components/ugc/research";
import { ago, send, useApi } from "@/lib/client";
import { STAGE_IDS, type UgcBrief, type UgcConcept, type UgcResearch } from "@/lib/ugc";
import { formatOf } from "@/lib/ugc-library";

type Full = { brief: UgcBrief; research: UgcResearch[]; concepts: UgcConcept[] };

export default function BriefPageShell() {
  // L'id arriva dall'URL solo a runtime: la pagina vera sta dentro <Suspense>.
  return (
    <Suspense fallback={<div className="m-6 h-40 skeleton rounded-[1.25rem]" />}>
      <BriefPage />
    </Suspense>
  );
}

const back = (
  <Link href="/ugc/brief" aria-label="Tutti i brief" className={BACK_CLASS}>
    <Icon name="back" />
  </Link>
);

function BriefPage() {
  const { id } = useParams<{ id: string }>();
  const key = briefKey(id);
  const { data, error } = useApi<Full>(key, { refreshInterval: 30_000 });
  const overview = useApi<UgcOverview>(UGC_KEY);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);

  if (error) {
    return (
      <>
        <PageHeader title="Brief" back={back} />
        <PageBody>
          <Empty icon="folder" title="Brief non trovato">
            <Link href="/ugc" className="underline underline-offset-2">
              Torna alla UGC Factory
            </Link>
          </Empty>
        </PageBody>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <PageHeader title="…" back={back} />
        <PageBody>
          <SkeletonRows rows={5} />
        </PageBody>
      </>
    );
  }

  const { brief, research, concepts } = data;
  const bots = overview.data?.bots;
  const order = (c: UgcConcept) => STAGE_IDS.indexOf(c.stage);
  const sorted = [...concepts].sort((a, b) => order(a) - order(b) || b.updatedAt - a.updatedAt);

  return (
    <>
      <PageHeader
        title={brief.title}
        subtitle={`${brief.productName} · ${brief.status}`}
        back={back}
        actions={
          <>
            <Button variant="ghost" onClick={() => setEditing(true)}>
              Modifica
            </Button>
            <span className="hidden sm:contents">
              <Button icon="plus" onClick={() => setCreating(true)}>
                Nuovo concept
              </Button>
            </span>
          </>
        }
      />
      <PageBody>
        <Section title="Brief">
          <dl className={GROUP}>
            <Row label="Prodotto">
              {brief.productName}
              {brief.productUrl && (
                <a href={brief.productUrl} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-xs text-[#a8a8a8] hover:text-fg">
                  <Icon name="link" className="size-3" /> apri
                </a>
              )}
            </Row>
            <Row label="Target">{brief.target}</Row>
            <Row label="Problema">{brief.problem}</Row>
            {brief.promise && <Row label="Promessa">{brief.promise}</Row>}
            {brief.proof && <Row label="Prove">{brief.proof}</Row>}
            {brief.offer && <Row label="Offerta">{brief.offer}</Row>}
            {brief.objections && <Row label="Obiezioni">{brief.objections}</Row>}
            {brief.notes && <Row label="Note">{brief.notes}</Row>}
          </dl>
          <p className="px-1 text-[11px] text-muted">
            Creato da {whoName(bots, brief.by)} · aggiornato {ago(brief.updatedAt)}
          </p>
        </Section>

        <Section title={`Angoli${brief.angles.length ? ` · ${brief.angles.length}` : ""}`}>
          {brief.angles.length ? (
            <ol className={GROUP}>
              {brief.angles.map((a, i) => (
                <li key={a.id} className="flex gap-3 px-4 py-3">
                  <span className="w-4 shrink-0 pt-0.5 text-right text-xs text-muted tabular-nums">{i + 1}</span>
                  <span className="min-w-0 space-y-0.5">
                    <span className="block text-[15px] leading-snug">{a.text}</span>
                    {a.why && <span className="block text-[13px] leading-snug text-muted">{a.why}</span>}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">
              Nessun angolo ancora.{" "}
              <button onClick={() => setEditing(true)} className="text-[#c4c4c4] underline decoration-white/25 underline-offset-2 hover:text-fg">
                Aggiungine 3–5 diversi
              </button>
            </p>
          )}
        </Section>

        <Section
          title={`Concept${concepts.length ? ` · ${concepts.length}` : ""}`}
          action={
            <Button variant="ghost" icon="plus" onClick={() => setCreating(true)}>
              Nuovo
            </Button>
          }
        >
          {sorted.length ? (
            <div className={GROUP}>
              {sorted.map((c) => {
                const hook = chosenHook(c);
                return (
                  <Link key={c.id} href={`/ugc/${c.id}`} className={`${ROW_LINK} space-y-1`}>
                    <div className="flex items-start gap-2">
                      <span className="min-w-0 flex-1 text-[15px] leading-snug font-medium">{c.title}</span>
                      <StageBadge stage={c.stage} small />
                    </div>
                    <p className="truncate text-xs text-muted">
                      {formatOf(c.format)?.name ?? c.format} · {whoName(bots, c.owner ?? c.by)} · {ago(c.updatedAt)}
                    </p>
                    {hook?.text && <p className="line-clamp-1 text-[13px] text-[#b4b4b4]">“{hook.text}”</p>}
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted">Nessun concept da questo brief. Creane uno: angolo, format e perché ferma lo scroll.</p>
          )}
        </Section>

        <ResearchSection briefId={brief.id} items={research} bots={bots} />

        <DeleteBrief brief={brief} hasConcepts={concepts.length > 0} />
      </PageBody>

      {editing && <BriefForm brief={brief} onClose={() => setEditing(false)} />}
      {creating && <NewConcept briefs={[brief]} briefId={brief.id} onClose={() => setCreating(false)} />}
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="px-4 py-3 sm:flex sm:gap-4">
      <dt className="text-[11px] font-semibold tracking-[0.1em] text-[#a8a8a8] uppercase sm:w-28 sm:shrink-0 sm:pt-0.5">{label}</dt>
      <dd className="mt-1 text-[15px] leading-relaxed whitespace-pre-wrap sm:mt-0 sm:min-w-0 sm:flex-1">{children}</dd>
    </div>
  );
}

function DeleteBrief({ brief, hasConcepts }: { brief: UgcBrief; hasConcepts: boolean }) {
  const router = useRouter();
  const { error, busy, run } = useSave();
  const del = async () => {
    if (!confirm(`Eliminare il brief "${brief.title}" e la sua ricerca?`)) return;
    const ok = await run(() => send("DELETE", briefKey(brief.id), undefined, [UGC_KEY]));
    if (ok) router.push("/ugc");
  };
  return (
    <div className="space-y-2 border-t border-line pt-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="danger" icon="trash" disabled={busy} onClick={del}>
          Elimina brief
        </Button>
        {hasConcepts && !error && <span className="text-xs text-muted">Ha dei concept: di solito conviene metterlo in pausa.</span>}
      </div>
      <FormError>{error}</FormError>
    </div>
  );
}
