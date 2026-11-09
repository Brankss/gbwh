"use client";

import { Icon, type IconName } from "@/components/icons";
import type { PresenceView } from "@/lib/presence";
import { ROLES, STAGES, type RoleId, type StageId, type UgcLogEntry, type UgcSettings } from "@/lib/ugc";
import { STAGE_TONE, nameOf, type UgcOverview } from "./common";

// Regia: come si legge un evento del registro (icona, frase breve, dettaglio), il tempo relativo
// e chi della squadra è sveglio. Tutto calcolato da `now` (useNow), mai da Date.now durante il render.

export type EventView = {
  icon: IconName;
  /** Frase breve: "Concept approvato", "Video v2 caricato"… */
  label: string;
  /** Dettaglio facoltativo: voto, correzioni, piattaforma… */
  detail?: string;
  /** Colore del puntino/icona. */
  tone: string;
  /** Evento "di peso" (video pronto, vincente): in evidenza nel live. */
  big?: boolean;
  /** Rumore di servizio (il bot che prende o lascia un concept): fuori dal live e dal feed. */
  quiet?: boolean;
};

const NEUTRAL = "#a8a8a8";
const GOOD = "#3fcf9b";
const WARN = "#e0a030";
const stageByLabel = (label: string) => STAGES.find((s) => s.label === label)?.id as StageId | undefined;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Traduce l'azione del registro (scritta dallo store) in una frase breve e un'icona. */
export function describe(e: UgcLogEntry): EventView {
  const a = e.action.trim();

  // Cambio di fase: "Da approvare → Script (voto 8/10)"
  const move = a.match(/^(.+?) → (.+?)(?: \((.*)\))?$/);
  if (move) {
    const from = stageByLabel(move[1]);
    const to = stageByLabel(move[2]);
    const note = move[3];
    if (to) {
      if (to === "scartato") return { icon: "close", label: "Scartato", detail: note, tone: STAGE_TONE.scartato };
      if (from === "gate" && to === "script") return { icon: "check", label: "Concept approvato", detail: note, tone: GOOD };
      if (from === "gate" && to === "idea") return { icon: "repeat", label: "Concept da rifare", detail: note, tone: WARN };
      if (from === "revisione" && to === "pronto") return { icon: "play", label: "Video pronto", detail: note, tone: STAGE_TONE.pronto, big: true };
      if (from === "revisione" && to === "produzione") return { icon: "repeat", label: "Video da rifare", detail: note, tone: WARN };
      if (to === "gate") return { icon: "forward", label: "Concept al critico", detail: note, tone: STAGE_TONE.gate };
      if (to === "produzione") return { icon: "film", label: from === "script" ? "Script finito, si produce" : "In produzione", detail: note, tone: STAGE_TONE.produzione };
      if (to === "revisione") return { icon: "film", label: "Video in revisione", detail: note, tone: STAGE_TONE.revisione };
      if (to === "pronto") return { icon: "play", label: "Video pronto", detail: note, tone: STAGE_TONE.pronto, big: true };
      if (to === "in_test") return { icon: "chart", label: "Messo in test", detail: note, tone: STAGE_TONE.in_test };
      if (to === "vincente") return { icon: "star", label: "Vincente", detail: note, tone: STAGE_TONE.vincente, big: true };
      return { icon: "forward", label: `Passato a ${STAGES.find((s) => s.id === to)!.label}`, detail: note, tone: STAGE_TONE[to] };
    }
  }

  let m: RegExpMatchArray | null;
  if ((m = a.match(/^video v(\d+) caricato/))) return { icon: "film", label: `Video v${m[1]} caricato`, tone: STAGE_TONE.produzione };
  if ((m = a.match(/^video v(\d+) (modificato|eliminato)/))) return { icon: m[2] === "eliminato" ? "trash" : "sliders", label: `Video v${m[1]} ${m[2]}`, tone: NEUTRAL };
  if (a === "nuovo concept") return { icon: "spark", label: "Nuovo concept", tone: STAGE_TONE.idea };
  if (a === "nuovo brief") return { icon: "folder", label: "Nuovo brief", tone: NEUTRAL };
  if (a === "brief modificato") return { icon: "sliders", label: "Brief aggiornato", tone: NEUTRAL };
  if ((m = a.match(/^ricerca \((.+)\)$/))) return { icon: "inbox", label: "Ricerca", detail: m[1], tone: NEUTRAL };
  if ((m = a.match(/^concept modificato \((.+)\)$/))) return { icon: "sliders", label: "Concept aggiornato", detail: m[1], tone: NEUTRAL, quiet: m[1].trim() === "owner" };
  if ((m = a.match(/^numeri (\S+)(?: (\S+))?/))) return { icon: "chart", label: "Nuovi numeri", detail: m[1], tone: STAGE_TONE.in_test };
  if ((m = a.match(/^playbook \((.+)\)$/))) return { icon: "star", label: "Lezione nel Playbook", detail: m[1], tone: NEUTRAL };
  if (a === "playbook modificato") return { icon: "star", label: "Playbook aggiornato", tone: NEUTRAL };
  if (a === "domanda") return { icon: "chat", label: "Domanda", tone: NEUTRAL };
  if (a === "risposta") return { icon: "chat", label: "Hai risposto", tone: NEUTRAL };
  if (a === "domanda chiusa") return { icon: "check", label: "Domanda chiusa", tone: NEUTRAL };
  if (a === "squadra aggiornata") return { icon: "sliders", label: "Squadra aggiornata", tone: NEUTRAL };
  if (/eliminat[oa]$/.test(a)) return { icon: "trash", label: cap(a), tone: STAGE_TONE.scartato };
  return { icon: "spark", label: cap(a), tone: NEUTRAL };
}

/** Eventi che contano (senza il rumore di servizio). */
export const visible = (log: UgcLogEntry[]) => log.filter((e) => !describe(e).quiet);

/** Icona tonda dell'evento, con l'alone del suo colore. */
export function EventIcon({ view, size = "md" }: { view: EventView; size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "size-12" : size === "md" ? "size-8" : "size-7";
  const ico = size === "lg" ? "size-5" : size === "md" ? "size-3.5" : "size-3";
  return (
    <span
      className={`relative grid shrink-0 place-items-center rounded-full ${box}`}
      style={{ background: `color-mix(in srgb, ${view.tone} 13%, #0b0b0b)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${view.tone} 30%, transparent)`, color: view.tone }}
    >
      <Icon name={view.icon} className={`${ico} ${view.icon === "play" ? "translate-x-px" : ""}`} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Tempo                                                               */
/* ------------------------------------------------------------------ */

/** "adesso", "4 min fa", "2 h fa", "ieri", "3 g fa", "5 nov". Vuoto durante il prerender (now = 0). */
export function since(ts: number, now: number) {
  if (!now) return "";
  const s = Math.max(0, (now - ts) / 1000);
  if (s < 60) return "adesso";
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min fa`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h fa`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ieri";
  if (d < 7) return `${d} g fa`;
  return new Date(ts).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export const clock = (ts: number) => new Date(ts).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

const dayStart = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Etichetta del giorno per il feed: "Oggi", "Ieri", "lunedì 3 novembre". */
export function dayLabel(ts: number, now: number) {
  if (now) {
    const diff = Math.round((dayStart(now) - dayStart(ts)) / 86_400_000);
    if (diff <= 0) return "Oggi";
    if (diff === 1) return "Ieri";
  }
  return cap(new Date(ts).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" }));
}
export const dayKey = (ts: number) => dayStart(ts);

/* ------------------------------------------------------------------ */
/* Squadra                                                             */
/* ------------------------------------------------------------------ */

/** Ruoli che un bot ha nella factory ("Critico", "Regista e Critico"). */
export function rolesOf(settings: UgcSettings | undefined, bot: string | undefined) {
  if (!settings || !bot) return [] as RoleId[];
  return ROLES.filter((r) => settings.roles[r.id] === bot).map((r) => r.id);
}
export const roleLabel = (id: RoleId) => ROLES.find((r) => r.id === id)!.label;
export const rolesText = (ids: RoleId[]) => ids.map(roleLabel).join(" e ");

/** I ruoli di un bot da scrivere accanto al nome; vuoto se il nome li dice già (bot chiamato "Critico"). */
export function rolesBeside(data: Pick<UgcOverview, "bots" | "presence" | "settings">, bot: string | undefined) {
  const text = rolesText(rolesOf(data.settings, bot));
  return text && text.toLowerCase() !== nameOf(data, bot).toLowerCase() ? text : "";
}

/** Ultimo segnale di vita di un bot (gli id della presenza sono minuscoli). */
export const presenceOf = (presence: PresenceView[] | undefined, bot: string | null | undefined) =>
  bot ? presence?.find((p) => p.agent === bot.toLowerCase()) : undefined;

/** I bot della squadra (ruoli assegnati), senza doppioni, e quanti sono online adesso. */
export function teamPulse(settings: UgcSettings, presence: PresenceView[]) {
  const team = [...new Set(Object.values(settings.roles).filter((b): b is string => !!b))];
  const online = team.filter((b) => presenceOf(presence, b)?.online);
  return { team, online };
}

/** Puntino "vivo": pulsa piano quando è acceso. */
export function LiveDot({ on = true, tone = GOOD, className = "" }: { on?: boolean; tone?: string; className?: string }) {
  return (
    <span className={`relative inline-flex size-2 shrink-0 ${className}`} aria-hidden>
      {on && <span className="absolute inset-0 animate-ping rounded-full opacity-50" style={{ background: tone, animationDuration: "2.4s" }} />}
      <span className="relative size-2 rounded-full" style={{ background: on ? tone : "#4a4a4a" }} />
    </span>
  );
}
