"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Empty, PageBody, PageHeader } from "@/components/kit";
import { useApi } from "@/lib/client";
import { BACK_CLASS, SkeletonRows, UGC_KEY, type UgcOverview } from "./common";

// In fondo alla regia: le sezioni di lavoro (Brief, Playbook, Risultati, Squadra) come pagine a sé.
// Più il guscio comune di quelle pagine e il menu "altro" dell'intestazione su telefono.

export function MoreLinks({ data }: { data: UgcOverview }) {
  const activeBriefs = data.briefList.filter((b) => b.status === "attivo").length;
  const assigned = Object.values(data.settings.roles).filter(Boolean).length;
  const cards: { href: string; icon: IconName; title: string; text: string; meta: string }[] = [
    {
      href: "/ugc/brief",
      icon: "folder",
      title: "Brief",
      text: "Prodotti, target, ricerca e angoli",
      meta: data.briefList.length ? `${activeBriefs} attivi · ${data.briefList.length} in tutto` : "nessuno ancora",
    },
    {
      href: "/ugc/playbook",
      icon: "star",
      title: "Playbook e libreria",
      text: "Cosa funziona, format e hook",
      meta: data.learnings ? `${data.learnings} ${data.learnings === 1 ? "lezione" : "lezioni"}` : "ancora vuoto",
    },
    {
      href: "/ugc/risultati",
      icon: "chart",
      title: "Risultati",
      text: "Spesa, hook rate, CTR e ROAS",
      meta: data.videos ? `${data.videos} video` : "nessun video",
    },
    {
      href: "/ugc/squadra",
      icon: "sliders",
      title: "Squadra",
      text: "Chi fa quale ruolo, sveglia",
      meta: `${assigned}/5 ruoli · sveglia ${data.settings.autoWake ? "on" : "off"}`,
    },
  ];
  return (
    <nav aria-label="Sezioni della factory" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {cards.map((c) => (
        <Link key={c.href} href={c.href} className="panel lift group flex min-h-[8.5rem] flex-col rounded-2xl p-4">
          <span className="flex items-center justify-between">
            <span className="grid size-9 place-items-center rounded-full bg-white/[0.06] text-soft">
              <Icon name={c.icon} className="size-4" />
            </span>
            <Icon name="forward" className="size-4 text-muted transition-transform group-hover:translate-x-0.5" />
          </span>
          <span className="mt-auto pt-4">
            <span className="block text-[15px] font-semibold tracking-tight">{c.title}</span>
            <span className="mt-0.5 hidden text-[13px] leading-snug text-muted sm:block">{c.text}</span>
            <span className="mt-1 block truncate text-xs text-soft tabular-nums">{c.meta}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}

/** Freccia "indietro" verso la regia. */
export const backToRegia = (
  <Link href="/ugc" aria-label="Torna alla regia" className={BACK_CLASS}>
    <Icon name="back" />
  </Link>
);

/** Guscio delle pagine di sezione: intestazione con ritorno alla regia, dati della panoramica. */
export function UgcSubPage({
  title,
  subtitle,
  actions,
  wide,
  children,
}: {
  title: string;
  subtitle?: string | ((data: UgcOverview) => string);
  actions?: ReactNode;
  wide?: boolean;
  children: (data: UgcOverview) => ReactNode;
}) {
  const { data, error } = useApi<UgcOverview>(UGC_KEY, { refreshInterval: 30_000 });
  return (
    <>
      <PageHeader wide={wide} title={title} subtitle={typeof subtitle === "function" ? (data ? subtitle(data) : "UGC Factory") : subtitle} back={backToRegia} actions={actions} />
      <PageBody wide={wide}>
        {error ? (
          <Empty icon="alert" title="Non riesco a caricare la factory">
            {error.message}
          </Empty>
        ) : data ? (
          children(data)
        ) : (
          <SkeletonRows rows={4} />
        )}
      </PageBody>
    </>
  );
}

/** Menu "altro" (tre puntini) per le azioni secondarie su schermi stretti. */
export function Overflow({ items, className = "" }: { items: { label: string; icon: IconName; onClick?: () => void; href?: string }[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // Si chiude con Esc o toccando fuori (l'intestazione ha il vetro: niente velo "fixed" a tutta pagina).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);
  return (
    <div ref={box} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen(!open)} aria-label="Altre azioni" aria-expanded={open} className="press icon-btn">
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      {open && (
          <div role="menu" className="card animate-pop absolute top-11 right-0 z-40 w-52 overflow-hidden rounded-2xl! bg-[#0e0e0e]! p-1.5">
            {items.map((it) => {
              const cls = "press flex h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm text-soft hover:bg-white/[0.06] hover:text-fg";
              const inner = (
                <>
                  <Icon name={it.icon} className="size-4" />
                  {it.label}
                </>
              );
              return it.href ? (
                <Link key={it.label} role="menuitem" href={it.href} className={cls} onClick={() => setOpen(false)}>
                  {inner}
                </Link>
              ) : (
                <button
                  key={it.label}
                  role="menuitem"
                  className={cls}
                  onClick={() => {
                    setOpen(false);
                    it.onClick?.();
                  }}
                >
                  {inner}
                </button>
              );
            })}
          </div>
      )}
    </div>
  );
}
