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
        <div className="space-y-4">
          <Pills
            label="Filtra per stato"
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
                <div key={i} className="skeleton h-40 rounded-2xl" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <Empty icon="folder" title={items.length ? "Nessun progetto con questo stato" : "Nessun progetto"}>
              {!items.length && "Crea il primo: poi tu e gli agent ci lasciate i checkpoint."}
            </Empty>
          ) : (
            <div className="stagger grid gap-3 sm:grid-cols-2">
              {shown.map((p) => (
                <Link key={p.id} href={`/progetti/${p.id}`} className="panel lift flex flex-col rounded-2xl">
                  <div className="flex-1 space-y-3 p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-lg">{p.emoji || p.name[0]}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{p.name}</div>
                        <div className="truncate text-xs text-muted first-letter:uppercase">
                          {p.status}
                          {p.area ? ` · ${p.area}` : ""}
                        </div>
                      </div>
                      {p.latest?.progress !== undefined && <span className="pt-0.5 text-sm font-medium tabular-nums">{p.latest.progress}%</span>}
                    </div>
                    {p.latest?.progress !== undefined && <Progress value={p.latest.progress} />}
                    <p className="line-clamp-3 text-sm leading-relaxed text-soft">{p.latest?.summary ?? p.description ?? "Nessun checkpoint ancora."}</p>
                  </div>
                  <div className="flex gap-3 border-t border-line px-4 py-2.5 text-xs text-muted">
                    <span>{p.checkpoints} checkpoint</span>
                    <span>{p.knowledge} conoscenze</span>
                    {p.latest && (
                      <span className="ml-auto truncate">
                        {ago(p.latest.createdAt)} · {p.latest.author}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </PageBody>
      {creating && <ProjectForm onClose={() => setCreating(false)} />}
    </>
  );
}
