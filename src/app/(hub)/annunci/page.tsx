"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Button, Empty, PageBody, PageHeader, Pills } from "@/components/kit";
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
        <Pills
          value={view}
          onChange={setView}
          options={[
            { value: "da-leggere", label: "Da leggere", count: groups["da-leggere"].length },
            { value: "letti", label: "Letti", count: groups.letti.length },
            { value: "archivio", label: "Archivio", count: groups.archivio.length },
          ]}
        />
        {!data ? (
          <div className="h-24 skeleton rounded-[1.25rem]" />
        ) : shown.length === 0 ? (
          <Empty icon="bell" title={view === "da-leggere" ? "Tutto letto ✨" : "Niente qui"}>
            {view === "da-leggere" && "Quando un agent o una sezione dell'hub ha qualcosa di davvero importante, compare qui."}
          </Empty>
        ) : (
          <div className="stagger space-y-3">
            {shown.map((a) => (
              <AlertCard key={a.id} alert={a} />
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}

function AlertCard({ alert: a }: { alert: Alert }) {
  const patch = (body: object) => send("PATCH", `/api/c/alerts/${a.id}`, body, ["/api/c/alerts"]);
  const urgent = a.level === "urgente";
  return (
    <article
      className={`matte relative space-y-2 overflow-hidden rounded-[1.25rem] p-4 ${a.readAt ? "opacity-70" : ""} ${
        urgent ? "shadow-[inset_0_0_0_1px_rgb(230_103_103/0.28),0_14px_40px_-24px_rgb(230_103_103/0.35)]" : ""
      }`}
    >
      {urgent && <span aria-hidden className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-[#e66767]" />}
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${urgent ? "bg-[#e66767]/15 text-[#e66767]" : "orb"}`}
          aria-hidden
        >
          <Icon name={urgent ? "alert" : "bell"} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
            <span className={urgent ? "font-semibold text-[#e66767]" : "font-medium text-fg"}>{urgent ? "Urgente" : "Importante"}</span>
            <span>· {a.source}</span>
            <span>· {ago(a.updatedAt)}</span>
            {(a.repeats ?? 1) > 1 && <span>· aggiornato {a.repeats} volte</span>}
          </div>
          <h3 className="mt-0.5 font-medium">{a.title}</h3>
          {a.body && <p className="mt-1 text-sm whitespace-pre-wrap text-muted">{a.body}</p>}
          {a.link && (
            <a href={a.link} className="mt-1 inline-flex items-center gap-1 text-sm underline underline-offset-2" target={a.link.startsWith("/") ? undefined : "_blank"} rel="noreferrer">
              <Icon name="link" className="size-3.5" /> Apri
            </a>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        {a.archivedAt ? (
          <Button small variant="ghost" onClick={() => patch({ archived: false })}>
            Ripristina
          </Button>
        ) : (
          <>
            <Button small variant="ghost" onClick={() => patch({ read: !a.readAt })}>
              {a.readAt ? "Segna da leggere" : "Letto"}
            </Button>
            <Button small icon="archive" onClick={() => patch({ archived: true, read: true })}>
              Fatto
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
