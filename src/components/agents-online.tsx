"use client";

import { ago, useApi } from "@/lib/client";
import type { PresenceView } from "@/lib/presence";

/** "Chi è sveglio": agent online (segnale negli ultimi 15 minuti) e cosa stanno facendo. */
export function AgentsOnline() {
  const { data } = useApi<{ items: PresenceView[] }>("/api/agents", { refreshInterval: 30_000 });
  const items = data?.items ?? [];
  if (!data) return <div className="skeleton h-14 rounded-[1.25rem]" />;
  if (!items.length) {
    return (
      <p className="matte rounded-[1.25rem] p-4 text-sm text-muted">
        Nessun agent ha ancora dato segni di vita. Quando Hermes o i bot mandano il loro heartbeat, li vedi qui.
      </p>
    );
  }
  return (
    <ul className="stagger grid gap-2 sm:grid-cols-2">
      {items.map((a) => (
        <li key={a.agent} className={`matte flex items-start gap-3 rounded-[1.25rem] p-3.5 ${a.online ? "" : "opacity-65"}`}>
          <span className="relative mt-1 grid size-2.5 shrink-0 place-items-center">
            {a.online && a.status !== "in pausa" && <span className="absolute size-2.5 animate-ping rounded-full bg-white/50" />}
            <span className={`relative size-2.5 rounded-full ${a.online ? (a.status === "in pausa" ? "bg-muted" : "bg-white shadow-[0_0_8px_rgb(255_255_255/0.7)]") : "border border-muted"}`} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium">{a.name ?? a.agent}</span>
              <span className="shrink-0 text-[11px] text-muted">{a.online ? a.status : `visto ${ago(a.at)}`}</span>
            </span>
            {a.doing && <span className="line-clamp-2 text-sm text-muted">{a.doing}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
