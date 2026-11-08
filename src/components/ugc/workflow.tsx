"use client";

import { useMemo, useState } from "react";
import type { StageId } from "@/lib/ugc";
import type { UgcOverview } from "./common";
import { Block } from "./workflow-block";
import { buildNodes, INTRO, whoText } from "./workflow-model";
import { LoopTags, useGeometry, useNow, useReducedMotion, Wires } from "./workflow-wires";

// Schema del workflow della factory: blocchi collegati (Brief → … → Vincente) con i ritorni "da rifare"
// e l'uscita laterale Scartato. Desktop: due righe a serpentina. Telefono: colonna con binario.

export type WorkflowNode = StageId | "brief";

export type WorkflowProps = {
  data: UgcOverview;
  /** Blocco selezionato: sotto lo schema la regia mostra i concept di quella fase. */
  selected: WorkflowNode | null;
  onSelect: (node: WorkflowNode | null) => void;
};

export function Workflow({ data, selected, onSelect }: WorkflowProps) {
  const now = useNow();
  const still = useReducedMotion();
  const nodes = useMemo(() => buildNodes(data, now), [data, now]);
  const [hover, setHover] = useState<WorkflowNode | null>(null);
  const { wrapRef, setNode, geo } = useGeometry();

  const focus = hover ?? selected;
  const shown = nodes.find((n) => n.id === focus);
  const doing = shown?.who.kind === "bot" ? shown.who.doing : undefined;

  return (
    <div
      className="@container"
      onKeyDown={(e) => {
        if (e.key === "Escape" && selected) onSelect(null);
      }}
    >
      <p className="mb-3 text-[12.5px] leading-snug text-muted @min-[820px]:hidden">{INTRO}</p>

      <div
        ref={wrapRef}
        role="group"
        aria-label="Ciclo di lavoro della UGC Factory"
        className="relative pr-[18px] pl-[14px] @min-[820px]:pt-12 @min-[820px]:pr-10 @min-[820px]:pb-9 @min-[820px]:pl-0"
      >
        {geo && <Wires geo={geo} focus={focus} still={still} />}
        <div className="flex flex-col gap-[22px] @min-[820px]:grid @min-[820px]:grid-cols-5 @min-[820px]:gap-x-8 @min-[820px]:gap-y-16 @min-[960px]:gap-x-10">
          {nodes.map((n) => (
            <Block
              key={n.id}
              n={n}
              selected={selected === n.id}
              innerRef={setNode(n.id)}
              onClick={() => onSelect(selected === n.id ? null : n.id)}
              onHover={(on) => setHover((h) => (on ? n.id : h === n.id ? null : h))}
            />
          ))}
        </div>
        {geo && <LoopTags geo={geo} focus={focus} />}
      </div>

      {/* desktop: didascalia che segue il blocco sotto il mouse (o quello scelto), e legenda */}
      <div className="mt-1 hidden min-h-[52px] items-start gap-6 border-t border-white/[0.06] pt-3.5 @min-[820px]:flex">
        <p aria-live="polite" className="min-w-0 flex-1 text-[13px] leading-relaxed text-muted">
          {shown ? (
            <>
              <span className="font-medium text-fg">{shown.label}</span>
              {shown.role && (
                <span className="text-soft">
                  {" "}
                  · {shown.role}
                  {(shown.who.kind === "bot" || shown.who.kind === "none") && whoText(shown.who) !== shown.role ? ` (${whoText(shown.who)})` : ""}
                </span>
              )}
              <span className="text-[#555]"> — </span>
              {shown.todo}
              {doing && <span className="text-soft"> Ora: {doing}.</span>}
            </>
          ) : (
            INTRO
          )}
        </p>
        <ul aria-hidden className="flex shrink-0 items-center gap-4 pt-0.5 text-[11px] text-muted">
          <li className="flex items-center gap-1.5">
            <span className="size-[9px] rotate-45 rounded-[2px] border border-white/30" />
            decisione
          </li>
          <li className="flex items-center gap-1.5">
            <svg viewBox="0 0 18 6" className="h-1.5 w-[18px]" fill="none" stroke="rgb(255 255 255 / 0.45)" strokeWidth="1.2" strokeDasharray="2.5 2.5">
              <path d="M0 3h18" />
            </svg>
            da rifare
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-white shadow-[0_0_6px_rgb(255_255_255/0.8)]" />
            bot online
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-white ring-[3px] ring-white/20" />
            attivo ora
          </li>
        </ul>
      </div>
    </div>
  );
}
