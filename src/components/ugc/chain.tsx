"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { Empty } from "@/components/kit";
import { ago } from "@/lib/client";
import { ACTIVE_STAGES, stageOf, type StageId, type UgcConcept } from "@/lib/ugc";
import { formatOf } from "@/lib/ugc-library";
import { GROUP, ROW_LINK, STAGE_TONE, briefTitle, chosenHook, stageTurn, whoName, type UgcOverview } from "./common";

// La catena: una colonna per fase viva (desktop), selettore di fase + lista (telefono).

export function Chain({ data }: { data: UgcOverview }) {
  const [brief, setBrief] = useState("tutti");
  const [mobileStage, setMobileStage] = useState<StageId | null>(null);

  const concepts = brief === "tutti" ? data.concepts : data.concepts.filter((c) => c.briefId === brief);
  const byStage = (s: StageId) => concepts.filter((c) => c.stage === s).sort((a, b) => b.updatedAt - a.updatedAt);
  const live = concepts.filter((c) => ACTIVE_STAGES.includes(c.stage));
  // Sul telefono si parte dalla prima fase che ha qualcosa. "Pronto" è già nella striscia "Tocca a te".
  const firstBusy = ACTIVE_STAGES.find((s) => s !== "pronto" && byStage(s).length) ?? (byStage("pronto").length ? "pronto" : "idea");
  const stage = mobileStage ?? firstBusy;
  const briefsWithConcepts = data.briefList.filter((b) => b.concepts > 0);
  const [board, setBoard] = useState({ start: true, end: false });
  // Bordo sfumato solo dove c'è ancora qualcosa da scorrere.
  const boardRef = useRef<HTMLDivElement | null>(null);
  const measureBoard = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const next = { start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 };
    setBoard((b) => (b.start === next.start && b.end === next.end ? b : next));
  }, []);
  // Rimisura quando cambia la larghezza della finestra o il contenuto (filtro per brief).
  const attachBoard = useCallback(
    (el: HTMLDivElement | null) => {
      boardRef.current = el;
      if (!el) return;
      const ro = new ResizeObserver(() => measureBoard(el));
      ro.observe(el);
      for (const child of el.children) ro.observe(child);
      return () => ro.disconnect();
    },
    [measureBoard],
  );

  if (!data.concepts.length) {
    return (
      <Empty icon="film" title="La catena è vuota">
        {data.briefList.length ? "Crea il primo concept da un brief: il regista lo sviluppa, il critico lo giudica." : "Parti da un brief (prodotto, target, problema), poi crea il primo concept."}
      </Empty>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 truncate text-sm text-muted">
          <b className="font-semibold text-fg tabular-nums">{live.length}</b> in catena
          {byStage("vincente").length > 0 && (
            <span className="hidden sm:inline">
              {" · "}
              <b className="font-semibold text-fg tabular-nums">{byStage("vincente").length}</b> vincenti
            </span>
          )}
        </p>
        {briefsWithConcepts.length > 1 && (
          <label className="relative shrink-0">
            <span className="sr-only">Filtra per brief</span>
            <select
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              className={`press h-9 max-w-[11rem] appearance-none truncate rounded-full border bg-transparent pr-8 pl-3.5 text-[13px] outline-none sm:max-w-[16rem] ${
                brief === "tutti" ? "border-white/10 text-[#b4b4b4]" : "border-white/30 font-medium text-fg"
              }`}
            >
              <option value="tutti">Tutti i brief</option>
              {briefsWithConcepts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
            <Icon name="forward" className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 rotate-90 text-muted" />
          </label>
        )}
        {/* Desktop: frecce per scorrere la catena quando non sta tutta in pagina */}
        {!(board.start && board.end) && (
          <div className="hidden shrink-0 gap-1.5 md:flex">
            {([-1, 1] as const).map((dir) => (
              <button
                key={dir}
                onClick={() => boardRef.current?.scrollBy({ left: dir * 540, behavior: "smooth" })}
                disabled={dir < 0 ? board.start : board.end}
                aria-label={dir < 0 ? "Fasi precedenti" : "Fasi successive"}
                className="press grid size-9 place-items-center rounded-full border border-white/10 text-[#b4b4b4] hover:border-white/25 hover:text-fg disabled:opacity-30"
              >
                <Icon name={dir < 0 ? "back" : "forward"} className="size-4" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Telefono: selettore di fase con i numeri, poi la lista di quella fase */}
      <div className="space-y-3 md:hidden">
        <div className="scroll-thin -mx-4 flex snap-x scroll-px-4 gap-1.5 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Fase">
          {ACTIVE_STAGES.map((s) => {
            const on = s === stage;
            const n = byStage(s).length;
            return (
              <button
                key={s}
                role="tab"
                aria-selected={on}
                ref={on ? (el) => el?.scrollIntoView({ block: "nearest", inline: "nearest" }) : undefined}
                onClick={() => setMobileStage(s)}
                className={`press flex h-9 shrink-0 snap-start items-center gap-1.5 rounded-full px-3 text-[13px] whitespace-nowrap ${
                  on ? "gloss font-semibold text-fg" : n ? "border border-white/10 text-[#b4b4b4]" : "border border-white/[0.06] text-muted/70"
                }`}
              >
                <span className="size-1.5 rounded-full" style={{ background: STAGE_TONE[s] }} />
                {stageOf(s).label}
                <span className={`tabular-nums ${on ? "text-[#b4b4b4]" : "text-muted"}`}>{n}</span>
              </button>
            );
          })}
        </div>
        <Column stage={stage} items={byStage(stage)} data={data} />
      </div>

      {/* Desktop: le fasi una accanto all'altra */}
      <div className="relative hidden md:block">
        <div
          ref={attachBoard}
          onScroll={(e) => measureBoard(e.currentTarget)}
          className="scroll-thin flex snap-x snap-mandatory items-start gap-2.5 overflow-x-auto pb-3"
        >
          {ACTIVE_STAGES.map((s) => {
            const items = byStage(s);
            // Le fasi vuote restano strette: la catena si legge tutta, senza scorrere a vuoto.
            return (
              <div key={s} className={`snap-start ${items.length ? "min-w-[15rem] flex-1 basis-[15rem]" : "w-[9.5rem] shrink-0"}`}>
                <Column stage={s} items={items} data={data} />
              </div>
            );
          })}
        </div>
        {/* sfumatura ai bordi quando c'è altro da scorrere */}
        {!board.end && <span aria-hidden className="pointer-events-none absolute top-0 right-0 bottom-3 w-16 bg-gradient-to-l from-bg to-transparent" />}
        {!board.start && <span aria-hidden className="pointer-events-none absolute top-0 bottom-3 left-0 w-10 bg-gradient-to-r from-bg to-transparent" />}
      </div>

      {!live.length && <p className="text-sm text-muted">Niente in lavorazione{brief !== "tutti" ? " per questo brief" : ""}.</p>}

      <Outcome title="Vincenti" stage="vincente" items={byStage("vincente")} data={data} />
      <Outcome title="Scartati" stage="scartato" items={byStage("scartato")} data={data} />
    </div>
  );
}

function Column({ stage, items, data }: { stage: StageId; items: UgcConcept[]; data: UgcOverview }) {
  const turn = stageTurn(stage, data.settings, data.bots);
  const mine = stage === "pronto";
  return (
    <section className={`${GROUP} ${mine && items.length ? "ring-1 ring-white/20" : ""}`} aria-label={stageOf(stage).label}>
      <header className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: STAGE_TONE[stage] }} />
          <h3 className="flex-1 truncate text-sm font-semibold">{stageOf(stage).label}</h3>
          <span className="text-sm text-muted tabular-nums">{items.length}</span>
        </div>
        <p className={`mt-0.5 truncate text-xs ${turn.assigned ? "text-[#a8a8a8]" : "text-muted/80"}`}>
          {mine ? "Tocca a te: guarda e decidi" : `${turn.role} · ${turn.who}`}
        </p>
      </header>
      {items.length ? (
        items.map((c) => <ConceptRow key={c.id} c={c} data={data} />)
      ) : (
        <p className="px-4 py-5 text-center text-xs text-muted/80">Vuoto</p>
      )}
    </section>
  );
}

export function ConceptRow({ c, data, showStage }: { c: UgcConcept; data: UgcOverview; showStage?: boolean }) {
  const hook = chosenHook(c);
  const fmt = formatOf(c.format);
  return (
    <Link href={`/ugc/${c.id}`} className={`${ROW_LINK} space-y-1.5`}>
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 text-[15px] leading-snug font-medium">{c.title}</span>
        {showStage && (
          <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: STAGE_TONE[c.stage] }} title={stageOf(c.stage).label} />
        )}
      </div>
      <p className="truncate text-xs text-muted">
        {briefTitle(data.briefList, c.briefId)}
        {fmt ? ` · ${fmt.name}` : ""}
      </p>
      {hook?.text && <p className="line-clamp-2 border-l border-white/15 pl-2.5 text-[13px] leading-snug text-[#b4b4b4]">“{hook.text}”</p>}
      <p className="flex items-center gap-1.5 text-[11px] text-muted">
        <span className="truncate">{whoName(data.bots, c.owner ?? c.by)}</span>
        <span aria-hidden>·</span>
        <span className="shrink-0">{ago(c.updatedAt)}</span>
      </p>
    </Link>
  );
}

function Outcome({ title, stage, items, data }: { title: string; stage: StageId; items: UgcConcept[]; data: UgcOverview }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <section className={GROUP}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="press flex min-h-12 w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-white/[0.03]">
        <span className="size-2 rounded-full" style={{ background: STAGE_TONE[stage] }} />
        <span className="flex-1 text-sm font-semibold">{title}</span>
        <span className="text-sm text-muted tabular-nums">{items.length}</span>
        <Icon name="forward" className={`size-4 text-muted transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && items.map((c) => <ConceptRow key={c.id} c={c} data={data} />)}
    </section>
  );
}
