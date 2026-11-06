"use client";

import { useEffect, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { MenuButton } from "./shell";

// Mattoncini condivisi dalle pagine dell'hub.

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: string; actions?: ReactNode; back?: ReactNode }) {
  return (
    <header className="flex items-center gap-2 border-b border-line bg-bg/80 py-2.5 pr-3 pl-2 backdrop-blur-xl md:px-6 md:py-3.5">
      {back ?? <MenuButton />}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Contenuto scrollabile di una pagina, con spazio in fondo per il badge di Netlify. */
export function PageBody({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div id="page-scroll" className="scroll-thin flex-1 overflow-y-auto overscroll-contain">
      <div className={`mx-auto space-y-6 px-4 pt-5 pb-28 md:px-6 ${wide ? "max-w-6xl" : "max-w-4xl"}`}>{children}</div>
    </div>
  );
}

export function Button({
  children,
  onClick,
  icon,
  variant = "gloss",
  type = "button",
  disabled,
  small,
}: {
  children?: ReactNode;
  onClick?: () => void;
  icon?: IconName;
  variant?: "gloss" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  small?: boolean;
}) {
  const look =
    variant === "gloss"
      ? "gloss"
      : variant === "danger"
        ? "border border-red-500/30 text-red-400 hover:bg-red-500/10"
        : "border border-line text-muted hover:bg-surface-2 hover:text-fg";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-all active:scale-95 disabled:opacity-40 ${
        small ? "px-3 py-1 text-xs" : "px-4 py-2 text-sm"
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
      <button aria-label="Chiudi" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-pop" />
      <div className="matte relative flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl animate-pop md:rounded-3xl">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
          <h2 className="flex-1 truncate font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Chiudi" className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg">
            <Icon name="close" className="size-4" />
          </button>
        </div>
        <div className="scroll-thin flex-1 space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-baseline justify-between text-xs text-muted">
        <span>{label}</span>
        {hint && <span>{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export const inputClass = "field w-full text-[15px]";

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="matte inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`shrink-0 rounded-xl px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-all ${
            o.value === value ? "gloss" : "border border-transparent text-muted hover:text-fg"
          }`}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1.5 text-xs text-muted">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Filtri a pillola (scelta singola), scorrono in orizzontale su mobile. */
export function Pills<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="scroll-thin -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={`shrink-0 rounded-full px-3 py-1 text-sm whitespace-nowrap transition-all ${
            o.value === value ? "bg-white font-medium text-black" : "border border-line text-muted hover:text-fg"
          }`}
        >
          {o.label}
          {o.count !== undefined && <span className={`ml-1 text-xs ${o.value === value ? "text-black/60" : ""}`}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center animate-pop">
      <span className="orb grid size-14 place-items-center rounded-full">
        <Icon name={icon} className="size-6" />
      </span>
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-medium tracking-wider text-muted uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-white transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="matte rounded-2xl p-3.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Card({ children, onClick, className = "" }: { children: ReactNode; onClick?: () => void; className?: string }) {
  const base = `matte block w-full rounded-[1.25rem] p-4 text-left ${className}`;
  return onClick ? (
    <button onClick={onClick} className={`${base} transition-colors hover:border-[#2a2a2a] hover:bg-[#171717]`}>
      {children}
    </button>
  ) : (
    <div className={base}>{children}</div>
  );
}
