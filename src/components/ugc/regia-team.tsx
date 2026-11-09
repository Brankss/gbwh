"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { ROLES, STAGES, type StageId } from "@/lib/ugc";
import { nameOf, type UgcOverview } from "./common";
import { LiveDot, presenceOf, since } from "./regia-events";

// Squadra live: i 5 ruoli e chi li fa, se è sveglio, cosa sta facendo e quanto lavoro ha in coda.

export function TeamLive({ data, now }: { data: UgcOverview; now: number }) {
  return (
    <div className="panel rows overflow-hidden rounded-[1.25rem]">
      {ROLES.map((r) => {
        const bot = data.settings.roles[r.id];
        const p = presenceOf(data.presence, bot);
        // Lavoro in coda per il ruolo: i concept nelle sue fasi (vincenti esclusi, sono già a posto).
        const stages = STAGES.filter((s) => s.role === r.id && s.id !== "vincente").map((s) => s.id as StageId);
        const queue = stages.reduce((n, s) => n + (data.byStage[s] ?? 0), 0);
        if (!bot) {
          return (
            <div key={r.id} className="flex min-h-[4.25rem] items-center gap-3 px-4 py-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-dashed border-white/15 text-muted">
                <Icon name="plus" className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-soft">{r.label}</p>
                <p className="truncate text-xs text-muted">nessuno assegnato</p>
              </div>
              <Link href="/ugc/squadra" className="press inline-flex h-10 shrink-0 items-center rounded-full px-3 text-[13px] font-medium text-muted hover:bg-white/[0.05] hover:text-fg">
                Assegna
              </Link>
            </div>
          );
        }
        const name = nameOf(data, bot);
        const online = !!p?.online;
        const busy = p?.status === "occupato";
        const seen = p ? (online ? (busy ? "occupato" : "online") : `visto ${since(p.at, now)}`) : "mai visto";
        return (
          <div key={r.id} className="flex min-h-[4.25rem] items-center gap-3 px-4 py-3">
            <span className="relative shrink-0">
              <span className={`orb grid size-10 place-items-center rounded-full text-sm font-semibold ${online ? "" : "opacity-60"}`}>{name.charAt(0).toUpperCase()}</span>
              <span className="absolute -right-0.5 -bottom-0.5 grid size-3.5 place-items-center rounded-full bg-[#0b0b0b]">
                <LiveDot on={online} tone={busy ? "#e0a030" : undefined} />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-1.5">
                <span className="truncate text-[15px] font-medium">{name}</span>
                {name.toLowerCase() !== r.label.toLowerCase() && <span className="shrink-0 text-xs text-muted">{r.label}</span>}
              </p>
              <p className={`truncate text-xs ${online ? "text-soft" : "text-muted"}`}>{p?.doing ? (online ? p.doing : `ultimo: ${p.doing}`) : seen}</p>
              {p?.doing && <p className="truncate text-[11px] text-muted">{seen}</p>}
            </div>
            {queue > 0 && (
              <span className="shrink-0 rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] font-medium text-soft tabular-nums" title={`${queue} in coda per ${r.label}`}>
                {queue} in coda
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
