"use client";

import { useEffect, useState } from "react";

// Indice delle sezioni, appiccicato in alto: salta da Idea a Numeri senza scorrere tutta la pagina.

export const SECTIONS = [
  { id: "idea", label: "Idea" },
  { id: "hook", label: "Hook" },
  { id: "storia", label: "Storia" },
  { id: "script", label: "Script" },
  { id: "revisioni", label: "Revisioni" },
  { id: "video", label: "Video" },
  { id: "numeri", label: "Numeri" },
  { id: "playbook", label: "Playbook" },
  { id: "registro", label: "Registro" },
] as const;

export function jumpTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function ConceptIndex({ counts }: { counts: Partial<Record<string, number>> }) {
  const [active, setActive] = useState<string>("idea");

  useEffect(() => {
    const root = document.getElementById("page-scroll");
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    const visible = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting);
        const first = SECTIONS.find((s) => visible.get(s.id));
        if (first) setActive(first.id);
      },
      // Una sezione è "attiva" quando occupa la fascia alta dello schermo, sotto l'indice.
      { root, rootMargin: "-64px 0px -55% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  // Tieni visibile la pillola attiva quando l'indice scorre in orizzontale.
  // (solo in orizzontale: scrollIntoView sposterebbe anche la pagina).
  useEffect(() => {
    const pill = document.getElementById(`idx-${active}`);
    const bar = pill?.parentElement;
    if (!pill || !bar) return;
    const left = pill.offsetLeft - bar.offsetLeft;
    if (left < bar.scrollLeft + 16) bar.scrollTo({ left: Math.max(0, left - 16), behavior: "smooth" });
    else if (left + pill.offsetWidth > bar.scrollLeft + bar.clientWidth - 16) bar.scrollTo({ left: left + pill.offsetWidth - bar.clientWidth + 16, behavior: "smooth" });
  }, [active]);

  return (
    <nav aria-label="Sezioni" className="glass sticky top-0 z-20 -mx-4 border-b border-white/[0.06] md:-mx-6">
      <div className="scroll-thin flex gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none] md:px-6 [&::-webkit-scrollbar]:hidden">
        {SECTIONS.map((s) => {
          const on = s.id === active;
          const n = counts[s.id];
          return (
            <button
              key={s.id}
              id={`idx-${s.id}`}
              onClick={() => {
                setActive(s.id);
                jumpTo(s.id);
              }}
              aria-current={on ? "true" : undefined}
              className={`press flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] whitespace-nowrap ${
                on ? "bg-white/[0.1] font-semibold text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.1)]" : "text-muted hover:text-fg"
              }`}
            >
              {s.label}
              {n ? <span className={`text-[11px] tabular-nums ${on ? "text-[#b4b4b4]" : "text-muted/70"}`}>{n}</span> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
