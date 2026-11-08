"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Modal } from "@/components/kit";
import { send } from "@/lib/client";
import { ROLES, STAGES, type StageId } from "@/lib/ugc";
import { STAGE_TONE } from "./common";
import { Btn, ErrorLine, F, TextArea, useAction, type ConceptCtx } from "./concept-ui";

// "Sposta in…": qualsiasi fase, con una nota facoltativa che finisce nel registro e nella sveglia del bot.

export function ConceptMoveModal({ ctx, onClose }: { ctx: ConceptCtx; onClose: () => void }) {
  const current = ctx.data.concept.stage;
  const [stage, setStage] = useState<StageId | null>(null);
  const [note, setNote] = useState("");
  const { busy, error, run } = useAction();

  const save = async () => {
    if (!stage) return;
    const ok = await run(() => ctx.act(() => send("PATCH", ctx.key, { stage, note: note.trim() || undefined }, ["/api/ugc"])));
    if (ok) onClose();
  };

  return (
    <Modal
      title="Sposta in…"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose} disabled={busy}>
            Annulla
          </Btn>
          <Btn variant="chrome" onClick={save} disabled={busy || !stage}>
            {busy ? "Sposto…" : "Sposta"}
          </Btn>
        </>
      }
    >
      <div role="radiogroup" aria-label="Fase" className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.07]">
        {STAGES.map((s) => {
          const on = stage === s.id;
          const here = s.id === current;
          const role = s.role === "tu" ? "Branko" : s.role ? ROLES.find((r) => r.id === s.role)?.label : null;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={here}
              onClick={() => setStage(s.id)}
              className={`press flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left disabled:cursor-default ${on ? "bg-white/[0.07]" : "hover:bg-white/[0.03]"}`}
            >
              <span className="size-2 shrink-0 rounded-full" style={{ background: STAGE_TONE[s.id] }} />
              <span className="min-w-0 flex-1">
                <span className={`block text-[15px] ${here ? "text-muted" : "font-medium"}`}>{s.label}</span>
                {role && <span className="block text-xs text-muted">{role}</span>}
              </span>
              {here ? (
                <span className="text-xs text-muted">adesso</span>
              ) : (
                <span className={`grid size-5 place-items-center rounded-full border ${on ? "chrome border-0!" : "border-white/20"}`}>
                  {on && <Icon name="check" className="size-3" />}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <F label="Nota" hint="facoltativa">
        <TextArea value={note} onChange={setNote} placeholder="Perché lo sposti? Arriva anche al bot di turno." />
      </F>
      {error && <ErrorLine>{error}</ErrorLine>}
    </Modal>
  );
}
