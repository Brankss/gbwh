"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { MenuButton } from "./shell";

// Mattoncini condivisi dalle pagine dell'hub.
// Regola: un contenitore per gruppo (pannello), dentro righe separate da un filo. Niente scatole dentro scatole.

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
    <header className="glass relative z-10 border-b border-line">
      <div className={`mx-auto flex w-full items-center gap-2 py-3 pr-3 pl-2 md:gap-3 md:px-8 md:py-5 ${wide ? COLUMN.wide : COLUMN.normal}`}>
        {back ?? <MenuButton />}
        <div className="min-w-0 flex-1">
          <h1 className="chrome-text truncate text-[1.375rem] leading-tight font-bold tracking-[-0.02em] md:text-[1.75rem]">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted md:text-[13px]">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1.5 md:gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** Contenuto scrollabile di una pagina, con spazio in fondo per il badge di Netlify. */
export function PageBody({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div id="page-scroll" className="scroll-thin flex-1 overflow-y-auto overscroll-contain">
      <div className={`animate-rise mx-auto space-y-8 px-4 pt-6 pb-28 md:space-y-10 md:px-8 md:pt-8 ${wide ? COLUMN.wide : COLUMN.normal}`}>{children}</div>
    </div>
  );
}

/** Pulsante a icona tondo e quieto (indietro, impostazioni…). */
export function IconButton({ icon, label, onClick, href, className = "" }: { icon: IconName; label: string; onClick?: () => void; href?: string; className?: string }) {
  const cls = `press icon-btn ${className}`;
  return href ? (
    <Link href={href} aria-label={label} className={cls}>
      <Icon name={icon} />
    </Link>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={cls}>
      <Icon name={icon} />
    </button>
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
  label,
  href,
}: {
  children?: ReactNode;
  onClick?: () => void;
  icon?: IconName;
  /** chrome = azione principale (una per zona) · gloss = secondaria · ghost = terziaria · danger = distruttiva */
  variant?: "chrome" | "gloss" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  small?: boolean;
  /** Etichetta accessibile per i pulsanti con sola icona. */
  label?: string;
  /** Se c'è, è un link con l'aspetto di un pulsante. */
  href?: string;
}) {
  const look =
    variant === "chrome"
      ? "chrome hover:brightness-105"
      : variant === "gloss"
        ? "bg-white/[0.08] text-fg shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)] hover:bg-white/[0.12]"
        : variant === "danger"
          ? "text-danger shadow-[inset_0_0_0_1px_rgb(230_103_103/0.3)] hover:bg-[#e66767]/10 hover:shadow-[inset_0_0_0_1px_rgb(230_103_103/0.55)]"
          : "text-soft shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1)] hover:bg-white/[0.05] hover:text-fg";
  const iconOnly = !children;
  const cls = `press hit inline-flex items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40 ${
    small ? `h-8 text-[13px] ${iconOnly ? "w-8" : "px-3"}` : `h-9 text-sm ${iconOnly ? "w-9" : "px-4"}`
  } ${variant === "chrome" ? "font-semibold" : ""} ${look}`;
  const inner = (
    <>
      {icon && <Icon name={icon} className={small ? "size-3.5" : "size-4"} />}
      {children}
    </>
  );
  if (href) {
    return (
      <Link href={href} aria-label={label} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} aria-label={label} title={label} className={cls}>
      {inner}
    </button>
  );
}

/** Scelta singola compatta (filtri a segmenti), con etichetta facoltativa davanti. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  full,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label?: string;
  /** Occupa tutta la larghezza, voci della stessa misura. */
  full?: boolean;
}) {
  const seg = (
    <div role="group" aria-label={label} className={`seg ${full ? "flex! w-full" : ""}`}>
      {options.map((o) => (
        <button type="button" key={o.value} onClick={() => onChange(o.value)} aria-pressed={o.value === value} className={`press seg-item ${full ? "flex-1 px-2!" : ""}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
  if (!label) return seg;
  // Su telefono l'etichetta sta sopra e il controllo prende tutta la riga; da tablet in su, in linea.
  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto sm:flex-row sm:items-center sm:gap-2.5">
      <span className="shrink-0 text-xs text-muted">{label}</span>
      <div className="max-sm:[&>.seg]:flex! max-sm:[&>.seg]:w-full max-sm:[&_.seg-item]:flex-1 max-sm:[&_.seg-item]:px-2">{seg}</div>
    </div>
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
      <div className="card animate-sheet relative flex max-h-[92dvh] w-full max-w-xl flex-col rounded-b-none! md:rounded-b-[20px]!">
        {/* maniglia del pannello (solo telefono) */}
        <span aria-hidden className="mx-auto mt-2 h-1 w-9 rounded-full bg-white/15 md:hidden" />
        <div className="flex items-center gap-2 border-b border-line py-3 pr-3 pl-5 md:py-4">
          <h2 className="flex-1 truncate text-base font-semibold tracking-tight">{title}</h2>
          <IconButton icon="close" label="Chiudi" onClick={onClose} />
        </div>
        <div className="scroll-thin flex-1 space-y-5 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>
        )}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-soft">{label}</span>
        {hint && <span className="truncate text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export const inputClass = "field w-full text-[15px]";

/** Viste che si escludono (Prodotti / Pubblicità, Grafici / Tabella…): controllo a segmenti. */
export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="seg">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} role="tab" aria-selected={on} onClick={() => onChange(o.value)} className="press seg-item">
            {o.label}
            {o.count !== undefined && <span className={`text-xs tabular-nums ${on ? "text-soft" : "text-muted/80"}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Filtri a pillola (scelta singola), scorrono in orizzontale su mobile. */
export function Pills<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; label?: string }) {
  return (
    <div role="group" aria-label={label} className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)} aria-pressed={on} className="press chip">
            {o.label}
            {o.count !== undefined && <span className={`text-xs tabular-nums ${on ? "text-soft" : "text-muted"}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="animate-rise flex flex-col items-center gap-3 py-14 text-center">
      <span className="relative grid size-16 place-items-center">
        {/* alone argento e goccia nera che respira */}
        <span aria-hidden className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.1),transparent_65%)] blur-md" />
        <span className="orb blob relative grid size-14 place-items-center">
          <Icon name={icon} className="size-5" />
        </span>
      </span>
      <p className="text-base font-semibold tracking-tight">{title}</p>
      {children && <div className="max-w-sm text-sm leading-relaxed text-muted">{children}</div>}
    </div>
  );
}

/** Sezione: etichetta piccola a sinistra, azione secondaria a destra, poi il contenuto. */
export function Section({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`space-y-3 ${className}`}>
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 className="eyebrow truncate">{title}</h2>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/** Link "Vedi tutto →" accanto al titolo di una sezione. */
export function SectionLink({ href, children = "Vedi tutto" }: { href: string; children?: ReactNode }) {
  return (
    <Link href={href} className="hit -mr-2 inline-flex h-8 items-center gap-1 rounded-full px-2 text-[13px] font-medium text-muted transition-colors hover:bg-white/[0.05] hover:text-fg">
      {children}
      <Icon name="forward" className="size-3.5" />
    </Link>
  );
}

/** Pannello unico con righe separate da un filo. */
export function List({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`panel rows overflow-hidden rounded-2xl ${className}`}>{children}</div>;
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.07]" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-r from-[#8a8a8a] via-[#e8e8e8] to-white transition-[width] duration-700" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** Numeri in fila: un pannello diviso da fili. Mettici dentro dei <Stat>. `two`: sempre 2 colonne (colonne strette). */
export function StatGrid({ children, two }: { children: ReactNode; two?: boolean }) {
  return <div className={`panel stat-grid rounded-2xl ${two ? "stat-grid-2" : ""}`}>{children}</div>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-4 md:px-5">
      <div className="truncate text-xs text-muted">{label}</div>
      <div className="mt-1.5 truncate text-[1.375rem] leading-none font-semibold tracking-tight tabular-nums md:text-2xl">{value}</div>
      {hint && <div className="mt-1.5 truncate text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Card({ children, onClick, className = "" }: { children: ReactNode; onClick?: () => void; className?: string }) {
  const base = `panel block w-full rounded-2xl p-4 text-left ${className}`;
  return onClick ? (
    <button onClick={onClick} className={`${base} lift`}>
      {children}
    </button>
  ) : (
    <div className={base}>{children}</div>
  );
}
