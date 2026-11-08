"use client";

import { Icon } from "@/components/icons";
import { ACTIVE_STAGES, ROLES, stageOf, type StageId } from "@/lib/ugc";
import { STAGE_TONE } from "./common";
import { Btn, type ConceptCtx } from "./concept-ui";

// La catena del concept: dove si trova, chi deve muoversi e cosa deve fare.

/** Dove porta il pulsante "Vai" per ogni fase. */
const JUMP: Partial<Record<StageId, { to: string; label: string }>> = {
  idea: { to: "idea", label: "Scrivi" },
  gate: { to: "revisioni", label: "Revisiona" },
  script: { to: "script", label: "Scene" },
  produzione: { to: "video", label: "Carica video" },
  revisione: { to: "revisioni", label: "Revisiona" },
  in_test: { to: "numeri", label: "Numeri" },
  vincente: { to: "playbook", label: "Playbook" },
};

export function ConceptChain({ ctx, onJump }: { ctx: ConceptCtx; onJump: (id: string) => void }) {
  const { stage } = ctx.data.concept;
  const s = stageOf(stage);
  const ended = stage === "vincente" || stage === "scartato";
  const at = ACTIVE_STAGES.indexOf(stage);
  // Uno scartato si ferma dove le revisioni lo hanno fermato: lo mostriamo come catena spenta.
  const reached = ended ? (stage === "vincente" ? ACTIVE_STAGES.length : -1) : at;

  const role = s.role;
  const roleLabel = role === "tu" ? "Branko" : role ? (ROLES.find((r) => r.id === role)?.label ?? role) : null;
  const botId = role && role !== "tu" ? ctx.settings?.roles[role] : null;
  const jump = JUMP[stage];

  return (
    <div className="matte overflow-hidden rounded-[1.25rem]">
      {/* catena */}
      <div className="px-4 pt-4 pb-3 md:px-5">
        <ol className="grid grid-cols-7 gap-1" aria-label="Fasi della catena">
          {ACTIVE_STAGES.map((id, i) => {
            const done = i < reached;
            const current = i === at && !ended;
            return (
              <li key={id} className="min-w-0" aria-current={current ? "step" : undefined}>
                <span
                  className={`block h-1.5 rounded-full transition-colors ${current ? "chrome border-0!" : done ? "bg-white/45" : "bg-white/[0.08]"}`}
                  style={ended && stage === "vincente" ? { background: STAGE_TONE.vincente, opacity: 0.75 } : undefined}
                />
                <span
                  className={`mt-2 hidden truncate text-[11px] md:block ${current ? "font-semibold text-fg" : done ? "text-[#b4b4b4]" : "text-muted/70"}`}
                  title={stageOf(id).label}
                >
                  {stageOf(id).label}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="mt-2.5 flex items-center gap-2 text-[13px] md:hidden">
          <span className="size-1.5 shrink-0 rounded-full" style={{ background: STAGE_TONE[stage] }} />
          <span className="font-semibold">{s.label}</span>
          {!ended && (
            <span className="text-muted tabular-nums">
              · fase {at + 1} di {ACTIVE_STAGES.length}
            </span>
          )}
        </div>
        {ended && (
          <div className="mt-3 hidden items-center gap-2 text-[13px] md:flex">
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: STAGE_TONE[stage] }} />
            <span className="font-semibold">{stage === "vincente" ? "Esito: vincente" : "Esito: scartato"}</span>
          </div>
        )}
      </div>

      {/* tocca a */}
      <div className="flex items-start gap-3 border-t border-white/[0.06] px-4 py-3.5 md:px-5">
        <span className="orb mt-0.5 grid size-8 shrink-0 place-items-center rounded-full">
          <Icon name={role === "tu" ? "star" : ended ? "check" : "forward"} className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px]">
            {roleLabel ? (
              <>
                <span className="text-muted">Tocca a </span>
                <span className="font-semibold">{roleLabel}</span>
                {role !== "tu" && (
                  <>
                    <span className="text-muted"> · </span>
                    {botId ? <span className="font-medium">{ctx.who(botId)}</span> : <span className="text-muted italic">nessuno assegnato</span>}
                  </>
                )}
              </>
            ) : (
              <span className="text-muted">Nessuno deve muoversi</span>
            )}
          </p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{s.todo}</p>
        </div>
        {jump && (
          <div className="hidden sm:block">
            <Btn variant="ghost" onClick={() => onJump(jump.to)}>
              {jump.label}
            </Btn>
          </div>
        )}
      </div>
      {jump && (
        <button
          onClick={() => onJump(jump.to)}
          className="press flex h-11 w-full items-center justify-center gap-1.5 border-t border-white/[0.06] text-[13px] font-medium text-[#c4c4c4] hover:bg-white/[0.03] hover:text-fg sm:hidden"
        >
          {jump.label}
          <Icon name="forward" className="size-3.5" />
        </button>
      )}
    </div>
  );
}
