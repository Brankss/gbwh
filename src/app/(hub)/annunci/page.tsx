"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Button, Empty, List, PageBody, PageHeader, Tabs } from "@/components/kit";
import { ago, send, useApi } from "@/lib/client";
import type { Alert } from "@/lib/schemas";

type View = "da-leggere" | "letti" | "archivio";

export default function AlertsPage() {
  const { data } = useApi<{ items: Alert[] }>("/api/c/alerts", { refreshInterval: 20_000 });
  const [view, setView] = useState<View>("da-leggere");
  const items = data?.items ?? [];

  const groups: Record<View, Alert[]> = {
    "da-leggere": items.filter((a) => !a.readAt && !a.archivedAt),
    letti: items.filter((a) => a.readAt && !a.archivedAt),
    archivio: items.filter((a) => a.archivedAt),
  };
  // Prima gli urgenti, poi i più recenti.
  const shown = [...groups[view]].sort((a, b) => (a.level === b.level ? b.updatedAt - a.updatedAt : a.level === "urgente" ? -1 : 1));

  return (
    <>
      <PageHeader title="Annunci" subtitle="Solo le cose che contano. Se è qui, va letto." />
      <PageBody>
        <div className="space-y-4">
          <Tabs
            value={view}
            onChange={setView}
            options={[
              { value: "da-leggere", label: "Da leggere", count: groups["da-leggere"].length },
              { value: "letti", label: "Letti", count: groups.letti.length },
              { value: "archivio", label: "Archivio", count: groups.archivio.length },
            ]}
          />
          {!data ? (
            <div className="skeleton h-24 rounded-2xl" />
          ) : shown.length === 0 ? (
            <Empty icon="bell" title={view === "da-leggere" ? "Tutto letto ✨" : "Niente qui"}>
              {view === "da-leggere" && "Quando un agent o una sezione dell'hub ha qualcosa di davvero importante, compare qui."}
            </Empty>
          ) : (
            <List className="stagger">
              {shown.map((a) => (
                <AlertRow key={a.id} alert={a} />
              ))}
            </List>
          )}
        </div>
      </PageBody>
    </>
  );
}

function AlertRow({ alert: a }: { alert: Alert }) {
  const patch = (body: object) => send("PATCH", `/api/c/alerts/${a.id}`, body, ["/api/c/alerts"]);
  const urgent = a.level === "urgente";
  return (
    <article className={`relative flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:gap-4 md:px-5 ${urgent && !a.readAt ? "bg-[#e66767]/[0.035]" : ""}`}>
      {urgent && <span aria-hidden className="absolute inset-y-4 left-0 w-[3px] rounded-r-full bg-[#e66767]" />}
      <div className={`flex min-w-0 flex-1 items-start gap-3 ${a.readAt ? "opacity-70" : ""}`}>
        <span
          className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${urgent ? "bg-[#e66767]/12 text-[#ec8585]" : "bg-white/[0.06] text-soft"}`}
          aria-hidden
        >
          <Icon name={urgent ? "alert" : "bell"} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium">{a.title}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
            <span className={urgent ? "font-medium text-[#ec8585]" : "font-medium text-soft"}>{urgent ? "Urgente" : "Importante"}</span>
            <span>· {a.source}</span>
            <span>· {ago(a.updatedAt)}</span>
            {(a.repeats ?? 1) > 1 && <span>· aggiornato {a.repeats} volte</span>}
          </div>
          {a.body && <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-soft">{a.body}</p>}
          {a.link && (
            <a
              href={a.link}
              className="hit mt-2 inline-flex items-center gap-1.5 text-sm font-medium underline decoration-white/30 underline-offset-4 hover:decoration-white"
              target={a.link.startsWith("/") ? undefined : "_blank"}
              rel="noreferrer"
            >
              <Icon name="link" className="size-3.5" /> Apri
            </a>
          )}
        </div>
      </div>
      <div className="flex shrink-0 justify-end gap-2 pl-11 sm:pl-0">
        {a.archivedAt ? (
          <Button small variant="ghost" onClick={() => patch({ archived: false })}>
            Ripristina
          </Button>
        ) : (
          <>
            <Button small variant="ghost" onClick={() => patch({ read: !a.readAt })}>
              {a.readAt ? "Segna da leggere" : "Letto"}
            </Button>
            <Button small variant="gloss" icon="archive" onClick={() => patch({ archived: true, read: true })}>
              Fatto
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
