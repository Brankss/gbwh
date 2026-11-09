"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { Button, Empty, Pills } from "@/components/kit";
import type { UgcBrief } from "@/lib/ugc";
import type { BriefSummary } from "@/lib/ugc-store";
import { GROUP, ROW_LINK, Tag } from "./common";

// Lista dei brief (pagina /ugc/brief): prodotto, target e i numeri di ogni brief.

type Filter = "tutti" | UgcBrief["status"];

export function BriefList({ briefs, onNew, onEdit }: { briefs: BriefSummary[]; onNew: () => void; onEdit: (b: BriefSummary) => void }) {
  const [filter, setFilter] = useState<Filter>("tutti");

  if (!briefs.length) {
    return (
      <Empty icon="folder" title="Nessun brief">
        <p>Un brief è il punto di partenza: prodotto, chi compra, il problema e le prove.</p>
        <div className="mt-4">
          <Button icon="plus" onClick={onNew}>
            Nuovo brief
          </Button>
        </div>
      </Empty>
    );
  }

  const order: Record<UgcBrief["status"], number> = { attivo: 0, "in pausa": 1, chiuso: 2 };
  const shown = briefs.filter((b) => filter === "tutti" || b.status === filter).sort(
    (a, b) => order[a.status] - order[b.status] || b.updatedAt - a.updatedAt,
  );
  const statuses = (["attivo", "in pausa", "chiuso"] as const).filter((s) => briefs.some((b) => b.status === s));

  return (
    <div className="space-y-4">
      {/* "Nuovo brief" sta nell'intestazione della pagina: qui solo i filtri, se servono */}
      {statuses.length > 1 && (
        <Pills
          value={filter}
          onChange={setFilter}
          options={[{ value: "tutti" as Filter, label: "Tutti", count: briefs.length }, ...statuses.map((s) => ({ value: s as Filter, label: s, count: briefs.filter((b) => b.status === s).length }))]}
        />
      )}

      <div className={GROUP}>
        {shown.map((b) => (
          <div key={b.id} className="group relative flex items-stretch">
            <Link href={`/ugc/brief/${b.id}`} className={`${ROW_LINK} min-w-0 flex-1 space-y-1`}>
              <div className="flex items-center gap-2">
                <span className="min-w-0 truncate text-[15px] font-medium">{b.title}</span>
                {b.status !== "attivo" && <Tag>{b.status}</Tag>}
              </div>
              <p className="truncate text-xs text-[#a8a8a8]">{b.productName}</p>
              <p className="line-clamp-1 text-[13px] text-muted">{b.target}</p>
              <p className="flex flex-wrap gap-x-3 gap-y-0.5 pt-0.5 text-[11px] text-muted tabular-nums">
                <span>
                  <b className="font-semibold text-fg">{b.concepts}</b> concept
                </span>
                <span>
                  <b className="font-semibold text-fg">{b.active}</b> in catena
                </span>
                {b.winners > 0 && (
                  <span>
                    <b className="font-semibold text-[#3fcf9b]">{b.winners}</b> {b.winners === 1 ? "vincente" : "vincenti"}
                  </span>
                )}
                <span>
                  <b className="font-semibold text-fg">{b.research}</b> ricerca
                </span>
                <span>
                  <b className="font-semibold text-fg">{b.angles.length}</b> angoli
                </span>
              </p>
            </Link>
            <button
              onClick={() => onEdit(b)}
              aria-label={`Modifica ${b.title}`}
              className="press my-auto mr-2 hidden size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-white/[0.06] hover:text-fg sm:grid"
            >
              <Icon name="sliders" className="size-4" />
            </button>
          </div>
        ))}
        {!shown.length && <p className="px-4 py-6 text-center text-sm text-muted">Nessun brief con questo stato.</p>}
      </div>
    </div>
  );
}
