"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { useApi } from "@/lib/client";
import { ACTIVE_STAGES, stageOf } from "@/lib/ugc";
import { GROUP, ROW_LINK, STAGE_TONE, UGC_KEY, briefTitle, type UgcOverview } from "./common";

// Blocco compatto della UGC Factory nella home "Adesso": cosa aspetta te, e quanto c'è in catena.

export function UgcHomeBlock() {
  const { data } = useApi<UgcOverview>(UGC_KEY, { refreshInterval: 60_000 });
  if (!data) return <div className="h-16 skeleton rounded-[1.25rem]" />;

  const ready = data.concepts.filter((c) => c.stage === "pronto");
  const counts = ACTIVE_STAGES.filter((s) => s !== "pronto" && data.byStage[s] > 0);
  const winners = data.byStage.vincente;

  if (!data.concepts.length) {
    return (
      <Link href="/ugc" className="matte block rounded-[1.25rem] p-4 text-sm text-muted hover:text-fg">
        Catena vuota. Parti da un brief →
      </Link>
    );
  }

  return (
    <div className={GROUP}>
      {ready.length ? (
        ready.slice(0, 3).map((c) => (
          <Link key={c.id} href={`/ugc/${c.id}`} className={`${ROW_LINK} flex items-center gap-3`}>
            <span className="orb grid size-8 shrink-0 place-items-center rounded-full">
              <Icon name="play" className="size-3 translate-x-px" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] text-muted">Video pronto · decidi tu</span>
              <span className="block truncate font-medium">{c.title}</span>
            </span>
            <span className="hidden truncate text-xs text-muted sm:block sm:max-w-40">{briefTitle(data.briefList, c.briefId)}</span>
          </Link>
        ))
      ) : (
        <p className="flex items-center gap-2.5 px-4 py-3 text-sm text-muted">
          <Icon name="check" className="size-4" /> Nessun video da decidere.
        </p>
      )}
      {ready.length > 3 && (
        <Link href="/ugc" className={`${ROW_LINK} text-xs text-muted`}>
          e altri {ready.length - 3} →
        </Link>
      )}
      <Link href="/ugc" className="flex flex-wrap items-center gap-x-3.5 gap-y-1 px-4 py-2.5 text-xs text-muted transition-colors hover:bg-white/[0.035]">
        {counts.length === 0 && winners === 0 && <span>Niente in lavorazione</span>}
        {counts.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="size-1.5 rounded-full" style={{ background: STAGE_TONE[s] }} />
            {stageOf(s).label} <b className="font-semibold text-fg tabular-nums">{data.byStage[s]}</b>
          </span>
        ))}
        {winners > 0 && (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="size-1.5 rounded-full" style={{ background: STAGE_TONE.vincente }} />
            Vincenti <b className="font-semibold text-fg tabular-nums">{winners}</b>
          </span>
        )}
      </Link>
    </div>
  );
}
