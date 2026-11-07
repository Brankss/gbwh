"use client";

import { ago, useApi } from "@/lib/client";
import type { PresenceView } from "@/lib/presence";

/** "Chi è sveglio": agent online (segnale negli ultimi 15 minuti) e cosa stanno facendo. */
export function AgentsOnline() {
  const { data } = useApi<{ items: PresenceView[] }>("/api/agents", { refreshInterval: 30_000 });
  const items = data?.items ?? [];
  if (!data) return <div className="skeleton h-14 rounded-2xl" />;
  if (!items.length) {
    return (
      <p className="panel rounded-2xl px-4 py-3.5 text-sm leading-relaxed text-muted">
        Nessun agent ha ancora dato segni di vita. Quando Hermes o i bot mandano il loro heartbeat, li vedi qui.
      </p>
    );
  }
  return (
    <ul className="panel rows stagger overflow-hidden rounded-2xl">
      {items.map((a) => (
        <li key={a.agent} className={`flex items-center gap-3 px-4 py-3 ${a.online ? "" : "opacity-60"}`}>
          <span className="relative grid size-2.5 shrink-0 place-items-center">
            {a.online && a.status !== "in pausa" && <span className="absolute size-2.5 animate-ping rounded-full bg-white/50" />}
            <span className={`relative size-2.5 rounded-full ${a.online ? (a.status === "in pausa" ? "bg-muted" : "bg-white shadow-[0_0_8px_rgb(255_255_255/0.7)]") : "border border-muted"}`} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{a.name ?? a.agent}</span>
            {a.doing && <span className="line-clamp-2 text-[13px] text-muted">{a.doing}</span>}
          </span>
          <span className="shrink-0 self-start pt-0.5 text-xs text-muted">{a.online ? a.status : `visto ${ago(a.at)}`}</span>
        </li>
      ))}
    </ul>
  );
}
