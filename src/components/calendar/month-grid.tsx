"use client";

import type { CSSProperties } from "react";
import { WEEKDAYS_SHORT, colorOf, dayLabel, dayOf, range, startOfMonth, startOfWeek, type Category, type Occurrence } from "@/lib/calendar";
import { Icon } from "../icons";

// Vista mese. Desktop: eventi scritti nelle caselle. Telefono: puntini colorati + agenda del giorno scelto sotto.

export function MonthGrid(p: {
  anchor: string;
  occs: Occurrence[];
  categories: Category[];
  today: string;
  selected: string;
  onSelect: (day: string) => void;
  onOpenDay: (day: string) => void;
  onOpen: (o: Occurrence) => void;
  onAdd: (day: string) => void;
}) {
  const first = startOfWeek(startOfMonth(p.anchor));
  const days = range(first, 42);
  const month = p.anchor.slice(0, 7);
  const onDay = (d: string) => p.occs.filter((o) => dayOf(o.start) <= d && dayOf(o.end) >= d && (o.allDay || o.end > `${d}T00:00`));
  const agenda = onDay(p.selected);

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-white/[0.07] bg-[#070707]/90 backdrop-blur-xl">
        {WEEKDAYS_SHORT.map((w, i) => (
          <div key={w} className={`py-2 text-center text-[10px] font-semibold tracking-[0.12em] uppercase ${i > 4 ? "text-[#8a8a8a]" : "text-muted"}`}>
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const list = onDay(d);
          const inMonth = d.slice(0, 7) === month;
          const isToday = d === p.today;
          const isSel = d === p.selected;
          return (
            <div
              key={d}
              role="button"
              tabIndex={0}
              onClick={() => (window.matchMedia("(min-width: 768px)").matches ? p.onOpenDay(d) : p.onSelect(d))}
              onKeyDown={(e) => e.key === "Enter" && p.onOpenDay(d)}
              className={`group relative flex min-h-[2.9rem] cursor-pointer flex-col gap-0.5 border-white/[0.08] p-0.5 transition-colors md:min-h-[7.5rem] md:gap-1 md:p-1.5 ${
                i % 7 ? "border-l" : ""
              } ${i >= 7 ? "border-t" : ""} ${inMonth ? "" : "bg-black/30"} ${isSel ? "bg-white/[0.06] md:bg-transparent" : "hover:bg-white/[0.03]"}`}
            >
              <div className="flex items-center justify-center md:justify-between">
                <span
                  className={`grid size-6 place-items-center rounded-full text-[13px] font-semibold tabular-nums md:size-7 ${
                    isToday ? "chrome" : isSel ? "bg-white/15 md:bg-transparent" : inMonth ? "" : "text-[#5a5a5a]"
                  }`}
                >
                  {+d.slice(8)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    p.onAdd(d);
                  }}
                  aria-label={`Aggiungi il ${dayLabel(d)}`}
                  className="press hidden size-6 place-items-center rounded-full text-muted opacity-0 group-hover:opacity-100 hover:bg-white/[0.08] hover:text-fg md:grid"
                >
                  <Icon name="plus" className="size-3.5" />
                </button>
              </div>

              {/* Telefono: puntini */}
              <div className="flex flex-wrap justify-center gap-0.5 md:hidden">
                {list.slice(0, 4).map((o) => (
                  <span key={o.key} className="size-1.5 rounded-full" style={{ background: colorOf(p.categories, o.category) }} />
                ))}
              </div>

              {/* Desktop: eventi */}
              <div className="hidden min-w-0 space-y-0.5 md:block">
                {list.slice(0, 3).map((o) => (
                  <button
                    key={o.key}
                    onClick={(e) => {
                      e.stopPropagation();
                      p.onOpen(o);
                    }}
                    className={`press flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-[3px] text-left text-[11.5px] hover:bg-white/[0.06] ${o.isDone ? "opacity-50 line-through" : ""}`}
                    style={o.allDay ? chip(colorOf(p.categories, o.category)) : undefined}
                  >
                    {!o.allDay && <span className="size-1.5 shrink-0 rounded-full" style={{ background: colorOf(p.categories, o.category) }} />}
                    {!o.allDay && <span className="shrink-0 text-muted tabular-nums">{dayOf(o.start) < d ? `→${o.end.slice(11)}` : o.start.slice(11)}</span>}
                    <span className="truncate font-medium">{o.title}</span>
                  </button>
                ))}
                {list.length > 3 && <div className="px-1.5 text-[11px] text-muted">+{list.length - 3} altri</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Telefono: agenda del giorno scelto */}
      <div className="border-t border-white/[0.07] p-3 md:hidden">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="flex-1 text-sm font-semibold capitalize">{dayLabel(p.selected, true)}</h3>
          <button onClick={() => p.onOpenDay(p.selected)} className="press rounded-full px-2.5 py-1 text-xs font-medium text-[#b4b4b4] hover:bg-white/[0.06]">
            Apri giorno →
          </button>
          <button onClick={() => p.onAdd(p.selected)} aria-label="Aggiungi" className="press chrome grid size-7 place-items-center rounded-full">
            <Icon name="plus" className="size-3.5" />
          </button>
        </div>
        {agenda.length ? (
          <AgendaList occs={agenda} categories={p.categories} onOpen={p.onOpen} />
        ) : (
          <p className="py-3 text-center text-sm text-muted">Giornata libera.</p>
        )}
      </div>
    </div>
  );
}

const chip = (color: string): CSSProperties => ({ background: `color-mix(in oklab, ${color} 30%, #0a0a0a)`, boxShadow: `inset 2px 0 0 ${color}` });

/** Lista compatta di eventi (agenda del giorno, "oggi" nella pagina Adesso). */
export function AgendaList({ occs, categories, onOpen, now }: { occs: Occurrence[]; categories: Category[]; onOpen?: (o: Occurrence) => void; now?: string }) {
  return (
    <div className="stagger space-y-1.5">
      {occs.map((o) => {
        const live = now && !o.allDay && o.start <= now && o.end > now;
        const Tag = onOpen ? "button" : "div";
        return (
          <Tag
            key={o.key}
            onClick={onOpen ? () => onOpen(o) : undefined}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${onOpen ? "press hover:bg-white/[0.05]" : ""} ${live ? "bg-white/[0.06] ring-1 ring-white/20" : "bg-white/[0.025]"}`}
          >
            <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: colorOf(categories, o.category) }} />
            <span className="w-[4.5rem] shrink-0 text-xs text-muted tabular-nums">
              {o.allDay ? "tutto il giorno" : `${o.start.slice(11)}–${o.end.slice(11)}`}
            </span>
            <span className={`min-w-0 flex-1 truncate text-sm font-medium ${o.isDone ? "text-muted line-through" : ""}`}>{o.title}</span>
            {live && <span className="chrome shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">ORA</span>}
            {o.repeat && <Icon name="repeat" className="size-3.5 shrink-0 text-muted" />}
          </Tag>
        );
      })}
    </div>
  );
}
