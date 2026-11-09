"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { ACTIVE_STAGES, stageOf, type UgcConcept } from "@/lib/ugc";
import { formatOf } from "@/lib/ugc-library";
import type { BriefSummary } from "@/lib/ugc-store";
import { STAGE_TONE, StageBadge, briefTitle, chosenHook, stageTurn, nameOf, type UgcOverview } from "./common";
import { since } from "./regia-events";
import type { WorkflowNode } from "./workflow";

// Sotto lo schema: cosa c'è nel blocco scelto (concept della fase, o i brief),
// oppure, senza scelta, "In lavorazione": gli ultimi concept toccati in tutta la catena.

const CELL = "bg-[#0b0b0b]";

export function StageDrawer({ data, node, now, onClose }: { data: UgcOverview; node: WorkflowNode | null; now: number; onClose: () => void }) {
  return (
    <div key={node ?? "tutto"} className="animate-rise">
      {node === null ? <Working data={data} now={now} /> : node === "brief" ? <Briefs data={data} now={now} onClose={onClose} /> : <Stage data={data} node={node} now={now} onClose={onClose} />}
    </div>
  );
}

function Frame({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="panel overflow-hidden rounded-[1.25rem]">
      <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5">{head}</div>
      {children}
    </div>
  );
}

/** Righe in una griglia a 1 o 2 colonne, separate da fili (il fondo traspare tra le celle). */
function Grid({ children, count }: { children: ReactNode; count: number }) {
  return (
    <div className="grid gap-px border-t border-line bg-white/[0.08] md:grid-cols-2">
      {children}
      {count % 2 === 1 && <span aria-hidden className={`hidden md:block ${CELL}`} />}
    </div>
  );
}

function CloseBtn({ onClose }: { onClose: () => void }) {
  return (
    <button onClick={onClose} aria-label="Chiudi il blocco" className="press -mt-1 -mr-2 grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-white/[0.06] hover:text-fg">
      <Icon name="close" className="size-4" />
    </button>
  );
}

function Working({ data, now }: { data: UgcOverview; now: number }) {
  const items = data.concepts
    .filter((c) => ACTIVE_STAGES.includes(c.stage))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 6);
  const total = data.concepts.filter((c) => ACTIVE_STAGES.includes(c.stage)).length;
  return (
    <Frame
      head={
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">In lavorazione</p>
          <p className="text-xs text-muted">{total ? `${total} concept in catena · tocca un blocco per vederne la fase` : "Niente in catena adesso"}</p>
        </div>
      }
    >
      {items.length ? (
        <Grid count={items.length}>
          {items.map((c, i) => (
            <ConceptCell key={c.id} c={c} data={data} now={now} badge className={i >= 4 ? "max-md:hidden" : ""} />
          ))}
        </Grid>
      ) : (
        <p className="border-t border-line px-4 py-6 text-center text-sm text-muted sm:px-5">
          {data.briefList.length ? "Crea un concept: il regista lo sviluppa, il critico lo giudica, e la catena parte da sola." : "Parti da un brief, poi un concept: il resto lo fanno i bot."}
        </p>
      )}
    </Frame>
  );
}

function Stage({ data, node, now, onClose }: { data: UgcOverview; node: Exclude<WorkflowNode, "brief">; now: number; onClose: () => void }) {
  const s = stageOf(node);
  const items = data.concepts.filter((c) => c.stage === node).sort((a, b) => b.updatedAt - a.updatedAt);
  const turn = stageTurn(node, data.settings, data.bots);
  const role = s.role && s.role !== "tu" ? s.role : null;
  const bot = role ? data.settings.roles[role] : null;
  const botName = bot ? nameOf(data, bot) : turn.who;
  const who =
    node === "pronto" ? "Tocca a te: guarda e decidi" : !turn.role ? "" : botName.toLowerCase() === turn.role.toLowerCase() ? botName : `${turn.role} · ${botName}`;
  return (
    <Frame
      head={
        <>
          <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: STAGE_TONE[node] }} />
          <div className="min-w-0 flex-1">
            <p className="flex items-baseline gap-2 text-sm font-semibold">
              {s.label}
              <span className="font-normal text-muted tabular-nums">{items.length}</span>
            </p>
            {who && <p className={`truncate text-xs ${turn.assigned ? "text-soft" : "text-muted"}`}>{who}</p>}
            <p className="mt-1 line-clamp-2 max-w-2xl text-xs leading-relaxed text-muted">{s.todo}</p>
          </div>
          <CloseBtn onClose={onClose} />
        </>
      }
    >
      {items.length ? (
        <Grid count={items.length}>
          {items.map((c) => (
            <ConceptCell key={c.id} c={c} data={data} now={now} />
          ))}
        </Grid>
      ) : (
        <p className="border-t border-line px-4 py-6 text-center text-sm text-muted sm:px-5">Nessun concept in questa fase.</p>
      )}
    </Frame>
  );
}

function Briefs({ data, now, onClose }: { data: UgcOverview; now: number; onClose: () => void }) {
  const order: Record<BriefSummary["status"], number> = { attivo: 0, "in pausa": 1, chiuso: 2 };
  const items = [...data.briefList].sort((a, b) => order[a.status] - order[b.status] || b.updatedAt - a.updatedAt);
  return (
    <Frame
      head={
        <>
          <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-[#6e6e6e]" />
          <div className="min-w-0 flex-1">
            <p className="flex items-baseline gap-2 text-sm font-semibold">
              Brief <span className="font-normal text-muted tabular-nums">{items.length}</span>
            </p>
            <p className="text-xs text-muted">Prodotto, chi compra, il problema e le prove: da qui partono i concept.</p>
          </div>
          <Link href="/ugc/brief" className="press -mt-1 inline-flex h-10 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-medium text-muted hover:bg-white/[0.05] hover:text-fg">
            Tutti <Icon name="forward" className="size-3.5" />
          </Link>
          <CloseBtn onClose={onClose} />
        </>
      }
    >
      {items.length ? (
        <Grid count={Math.min(items.length, 6)}>
          {items.slice(0, 6).map((b) => (
            <Link key={b.id} href={`/ugc/brief/${b.id}`} className={`${CELL} row-link block min-w-0 space-y-1 px-4 py-3.5 sm:px-5`}>
              <p className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{b.title}</span>
                {b.status !== "attivo" && <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-muted">{b.status}</span>}
              </p>
              <p className="truncate text-xs text-soft">{b.productName}</p>
              <p className="line-clamp-1 text-[13px] text-muted">{b.target}</p>
              <p className="flex flex-wrap gap-x-3 pt-0.5 text-[11px] text-muted tabular-nums">
                <span>
                  <b className="font-semibold text-fg">{b.active}</b> in catena
                </span>
                <span>
                  <b className="font-semibold text-fg">{b.concepts}</b> concept
                </span>
                {b.winners > 0 && (
                  <span>
                    <b className="font-semibold text-[#3fcf9b]">{b.winners}</b> {b.winners === 1 ? "vincente" : "vincenti"}
                  </span>
                )}
                <span>{since(b.updatedAt, now)}</span>
              </p>
            </Link>
          ))}
        </Grid>
      ) : (
        <p className="border-t border-line px-4 py-6 text-center text-sm text-muted sm:px-5">Ancora nessun brief.</p>
      )}
    </Frame>
  );
}

/** Concept come riga ricca: titolo, brief, format, hook scelto, bot e tempo. */
function ConceptCell({ c, data, now, badge, className = "" }: { c: UgcConcept; data: UgcOverview; now: number; badge?: boolean; className?: string }) {
  const hook = chosenHook(c);
  const fmt = formatOf(c.format);
  return (
    <Link href={`/ugc/${c.id}`} className={`${CELL} row-link group block min-w-0 space-y-1.5 px-4 py-3.5 sm:px-5 ${className}`}>
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 text-[15px] leading-snug font-medium">{c.title}</span>
        {badge && <StageBadge stage={c.stage} small />}
      </div>
      <p className="truncate text-xs text-muted">
        {briefTitle(data.briefList, c.briefId)}
        {fmt ? ` · ${fmt.name}` : ""}
      </p>
      {hook?.text && <p className="line-clamp-2 border-l border-white/15 pl-2.5 text-[13px] leading-snug text-soft">“{hook.text}”</p>}
      <p className="flex items-center gap-1.5 text-[11px] text-muted">
        <span className="truncate">{nameOf(data, c.owner ?? c.by)}</span>
        <span aria-hidden>·</span>
        <span className="shrink-0 tabular-nums">{since(c.updatedAt, now)}</span>
      </p>
    </Link>
  );
}
