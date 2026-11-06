"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Empty, PageBody, PageHeader, Pills, Progress } from "@/components/kit";
import { ProjectForm } from "@/components/project-form";
import { ago, useApi } from "@/lib/client";
import type { ProjectSummary } from "@/lib/hub";
import { PROJECT_STATUS } from "@/lib/schemas";

type Filter = "tutti" | (typeof PROJECT_STATUS)[number];

export default function ProjectsPage() {
  const { data } = useApi<{ items: ProjectSummary[] }>("/api/c/projects");
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<Filter>("attivo");
  const items = data?.items ?? [];
  const shown = filter === "tutti" ? items : items.filter((p) => p.status === filter);

  return (
    <>
      <PageHeader
        title="Progetti"
        subtitle="A che punto è tutto, e cosa abbiamo imparato"
        actions={
          <Button icon="plus" onClick={() => setCreating(true)}>
            Nuovo
          </Button>
        }
      />
      <PageBody>
        <Pills
          value={filter}
          onChange={setFilter}
          options={[
            ...PROJECT_STATUS.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1), count: items.filter((p) => p.status === s).length })),
            { value: "tutti" as const, label: "Tutti", count: items.length },
          ]}
        />
        {!data ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-[1.25rem] bg-surface-2" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <Empty icon="folder" title={items.length ? "Nessun progetto con questo stato" : "Nessun progetto"}>
            {!items.length && "Crea il primo: poi tu e gli agent ci lasciate i checkpoint."}
          </Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {shown.map((p) => (
              <Link key={p.id} href={`/progetti/${p.id}`} className="matte block space-y-3 rounded-[1.25rem] p-4 transition-colors hover:border-[#2a2a2a] hover:bg-[#171717]">
                <div className="flex items-start gap-3">
                  <span className="orb grid size-10 shrink-0 place-items-center rounded-full text-lg">{p.emoji || p.name[0]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="text-xs text-muted">
                      {p.status}
                      {p.area ? ` · ${p.area}` : ""}
                    </div>
                  </div>
                  {p.latest?.progress !== undefined && <span className="text-sm font-medium tabular-nums">{p.latest.progress}%</span>}
                </div>
                {p.latest?.progress !== undefined && <Progress value={p.latest.progress} />}
                <p className="line-clamp-3 text-sm text-muted">{p.latest?.summary ?? p.description ?? "Nessun checkpoint ancora."}</p>
                <div className="flex gap-3 text-[11px] text-muted">
                  <span>{p.checkpoints} checkpoint</span>
                  <span>{p.knowledge} conoscenze</span>
                  {p.latest && <span className="ml-auto">{ago(p.latest.createdAt)} · {p.latest.author}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </PageBody>
      {creating && <ProjectForm onClose={() => setCreating(false)} />}
    </>
  );
}
