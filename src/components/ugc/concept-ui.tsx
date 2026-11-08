"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Section } from "@/components/kit";
import { useAutosize } from "@/components/ui";
import type { Bot } from "@/lib/bots";
import type { ConceptFull, UgcLogEntry, UgcSettings } from "@/lib/ugc";

// Mattoncini della pagina di un concept: un contenitore per gruppo, righe separate da un filo,
// azioni silenziose ("Modifica") e un solo pulsante argento per l'azione principale di un'area.

/** Risposta di GET /api/ugc/concepts/[id]. */
export type ConceptData = ConceptFull & { log: UgcLogEntry[] };

export type ConceptCtx = {
  id: string;
  key: string;
  data: ConceptData;
  bots: Bot[];
  settings: UgcSettings | null;
  /** Ora corrente (useNow): 0 finché non è nota. */
  now: number;
  /** Esegue una scrittura, con dati ottimistici facoltativi, poi riaggiorna il concept. */
  act: (fn: () => Promise<unknown>, optimistic?: (d: ConceptData) => ConceptData) => Promise<void>;
  /** Nome da mostrare per un id bot ("tu" = Branko). */
  who: (id: string) => string;
};

/* ------------------------------------------------------------------ */
/* Tempo                                                               */
/* ------------------------------------------------------------------ */

const rtf = new Intl.RelativeTimeFormat("it", { numeric: "auto" });
/** Come `ago`, ma con l'ora passata da fuori (niente Date.now() durante il render). */
export function agoAt(ts: number, now: number) {
  if (!now) return "";
  let value = (ts - now) / 1000;
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.35, "week"],
    [12, "month"],
    [Infinity, "year"],
  ];
  for (const [size, unit] of steps) {
    if (Math.abs(value) < size) return unit === "second" ? "adesso" : rtf.format(Math.round(value), unit);
    value /= size;
  }
  return "";
}

/* ------------------------------------------------------------------ */
/* Azioni con stato (occupato / errore)                                */
/* ------------------------------------------------------------------ */

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Qualcosa è andato storto");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, run, setError };
}

/* ------------------------------------------------------------------ */
/* Struttura                                                           */
/* ------------------------------------------------------------------ */

/** Sezione con ancora (per l'indice) e il titolo come nel resto dell'hub. */
export function Block({ id, title, action, children }: { id: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div id={id} className="scroll-mt-16">
      <Section title={title} action={action}>
        {children}
      </Section>
    </div>
  );
}

/** Un solo contenitore per gruppo: righe separate da un filo. */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`matte divide-y divide-white/[0.06] overflow-hidden rounded-[1.25rem] ${className}`}>{children}</div>;
}

export function Row({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-4 py-3.5 md:px-5 ${className}`}>{children}</div>;
}

/** Etichetta piccola sopra (o accanto) a un valore. */
export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`text-[11px] font-medium tracking-[0.06em] text-muted uppercase ${className}`}>{children}</div>;
}

/** Riga etichetta + valore: impilata su telefono, affiancata da md in su. */
export function Pair({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Row className="grid gap-1 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-4">
      <Label className="md:pt-0.5">{label}</Label>
      <div className="min-w-0 text-[15px] leading-relaxed">{children}</div>
    </Row>
  );
}

export function Missing({ children = "Non ancora scritto" }: { children?: ReactNode }) {
  return <span className="text-muted italic">{children}</span>;
}

/* ------------------------------------------------------------------ */
/* Pulsanti (tutti ≥ 36px di altezza)                                  */
/* ------------------------------------------------------------------ */

type BtnVariant = "chrome" | "ghost" | "danger" | "quiet";

export function Btn({
  children,
  onClick,
  icon,
  variant = "ghost",
  type = "button",
  disabled,
  label,
  className = "",
}: {
  children?: ReactNode;
  onClick?: () => void;
  icon?: IconName;
  variant?: BtnVariant;
  type?: "button" | "submit";
  disabled?: boolean;
  /** aria-label per i pulsanti con sola icona. */
  label?: string;
  className?: string;
}) {
  const look = {
    chrome: "chrome font-semibold hover:brightness-105",
    ghost: "border border-white/10 text-[#c4c4c4] hover:border-white/25 hover:bg-white/[0.05] hover:text-fg",
    danger: "border border-[#e66767]/30 text-[#ec8585] hover:border-[#e66767]/60 hover:bg-[#e66767]/10",
    quiet: "text-muted hover:bg-white/[0.06] hover:text-fg",
  }[variant];
  const iconOnly = !children;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`press inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full text-[13px] font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40 ${
        iconOnly ? "w-9" : variant === "quiet" ? "px-3" : "px-4"
      } ${look} ${className}`}
    >
      {icon && <Icon name={icon} className="size-4" />}
      {children}
    </button>
  );
}

/** "Modifica" silenzioso nell'intestazione di una sezione. */
export function EditToggle({ onClick, children = "Modifica" }: { onClick: () => void; children?: ReactNode }) {
  return (
    <Btn variant="quiet" onClick={onClick} className="-my-2 -mr-2">
      {children}
    </Btn>
  );
}

/** Barra Annulla / Salva in fondo a una sezione in modifica. */
export function EditBar({ onCancel, onSave, busy, error, saveLabel = "Salva" }: { onCancel: () => void; onSave: () => void; busy: boolean; error?: string | null; saveLabel?: string }) {
  return (
    <Row className="flex flex-wrap items-center justify-end gap-2 bg-white/[0.015]">
      {error && <ErrorLine className="mr-auto basis-full sm:basis-auto">{error}</ErrorLine>}
      <Btn onClick={onCancel} disabled={busy}>
        Annulla
      </Btn>
      <Btn variant="chrome" onClick={onSave} disabled={busy}>
        {busy ? "Salvo…" : saveLabel}
      </Btn>
    </Row>
  );
}

export function ErrorLine({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p role="alert" className={`flex items-start gap-1.5 text-[13px] text-[#ec8585] ${className}`}>
      <Icon name="alert" className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Campi                                                               */
/* ------------------------------------------------------------------ */

export const fieldClass = "field w-full text-[15px]";

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 2,
  max = 320,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  max?: number;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutosize(ref, value, max);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={rows}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${fieldClass} scroll-thin resize-none leading-relaxed`}
    />
  );
}

/** Campo con etichetta piccola sopra. */
export function F({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 space-y-1.5 ${className}`}>
      <span className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-[#b4b4b4]">{label}</span>
        {hint && <span className="truncate text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

/** Scelta singola a segmenti (altezza 36px). */
export function Seg<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; tone?: string }[];
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex w-full gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`press flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-[13px] whitespace-nowrap ${
              on ? "bg-white/[0.1] font-semibold text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.1)]" : "text-muted hover:text-fg"
            }`}
          >
            {o.tone && <span className="size-1.5 shrink-0 rounded-full" style={{ background: o.tone }} />}
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Numero da un campo di testo (accetta la virgola). Vuoto = undefined. */
export function parseNum(v: string): number | undefined {
  const s = v.trim().replace(",", ".");
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/* ------------------------------------------------------------------ */
/* Piccoli elementi                                                    */
/* ------------------------------------------------------------------ */

/** Testo che si apre e si chiude (suggerimenti, dettagli della libreria). */
export function Disclosure({ label, children, icon = "spark" }: { label: ReactNode; children: ReactNode; icon?: IconName }) {
  return (
    <details className="group">
      <summary className="press flex min-h-9 cursor-pointer list-none items-center gap-2 text-[13px] text-muted select-none hover:text-fg [&::-webkit-details-marker]:hidden">
        <Icon name={icon} className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1">{label}</span>
        <Icon name="forward" className="size-3.5 shrink-0 transition-transform group-open:rotate-90" />
      </summary>
      <div className="pt-2 pb-1">{children}</div>
    </details>
  );
}

/** Etichetta a pillola, con un punto colorato facoltativo. */
export function Chip({ children, tone, strong }: { children: ReactNode; tone?: string; strong?: boolean }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${
        strong ? "border-white/25 bg-white/[0.08] text-fg" : "border-white/10 text-[#b4b4b4]"
      }`}
    >
      {tone && <span className="size-1.5 shrink-0 rounded-full" style={{ background: tone }} />}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Stella piena o vuota (l'icona del kit è solo a tratto). */
export function StarIcon({ filled, className = "size-4" }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden>
      <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
    </svg>
  );
}

/** Lista vuota, detta con gentilezza, dentro un pannello. */
export function EmptyRow({ icon, children, action }: { icon: IconName; children: ReactNode; action?: ReactNode }) {
  return (
    <Row className="flex flex-wrap items-center gap-3 py-5">
      <span className="orb grid size-8 shrink-0 place-items-center rounded-full">
        <Icon name={icon} className="size-3.5" />
      </span>
      <p className="min-w-44 flex-1 text-sm text-muted">{children}</p>
      {action && <div className="ml-auto">{action}</div>}
    </Row>
  );
}

export const VERDICT_TONE: Record<string, string> = { approvato: "#199e70", "da rifare": "#c98500", scartato: "#e66767" };
export const VIDEO_TONE: Record<string, string> = { bozza: "#8a8a8a", "in revisione": "#c98500", approvato: "#199e70", pubblicato: "#d55181", scartato: "#5a5a5a" };

/** Oggi in ora locale (AAAA-MM-GG): solo da event handler o con l'ora di useNow. */
export function isoDay(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Lista modificabile: sposta un elemento su o giù. */
export function move<T>(items: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= items.length) return items;
  const next = [...items];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Id temporaneo per le righe nuove (il server tiene quelli che gli mandi). */
export const tempId = () => Math.random().toString(36).slice(2, 10);
