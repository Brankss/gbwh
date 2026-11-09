import { ROLES, STAGES, type RoleId, type StageId } from "@/lib/ugc";
import { STAGE_TONE, type UgcOverview } from "./common";
import type { WorkflowNode } from "./workflow";

// Dati dello schema: un blocco per fase, con chi ci lavora, quanti concept ci sono e se si sta muovendo qualcosa.

/** I blocchi in ordine di catena (anche ordine di tabulazione). Scartato è l'uscita laterale. */
export const CHAIN: WorkflowNode[] = ["brief", "idea", "gate", "script", "produzione", "revisione", "pronto", "in_test", "vincente", "scartato"];

/** Attivo: un concept toccato negli ultimi 15 minuti, o il bot della fase online che sta facendo qualcosa. */
export const ACTIVE_WINDOW = 15 * 60 * 1000;

export const INTRO = "Il ciclo della factory: tocca un blocco per vedere cosa c'è dentro";

export type Who =
  | { kind: "bot"; name: string; online: boolean; paused: boolean; doing?: string }
  | { kind: "you" }
  | { kind: "none" }
  | { kind: "end" };

export type NodeInfo = {
  id: WorkflowNode;
  step: number;
  label: string;
  /** Ruolo leggibile ("Regista", "Tu"); vuoto per Scartato. */
  role: string;
  todo: string;
  tone: string;
  /** Punto di decisione del critico: il blocco ha il rombo. */
  decision: boolean;
  count: number;
  unit: string;
  who: Who;
  active: boolean;
  /** Pronto con dentro qualcosa: tocca a Branko. */
  yourTurn: boolean;
};

const BRIEF = {
  label: "Brief & ricerca",
  role: "stratega" as RoleId,
  todo: "Fissa prodotto, target, problema e prove; raccogli ad dei competitor e frasi vere dei clienti; proponi gli angoli di vendita.",
};

const roleLabel = (role: string | null) => (role === "tu" ? "Tu" : role ? (ROLES.find((r) => r.id === role)?.label ?? role) : "Uscita");

function whoFor(role: string | null, data: UgcOverview): Who {
  if (role === "tu") return { kind: "you" };
  if (!role) return { kind: "end" };
  const id = data.settings?.roles?.[role as RoleId];
  if (!id) return { kind: "none" };
  const p = data.presence?.find((x) => x.agent === id.toLowerCase());
  const name = data.bots?.find((b) => b.id === id)?.name ?? p?.name ?? id;
  return { kind: "bot", name, online: !!p?.online, paused: p?.status === "in pausa", doing: p?.online ? p.doing : undefined };
}

export function buildNodes(data: UgcOverview, now: number): NodeInfo[] {
  const recent = (at: number) => now > 0 && now - at < ACTIVE_WINDOW;
  const busy = (w: Who) => w.kind === "bot" && w.online && !w.paused && !!w.doing;

  return CHAIN.map((id, i) => {
    if (id === "brief") {
      const who = whoFor(BRIEF.role, data);
      return {
        id,
        step: i + 1,
        label: BRIEF.label,
        role: roleLabel(BRIEF.role),
        todo: BRIEF.todo,
        tone: "#b8b8b8",
        decision: false,
        count: data.briefs ?? 0,
        unit: "brief",
        who,
        active: busy(who) || (data.briefList ?? []).some((b) => recent(b.updatedAt)),
        yourTurn: false,
      };
    }
    const s = STAGES.find((x) => x.id === id)!;
    const who = whoFor(s.role, data);
    const count = data.byStage?.[id as StageId] ?? 0;
    const touched = (data.concepts ?? []).some((c) => c.stage === id && recent(c.updatedAt));
    return {
      id,
      step: i + 1,
      label: s.label,
      role: roleLabel(s.role),
      todo: s.todo,
      tone: STAGE_TONE[id as StageId],
      decision: id === "gate" || id === "revisione",
      count,
      unit: "concept",
      who,
      active: id !== "scartato" && (busy(who) || touched),
      yourTurn: id === "pronto" && count > 0,
    };
  });
}

/** Nome di chi lavora nel blocco, per testi e lettori di schermo. */
export const whoText = (w: Who) => (w.kind === "bot" ? w.name : w.kind === "you" ? "Branko" : w.kind === "none" ? "nessuno" : "fine corsa");
