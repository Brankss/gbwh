"use client";

import { useEffect, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { MenuButton } from "./shell";

// Mattoncini condivisi dalle pagine dell'hub.

/** Larghezza del contenuto: header e corpo pagina usano la stessa colonna, così il titolo è allineato. */
const COLUMN = { normal: "max-w-4xl", wide: "max-w-6xl" } as const;

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  wide,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  back?: ReactNode;
  wide?: boolean;
}) {
  return (
    <header className="glass relative border-b border-white/[0.06]">
      <div className={`mx-auto flex w-full items-center gap-2 py-2.5 pr-3 pl-2 md:px-6 md:py-4 ${wide ? COLUMN.wide : COLUMN.normal}`}>
        {back ?? <MenuButton />}
        <div className="min-w-0 flex-1 md:-ml-0.5">
          <h1 className="chrome-text truncate text-[1.35rem] leading-tight font-bold tracking-[-0.02em] md:text-[1.75rem]">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted md:text-[13px]">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {/* filo metallico sotto l'header */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
    </header>
  );
}

/** Contenuto scrollabile di una pagina, con spazio in fondo per il badge di Netlify. */
export function PageBody({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div id="page-scroll" className="scroll-thin flex-1 overflow-y-auto overscroll-contain">
      <div className={`animate-rise mx-auto space-y-7 px-4 pt-5 pb-28 md:px-6 md:pt-7 ${wide ? COLUMN.wide : COLUMN.normal}`}>{children}</div>
    </div>
  );
}

export function Button({
  children,
  onClick,
  icon,
  variant = "chrome",
  type = "button",
  disabled,
  small,
}: {
  children?: ReactNode;
  onClick?: () => void;
  icon?: IconName;
  variant?: "chrome" | "gloss" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  small?: boolean;
}) {
  const look =
    variant === "chrome"
      ? "chrome hover:brightness-105"
      : variant === "gloss"
        ? "gloss hover:brightness-125"
        : variant === "danger"
          ? "border border-[#e66767]/35 text-[#ec8585] hover:border-[#e66767]/60 hover:bg-[#e66767]/10"
          : "border border-white/10 text-[#b4b4b4] hover:border-white/25 hover:bg-white/[0.05] hover:text-fg";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`press inline-flex items-center justify-center gap-1.5 rounded-full font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40 ${
        small ? "h-7 px-3 text-xs" : "h-9 px-4 text-sm"
      } ${look}`}
    >
      {icon && <Icon name={icon} className={small ? "size-3.5" : "size-4"} />}
      {children}
    </button>
  );
}

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal aria-label={title}>
      <button aria-label="Chiudi" onClick={onClose} className="animate-fade absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="card animate-sheet relative flex max-h-[92dvh] w-full max-w-xl flex-col rounded-b-none! md:rounded-b-[1.5rem]!">
        {/* maniglia del pannello (solo telefono) */}
        <span aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/20 md:hidden" />
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-5 py-3.5 md:pt-4">
          <h2 className="flex-1 truncate text-[17px] font-semibold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Chiudi"
            className="press grid size-8 place-items-center rounded-full text-muted hover:bg-white/[0.07] hover:text-fg"
          >
            <Icon name="close" className="size-4" />
          </button>
        </div>
        <div className="scroll-thin flex-1 space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>
        )}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-[#b4b4b4]">{label}</span>
        {hint && <span className="text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export const inputClass = "field w-full text-[15px]";

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="matte inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={`press shrink-0 rounded-xl px-3.5 py-1.5 text-sm font-medium whitespace-nowrap ${
              on ? "gloss text-fg" : "border border-transparent text-muted hover:bg-white/[0.04] hover:text-fg"
            }`}
          >
            {o.label}
            {o.count !== undefined && <span className={`ml-1.5 text-xs tabular-nums ${on ? "text-[#b4b4b4]" : "text-muted"}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Filtri a pillola (scelta singola), scorrono in orizzontale su mobile. */
export function Pills<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="scroll-thin -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            className={`press h-8 shrink-0 rounded-full px-3.5 text-[13px] whitespace-nowrap ${
              on ? "chrome font-semibold" : "border border-white/10 text-[#a8a8a8] hover:border-white/25 hover:bg-white/[0.04] hover:text-fg"
            }`}
          >
            {o.label}
            {o.count !== undefined && <span className={`ml-1.5 text-xs tabular-nums ${on ? "text-black/55" : "text-muted"}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="animate-rise flex flex-col items-center gap-3 py-16 text-center">
      <span className="relative grid size-20 place-items-center">
        {/* alone argento e goccia nera che respira */}
        <span aria-hidden className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.12),transparent_65%)] blur-md" />
        <span className="orb blob relative grid size-16 place-items-center">
          <Icon name={icon} className="size-6" />
        </span>
      </span>
      <p className="text-[17px] font-semibold tracking-tight">{title}</p>
      {children && <div className="max-w-sm text-sm leading-relaxed text-muted">{children}</div>}
    </div>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="shrink-0 text-[11px] font-semibold tracking-[0.14em] text-[#a8a8a8] uppercase">{title}</h2>
        <span aria-hidden className="hairline flex-1" />
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06] shadow-[inset_0_1px_1px_rgb(0_0_0/0.6)]"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="chrome h-full rounded-full border-0! transition-[width] duration-700" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="matte rounded-2xl p-4">
      <div className="text-[11px] font-semibold tracking-[0.1em] text-[#a8a8a8] uppercase">{label}</div>
      <div className="mt-1.5 text-[1.6rem] leading-none font-bold tracking-tight tabular-nums">{value}</div>
      {hint && <div className="mt-1.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Card({ children, onClick, className = "" }: { children: ReactNode; onClick?: () => void; className?: string }) {
  const base = `matte block w-full rounded-[1.25rem] p-4 text-left ${className}`;
  return onClick ? (
    <button onClick={onClick} className={`${base} lift`}>
      {children}
    </button>
  ) : (
    <div className={base}>{children}</div>
  );
}
