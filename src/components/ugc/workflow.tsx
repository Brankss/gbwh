"use client";

import type { StageId } from "@/lib/ugc";
import type { UgcOverview } from "./common";

// Schema del workflow della factory: blocchi collegati (Brief → … → Vincente) con ritorni "da rifare".
// SEGNAPOSTO: l'implementazione vera arriva con il lavoro sullo schema. L'interfaccia (props) è fissa.

export type WorkflowNode = StageId | "brief";

export type WorkflowProps = {
  data: UgcOverview;
  /** Blocco selezionato: sotto lo schema la regia mostra i concept di quella fase. */
  selected: WorkflowNode | null;
  onSelect: (node: WorkflowNode | null) => void;
};

export function Workflow({ data, selected, onSelect }: WorkflowProps) {
  const nodes: WorkflowNode[] = ["brief", "idea", "gate", "script", "produzione", "revisione", "pronto", "in_test", "vincente"];
  return (
    <div className="flex flex-wrap gap-2">
      {nodes.map((n) => (
        <button key={n} onClick={() => onSelect(selected === n ? null : n)} className="rounded-xl border border-white/10 px-3 py-2 text-sm">
          {n} {n === "brief" ? data.briefs : data.byStage[n]}
        </button>
      ))}
    </div>
  );
}
