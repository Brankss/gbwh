"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { ago } from "@/lib/client";
import { briefTitle, type UgcOverview } from "./common";

// "Tocca a te": i video pronti che aspettano la decisione di Branko. La cosa più importante della pagina.

export function ReadyStrip({ data }: { data: UgcOverview }) {
  const ready = data.concepts.filter((c) => c.stage === "pronto").sort((a, b) => a.updatedAt - b.updatedAt);
  if (!ready.length) return null;
  return (
    <section className="gloss overflow-hidden rounded-[1.25rem]" aria-label="Tocca a te">
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2">
        <span className="chrome grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums">{ready.length}</span>
        <h2 className="shrink-0 text-sm font-semibold whitespace-nowrap">Tocca a te</h2>
        <span className="truncate text-xs text-muted">{ready.length === 1 ? "un video da guardare" : "video da guardare"} e decidere</span>
      </div>
      <div className="divide-y divide-white/[0.07]">
        {ready.map((c) => (
          <Link key={c.id} href={`/ugc/${c.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.04]">
            <span className="orb grid size-9 shrink-0 place-items-center rounded-full">
              <Icon name="play" className="size-3.5 translate-x-px" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">{c.title}</span>
              <span className="block truncate text-xs text-muted">
                {briefTitle(data.briefList, c.briefId)} · pronto {ago(c.updatedAt)}
              </span>
            </span>
            <span className="hidden shrink-0 text-xs font-medium text-[#c4c4c4] sm:inline">Guarda</span>
            <Icon name="forward" className="size-4 shrink-0 text-muted" />
          </Link>
        ))}
      </div>
    </section>
  );
}
