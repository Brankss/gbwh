"use client";

import Link from "next/link";
import { useState } from "react";
import type { UgcLogEntry } from "@/lib/ugc";
import { nameOf, type UgcOverview } from "./common";
import { EventIcon, clock, dayKey, dayLabel, describe, rolesBeside, visible } from "./regia-events";

// Feed: tutto quello che è successo nella factory, raggruppato per giorno.

const STEP = 12;

export function Feed({ data, now, freshSince }: { data: UgcOverview; now: number; freshSince: number }) {
  const [shown, setShown] = useState(STEP);
  const all = visible(data.log);
  const log = all.slice(0, shown);

  if (!all.length) {
    return (
      <div className="panel rounded-[1.25rem] px-4 py-8 text-center sm:px-5">
        <p className="text-sm font-medium">Ancora nessuna attività</p>
        <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed text-muted">Ogni passo della squadra (idee, revisioni, video, numeri) finisce qui, in ordine.</p>
      </div>
    );
  }

  // Gruppi per giorno, nell'ordine del registro (dal più recente).
  const groups: { key: number; items: UgcLogEntry[] }[] = [];
  for (const e of log) {
    const k = dayKey(e.at);
    const last = groups[groups.length - 1];
    if (last?.key === k) last.items.push(e);
    else groups.push({ key: k, items: [e] });
  }

  return (
    <div className="panel overflow-hidden rounded-[1.25rem]">
      {groups.map((g, gi) => (
        <div key={g.key} className={gi ? "border-t border-line" : ""}>
          <p className="bg-white/[0.02] px-4 py-2 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase sm:px-5">{dayLabel(g.items[0].at, now)}</p>
          <ol className="rows border-t border-line">
            {g.items.map((e, i) => (
              <Row key={`${e.at}-${i}`} e={e} data={data} fresh={e.at > freshSince} />
            ))}
          </ol>
        </div>
      ))}
      {all.length > shown && (
        <button
          onClick={() => setShown((n) => n + STEP)}
          className="press block min-h-11 w-full border-t border-line px-4 py-3 text-center text-sm text-soft hover:bg-white/[0.035] hover:text-fg"
        >
          Mostra altro
        </button>
      )}
    </div>
  );
}

function Row({ e, data, fresh }: { e: UgcLogEntry; data: UgcOverview; fresh: boolean }) {
  const v = describe(e);
  const href = e.conceptId ? `/ugc/${e.conceptId}` : e.briefId ? `/ugc/brief/${e.briefId}` : null;
  const roles = rolesBeside(data, e.by);
  const body = (
    <>
      <EventIcon view={v} size="md" />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2 text-[13px]">
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium text-fg">{v.label}</span>
            {v.detail && <span className="text-muted"> · {v.detail}</span>}
          </span>
          <span className="shrink-0 text-[11px] text-muted tabular-nums">{clock(e.at)}</span>
        </p>
        <p className="mt-0.5 truncate text-[13px] text-soft">{e.title}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted">
          {nameOf(data, e.by)}
          {roles && ` · ${roles}`}
        </p>
      </div>
    </>
  );
  const cls = `flex gap-3 px-4 py-3 sm:px-5 ${fresh ? "animate-rise" : ""}`;
  return (
    <li>
      {href ? (
        <Link href={href} className={`${cls} row-link`}>
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}
