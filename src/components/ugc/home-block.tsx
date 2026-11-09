"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { useApi, useNow } from "@/lib/client";
import { ACTIVE_STAGES, stageOf } from "@/lib/ugc";
import { GROUP, ROW_LINK, STAGE_TONE, UGC_KEY, chosenHook, nameOf, type UgcOverview } from "./common";
import { EventIcon, LiveDot, describe, rolesOf, rolesText, since, visible } from "./regia-events";

// Blocco compatto della UGC Factory nella home "Adesso": l'ultimo aggiornamento live,
// i video pronti da guardare, una domanda di un bot se c'è (rara) e quanto c'è in catena.

export function UgcHomeBlock() {
  const { data } = useApi<UgcOverview>(UGC_KEY, { refreshInterval: 30_000 });
  const now = useNow();
  if (!data) return <div className="skeleton h-28 rounded-[1.25rem]" />;

  if (!data.concepts.length && !data.log.length) {
    return (
      <Link href="/ugc" className="matte row-link flex items-center gap-3 rounded-[1.25rem] px-4 py-3.5 text-sm text-muted hover:text-fg">
        <Icon name="film" className="size-4 shrink-0" />
        <span className="flex-1">Factory ferma. Dai un brief e i bot fanno il resto.</span>
        <Icon name="forward" className="size-4 shrink-0" />
      </Link>
    );
  }

  const last = visible(data.log).find((e) => e.action !== "domanda" && e.action !== "risposta");
  const ready = data.concepts.filter((c) => c.stage === "pronto").sort((a, b) => b.updatedAt - a.updatedAt);
  const question = data.questions.find((q) => q.status === "aperta");
  const counts = ACTIVE_STAGES.filter((s) => s !== "pronto" && data.byStage[s] > 0);
  const winners = data.byStage.vincente;

  return (
    <div className={GROUP}>
      {last &&
        (() => {
          const v = describe(last);
          return (
            <Link href={last.conceptId ? `/ugc/${last.conceptId}` : "/ugc"} className={`${ROW_LINK} flex items-center gap-3`}>
              <EventIcon view={v} size="md" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[11px] text-muted">
                  <LiveDot />
                  <span className="truncate">
                    {v.label} · {nameOf(data, last.by)}
                  </span>
                </span>
                <span className="block truncate font-medium">{last.title}</span>
              </span>
              <span className="shrink-0 text-xs text-muted tabular-nums">{since(last.at, now)}</span>
            </Link>
          );
        })()}
      {question && (
        <Link href="/ugc" className={`${ROW_LINK} flex items-center gap-3`}>
          <EventIcon view={{ icon: "chat", label: "", tone: "#c4c4c4" }} size="md" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-muted">{rolesText(rolesOf(data.settings, question.by)) || nameOf(data, question.by)} chiede</span>
            <span className="block truncate text-sm">{question.text}</span>
          </span>
          <Icon name="forward" className="size-4 shrink-0 text-muted" />
        </Link>
      )}
      {ready.slice(0, 2).map((c) => (
        <Link key={c.id} href={`/ugc/${c.id}`} className={`${ROW_LINK} flex items-center gap-3`}>
          <span className="chrome grid size-8 shrink-0 place-items-center rounded-full">
            <Icon name="play" className="size-3 translate-x-px" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-muted">Video pronto da guardare</span>
            <span className="block truncate font-medium">{c.title}</span>
          </span>
          <span className="hidden max-w-44 truncate text-xs text-muted sm:block">{chosenHook(c)?.text}</span>
        </Link>
      ))}
      {ready.length > 2 && (
        <Link href="/ugc" className={`${ROW_LINK} text-xs text-muted`}>
          e altri {ready.length - 2} pronti →
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
