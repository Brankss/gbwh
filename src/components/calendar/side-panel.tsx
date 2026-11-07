"use client";

import { useState } from "react";
import { ago } from "@/lib/client";
import { colorOf, dayLabel, durationLabel, timeByCategory, type CalEvent, type CalLogEntry, type CalRequest, type Category, type Occurrence } from "@/lib/calendar";
import { Icon } from "../icons";
import { decideRequest, type Toast } from "./data";

// Colonna a lato (desktop) / pannello (telefono): richieste, da pianificare, dove va il tempo, ultime modifiche.

export function SidePanel(p: {
  backlog: CalEvent[];
  categories: Category[];
  occs: Occurrence[];
  statsFrom: string;
  statsTo: string;
  statsLabel: string;
  requests: CalRequest[];
  log: CalLogEntry[];
  byName: (id: string) => string;
  onOpenBacklog: (e: CalEvent) => void;
  onPlace: (e: CalEvent) => void;
  onToast: (t: Toast) => void;
  onAllRequests: () => void;
  extra?: React.ReactNode;
}) {
  const pending = p.requests.filter((r) => r.status === "pending");
  return (
    <div className="space-y-7">
      {pending.length > 0 && (
        <Block title={`Richieste (${pending.length})`} action={<Small onClick={p.onAllRequests}>Tutte</Small>}>
          <div className="space-y-2">
            {pending.slice(0, 3).map((r) => (
              <RequestCard key={r.id} r={r} byName={p.byName} onToast={p.onToast} />
            ))}
          </div>
        </Block>
      )}

      <Block title={`Da pianificare${p.backlog.length ? ` (${p.backlog.length})` : ""}`}>
        {p.backlog.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/[0.12] px-3.5 py-3 text-[13px] leading-relaxed text-muted">
            Le cose senza un orario preciso finiscono qui. Scrivi <span className="text-fg">“… da pianificare”</span> nella barra in alto, poi trascinale nel calendario
            o premi <Icon name="spark" className="inline size-3.5" /> per trovare uno spazio libero.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="panel rows overflow-hidden rounded-xl">
            {p.backlog.map((e) => (
              <div
                key={e.id}
                draggable
                onDragStart={(ev) => {
                  ev.dataTransfer.setData("text/x-cal-id", e.id);
                  ev.dataTransfer.setData("text/plain", e.id);
                  ev.dataTransfer.setData(`text/x-cal-min-${e.minutes ?? 60}`, "");
                  ev.dataTransfer.effectAllowed = "move";
                }}
                className="group flex cursor-grab items-center gap-2.5 py-2 pr-1.5 pl-3 transition-colors hover:bg-white/[0.03] active:cursor-grabbing"
              >
                <span className="h-7 w-1 shrink-0 rounded-full" style={{ background: colorOf(p.categories, e.category) }} />
                <button onClick={() => p.onOpenBacklog(e)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium">{e.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {durationLabel(e.minutes ?? 60)}
                    {e.due ? ` · entro ${dayLabel(e.due)}` : ""}
                    {e.by !== "tu" ? ` · da ${p.byName(e.by)}` : ""}
                  </span>
                </button>
                <button
                  onClick={() => p.onPlace(e)}
                  title="Mettilo nel primo spazio libero"
                  aria-label={`Trova uno spazio per ${e.title}`}
                  className="press icon-btn rounded-lg!"
                >
                  <Icon name="spark" className="size-4" />
                </button>
              </div>
            ))}
            </div>
            <p className="hidden px-1 text-xs text-muted lg:block">Trascinali nella griglia per fissarli a un orario.</p>
          </div>
        )}
      </Block>

      <TimeStats occs={p.occs} categories={p.categories} from={p.statsFrom} to={p.statsTo} label={p.statsLabel} />

      {p.extra}

      {p.log.length > 0 && (
        <Block title="Ultime modifiche">
          <div className="space-y-1.5">
            {p.log.slice(0, 5).map((l, i) => (
              <div key={`${l.at}-${i}`} className="flex gap-2 text-[12px] leading-snug">
                <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${l.by === "tu" ? "bg-white/40" : "bg-white"}`} />
                <span className="min-w-0 text-muted">
                  <span className="font-medium text-fg">{l.by === "tu" ? "Tu" : p.byName(l.by)}</span> {l.action} <span className="text-soft">«{l.title}»</span> ·{" "}
                  {ago(l.at)}
                </span>
              </div>
            ))}
          </div>
        </Block>
      )}
    </div>
  );
}

/** Dove va il tuo tempo nel periodo che stai guardando: ore per categoria e quanto è stato fatto. */
function TimeStats({ occs, categories, from, to, label }: { occs: Occurrence[]; categories: Category[]; from: string; to: string; label: string }) {
  const rows = timeByCategory(occs, from, to);
  const total = rows.reduce((s, r) => s + r.minutes, 0);
  const done = rows.reduce((s, r) => s + r.done, 0);
  return (
    <Block title={`Dove va il tempo · ${label}`}>
      {total === 0 ? (
        <p className="text-[13px] text-muted">Ancora niente in calendario in questo periodo.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.05]">
            {rows.map((r) => (
              <span key={r.category} title={categories.find((c) => c.id === r.category)?.name ?? "Senza categoria"} style={{ width: `${(r.minutes / total) * 100}%`, background: colorOf(categories, r.category) }} className="h-full border-r border-black/60 last:border-0" />
            ))}
          </div>
          <div className="space-y-1.5">
            {rows.map((r) => (
              <div key={r.category} className="flex items-center gap-2 text-[13px]">
                <span className="size-2 shrink-0 rounded-full" style={{ background: colorOf(categories, r.category) }} />
                <span className="min-w-0 flex-1 truncate">{categories.find((c) => c.id === r.category)?.name ?? "Senza categoria"}</span>
                {r.done > 0 && <span className="text-[11px] text-muted tabular-nums">{Math.round((r.done / r.minutes) * 100)}% fatto</span>}
                <span className="w-14 text-right font-medium tabular-nums">{fmtHours(r.minutes)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between border-t border-line pt-2.5 text-xs text-muted">
            <span>Totale pianificato</span>
            <span className="tabular-nums">
              {fmtHours(total)}
              {done > 0 ? ` · ${fmtHours(done)} fatte` : ""}
            </span>
          </div>
        </div>
      )}
    </Block>
  );
}

const fmtHours = (m: number) => (m < 60 ? `${Math.round(m)}m` : `${(m / 60).toLocaleString("it-IT", { maximumFractionDigits: 1 })}h`);

export function RequestCard({ r, byName, onToast }: { r: CalRequest; byName: (id: string) => string; onToast: (t: Toast) => void }) {
  const [busy, setBusy] = useState(false);
  const decide = async (status: "approved" | "rejected", apply: boolean) => {
    setBusy(true);
    try {
      await decideRequest(r.id, status, apply);
      onToast({ text: status === "approved" ? (apply ? "Richiesta applicata" : "Segnata come fatta") : "Richiesta rifiutata" });
    } catch (e) {
      onToast({ text: e instanceof Error ? e.message : "Errore", error: true });
    }
    setBusy(false);
  };
  const what = r.text ?? describePayload(r);
  const auto = r.action !== "other" && (r.payload || r.text);
  return (
    <div className="panel space-y-2 rounded-xl p-3.5">
      <div className="text-xs text-muted">
        <span className="font-semibold text-fg">{byName(r.by)}</span> · {ago(r.createdAt)}
        {r.status !== "pending" && ` · ${r.status === "approved" ? "approvata" : "rifiutata"}${r.decidedBy ? ` da ${r.decidedBy === "tu" ? "te" : byName(r.decidedBy)}` : ""}`}
      </div>
      <p className="text-sm leading-snug">{what}</p>
      {r.note && <p className="text-[12px] text-muted italic">“{r.note}”</p>}
      {r.status === "pending" && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {auto && (
            <button disabled={busy} onClick={() => decide("approved", true)} className="press hit chrome h-8 rounded-full px-3.5 text-[13px] font-semibold disabled:opacity-50">
              Applica
            </button>
          )}
          <button disabled={busy} onClick={() => decide("approved", false)} className="press hit h-8 rounded-full px-3 text-[13px] text-soft shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1)] hover:bg-white/[0.05] hover:text-fg disabled:opacity-50">
            Fatto a mano
          </button>
          <button disabled={busy} onClick={() => decide("rejected", false)} className="press hit h-8 rounded-full px-3 text-[13px] text-muted hover:bg-[#e66767]/10 hover:text-danger disabled:opacity-50">
            Rifiuta
          </button>
        </div>
      )}
    </div>
  );
}

function describePayload(r: CalRequest) {
  const p = r.payload ?? {};
  const verb = r.action === "create" ? "Aggiungere" : r.action === "update" ? "Modificare" : r.action === "delete" ? "Eliminare" : "Richiesta";
  const title = typeof p.title === "string" ? `«${p.title}»` : Array.isArray(p.events) ? `${p.events.length} eventi` : r.target ? "un evento" : "";
  const when = typeof p.start === "string" ? ` → ${p.start.replace("T", " ")}` : "";
  return `${verb} ${title}${when}${r.occurrence ? ` (solo il ${r.occurrence})` : ""}`;
}

export function Block({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h3 className="eyebrow truncate">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Small({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="press hit -mr-2 h-8 shrink-0 rounded-full px-2.5 text-[13px] font-medium text-muted hover:bg-white/[0.06] hover:text-fg">
      {children}
    </button>
  );
}
