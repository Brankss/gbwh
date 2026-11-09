"use client";

import { Stat, StatGrid } from "@/components/kit";
import { eur, useApi } from "@/lib/client";
import { ACTIVE_STAGES, summarize, type UgcConcept, type UgcResult, type UgcVideo } from "@/lib/ugc";
import { UGC_VIDEOS_KEY, fmtPct, fmtRoas, type UgcOverview } from "./common";

// Numeri della factory in una striscia: cosa c'è in catena e come vanno i video in test.

type Item = { video: UgcVideo; concept: UgcConcept | null; results: UgcResult[] };

export function Numbers({ data }: { data: UgcOverview }) {
  const { data: videos } = useApi<{ items: Item[] }>(UGC_VIDEOS_KEY, { refreshInterval: 60_000 });
  const all = videos ? summarize(videos.items.flatMap((i) => i.results)) : undefined;
  const live = ACTIVE_STAGES.reduce((n, s) => n + data.byStage[s], 0);
  const loading = <span className="inline-block h-5 w-12 animate-pulse rounded-full bg-white/[0.06] align-middle" />;
  const muted = (v: string) => (v === "—" ? <span className="text-muted/70">—</span> : v);

  return (
    <StatGrid two>
      <Stat label="In catena" value={live} hint="dall'idea al test" />
      <Stat label="Video pronti" value={data.byStage.pronto} hint={data.byStage.pronto ? "da guardare" : "nessuno in attesa"} />
      <Stat label="In test" value={data.byStage.in_test} hint="online, con numeri veri" />
      <Stat label="Vincenti" value={data.byStage.vincente} hint={`${data.learnings} ${data.learnings === 1 ? "lezione" : "lezioni"} nel Playbook`} />
      <Stat label="ROAS medio" value={all ? muted(fmtRoas(all.roas)) : loading} hint={all?.spend ? `su ${eur(all.spend)} spesi` : "ancora nessuna spesa"} />
      <Stat label="Hook rate medio" value={all ? muted(fmtPct(all.hookRate)) : loading} hint="chi guarda i primi 3 s" />
    </StatGrid>
  );
}
