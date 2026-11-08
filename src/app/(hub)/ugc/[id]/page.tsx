"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";
import { mutate as globalMutate } from "swr";
import { Icon } from "@/components/icons";
import { Empty, PageBody, PageHeader } from "@/components/kit";
import { StageBadge, type UgcOverview } from "@/components/ugc/common";
import { ConceptChain } from "@/components/ugc/concept-chain";
import { ConceptDecision } from "@/components/ugc/concept-decision";
import { ConceptHooks } from "@/components/ugc/concept-hooks";
import { ConceptIdea } from "@/components/ugc/concept-idea";
import { ConceptIndex, jumpTo } from "@/components/ugc/concept-index";
import { ConceptMoveModal } from "@/components/ugc/concept-move";
import { ConceptLog, ConceptPlaybook } from "@/components/ugc/concept-playbook";
import { ConceptResults } from "@/components/ugc/concept-results";
import { ConceptReviews } from "@/components/ugc/concept-reviews";
import { ConceptScript } from "@/components/ugc/concept-script";
import { ConceptStory } from "@/components/ugc/concept-story";
import { Btn, agoAt, type ConceptCtx, type ConceptData } from "@/components/ugc/concept-ui";
import { ConceptVideos } from "@/components/ugc/concept-videos";
import { send, useApi, useNow } from "@/lib/client";

// Pagina di un concept della UGC Factory: dove si trova nella catena, cosa c'è da fare,
// e tutto il lavoro fatto (idea, hook, storia, script, revisioni, video, numeri, lezioni).

export default function ConceptPageShell() {
  // L'id arriva dall'URL solo a runtime: la pagina vera sta dentro <Suspense>.
  return (
    <Suspense fallback={<Skeleton />}>
      <ConceptPage />
    </Suspense>
  );
}

const back = (
  <Link href="/ugc" aria-label="UGC Factory" className="press grid size-9 shrink-0 place-items-center rounded-full text-[#b4b4b4] hover:bg-white/[0.07] hover:text-fg">
    <Icon name="back" />
  </Link>
);

function Skeleton() {
  return (
    <>
      <PageHeader title="Concept" back={back} />
      <PageBody>
        <div className="space-y-3">
          <div className="skeleton h-5 w-48 rounded-full" />
          <div className="skeleton h-28 rounded-[1.25rem]" />
        </div>
        <div className="skeleton h-11 rounded-full" />
        <div className="skeleton h-56 rounded-[1.25rem]" />
        <div className="skeleton h-40 rounded-[1.25rem]" />
      </PageBody>
    </>
  );
}

function ConceptPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const key = `/api/ugc/concepts/${id}`;
  const { data, error, mutate } = useApi<ConceptData>(key, { refreshInterval: 30_000 });
  const ov = useApi<UgcOverview>("/api/ugc");
  const now = useNow();
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const act = useCallback<ConceptCtx["act"]>(
    async (fn, optimistic) => {
      await mutate(
        async (cur) => {
          await fn();
          return cur;
        },
        { optimisticData: optimistic ? (cur) => optimistic(cur as ConceptData) : undefined, populateCache: false, revalidate: true, rollbackOnError: true },
      );
      void globalMutate("/api/ugc");
    },
    [mutate],
  );

  const bots = useMemo(() => ov.data?.bots ?? [], [ov.data]);
  const who = useCallback((b: string) => (b === "tu" ? "Branko" : (bots.find((x) => x.id === b)?.name ?? b)), [bots]);

  if (error) {
    return (
      <>
        <PageHeader title="Concept" back={back} />
        <PageBody>
          <Empty icon="film" title="Concept non trovato">
            <p>{error.message}</p>
            <Link href="/ugc" className="mt-3 inline-flex h-9 items-center rounded-full border border-white/10 px-4 text-[13px] text-[#c4c4c4] hover:border-white/25 hover:text-fg">
              Torna alla UGC Factory
            </Link>
          </Empty>
        </PageBody>
      </>
    );
  }
  if (!data) return <Skeleton />;

  const ctx: ConceptCtx = { id, key, data, bots, settings: ov.data?.settings ?? null, now, act, who };
  const { concept, brief } = data;

  const del = async () => {
    if (!confirm(`Eliminare "${concept.title}" con revisioni, video e numeri? Non si torna indietro.`)) return;
    setDeleting(true);
    try {
      await send("DELETE", key, undefined, ["/api/ugc"]);
      router.push("/ugc");
    } catch (e) {
      setDeleting(false);
      alert(e instanceof Error ? e.message : "Eliminazione non riuscita");
    }
  };

  const counts = {
    hook: concept.hooks.length,
    script: concept.scenes.length,
    revisioni: data.reviews.length,
    video: data.videos.length,
    numeri: data.results.length,
    playbook: data.learnings.length,
  };

  return (
    <>
      <PageHeader
        title={concept.title}
        back={back}
        actions={
          <>
            <Btn onClick={() => setMoving(true)} className="max-sm:px-3">
              <span>
                Sposta<span className="hidden sm:inline"> in…</span>
              </span>
            </Btn>
            <Btn variant="quiet" icon="trash" label="Elimina concept" onClick={del} disabled={deleting} />
          </>
        }
      />
      <PageBody>
        <div className="space-y-4">
          {/* chi, cosa, quando */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]">
            <StageBadge stage={concept.stage} />
            {brief ? (
              <Link href={`/ugc/brief/${brief.id}`} className="press inline-flex min-h-9 min-w-0 items-center gap-1.5 text-[#c4c4c4] hover:text-fg">
                <Icon name="folder" className="size-3.5 shrink-0 text-muted" />
                <span className="truncate">{brief.title}</span>
                {brief.productName && brief.productName !== brief.title && <span className="truncate text-muted">· {brief.productName}</span>}
              </Link>
            ) : (
              <span className="text-muted">Brief eliminato</span>
            )}
            <span className="text-xs text-muted">
              {concept.owner ? `${who(concept.owner)} ci lavora · ` : ""}
              {now ? `aggiornato ${agoAt(concept.updatedAt, now)}` : ""}
            </span>
          </div>

          {concept.stage === "pronto" && <ConceptDecision ctx={ctx} />}
          <ConceptChain ctx={ctx} onJump={jumpTo} />
        </div>

        <ConceptIndex counts={counts} />

        <ConceptIdea ctx={ctx} />
        <ConceptHooks ctx={ctx} />
        <ConceptStory ctx={ctx} />
        <ConceptScript ctx={ctx} />
        <ConceptReviews ctx={ctx} />
        <ConceptVideos ctx={ctx} />
        <ConceptResults ctx={ctx} />
        <ConceptPlaybook ctx={ctx} />
        <ConceptLog ctx={ctx} />
      </PageBody>
      {moving && <ConceptMoveModal ctx={ctx} onClose={() => setMoving(false)} />}
    </>
  );
}
