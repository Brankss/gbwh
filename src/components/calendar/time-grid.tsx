"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  WEEKDAYS_SHORT,
  at,
  colorOf,
  dayOf,
  hhmm,
  layoutDay,
  minuteOf,
  toMs,
  weekday,
  type Category,
  type Occurrence,
} from "@/lib/calendar";

// Griglia oraria (giorno / settimana).
// Mouse: trascina sul vuoto = crea, trascina un evento = sposta, bordi = allunga/accorcia, clic = apri.
// Touch: tocco = apri / crea; pressione lunga = solleva e sposta (poi compaiono le maniglie per la durata).

const SNAP = 15;
const snap = (m: number) => Math.round(m / SNAP) * SNAP;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type Drag =
  | { kind: "create"; day: number; a: number; b: number }
  | { kind: "move"; o: Occurrence; day: number; start: number; len: number; grab: number }
  | { kind: "end"; o: Occurrence; day: number; start: number; end: number }
  | { kind: "start"; o: Occurrence; day: number; start: number; end: number };

type Session = {
  id: number;
  touch: boolean;
  x0: number;
  y0: number;
  x: number;
  y: number;
  o: Occurrence | null;
  handle: "start" | "end" | null;
  day0: number;
  min0: number;
  active: boolean;
  scrolling: boolean;
  timer?: ReturnType<typeof setTimeout>;
};

export type TimeGridProps = {
  days: string[];
  occs: Occurrence[];
  categories: Category[];
  now: string;
  hourPx: number;
  scrollTo: number;
  compact?: boolean;
  onOpen: (o: Occurrence) => void;
  onCreate: (day: string, startMin: number, endMin: number) => void;
  onChange: (o: Occurrence, start: string, end: string) => void;
  onDropBacklog: (id: string, start: string) => void;
  onDayClick?: (day: string) => void;
  onSwipe?: (dir: 1 | -1) => void;
};

export function TimeGrid(p: TimeGridProps) {
  const { days, hourPx } = p;
  const scrollRef = useRef<HTMLDivElement>(null);
  const colsRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const sess = useRef<Session | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ day: number; min: number; len: number } | null>(null);
  // Le funzioni dei listener leggono sempre le props più recenti.
  const props = useRef(p);
  useEffect(() => {
    props.current = p;
  });

  const placed = useMemo(() => days.map((d) => layoutDay(p.occs, d)), [days, p.occs]);
  const allDay = useMemo(
    () => days.map((d) => p.occs.filter((o) => o.allDay && dayOf(o.start) <= d && dayOf(o.end) >= d)),
    [days, p.occs],
  );
  const byKey = useMemo(() => new Map(p.occs.map((o) => [o.key, o])), [p.occs]);

  // All'apertura: scorri all'ora giusta (adesso, o l'inizio della giornata utile).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = Math.max(0, (p.scrollTo / 60) * hourPx);
    // solo al montaggio
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Durante un trascinamento col dito la pagina non deve scorrere.
  // E dopo un tocco gestito da noi il browser manderebbe un "click" finto nello stesso punto:
  // se lì nel frattempo si è aperta una finestra, la richiuderebbe subito. Lo blocchiamo.
  const swallowClick = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const stop = (e: TouchEvent) => {
      if (sess.current?.active) e.preventDefault();
    };
    const end = (e: TouchEvent) => {
      if (swallowClick.current && e.cancelable) e.preventDefault();
      swallowClick.current = false;
    };
    el.addEventListener("touchmove", stop, { passive: false });
    el.addEventListener("touchend", end, { passive: false });
    return () => {
      el.removeEventListener("touchmove", stop);
      el.removeEventListener("touchend", end);
    };
  }, []);

  const setD = (d: Drag | null) => {
    dragRef.current = d;
    setDrag(d);
  };

  const locate = (x: number, y: number) => {
    const r = colsRef.current!.getBoundingClientRect();
    const n = props.current.days.length;
    return { day: clamp(Math.floor(((x - r.left) / r.width) * n), 0, n - 1), min: ((y - r.top) / props.current.hourPx) * 60 };
  };

  /** Minuti dell'inizio di un'occorrenza rispetto a un giorno della griglia (negativo se inizia prima). */
  const relStart = (o: Occurrence, dayIdx: number) => (toMs(o.start) - toMs(props.current.days[dayIdx])) / 60_000;
  const relEnd = (o: Occurrence, dayIdx: number) => (toMs(o.end) - toMs(props.current.days[dayIdx])) / 60_000;

  const activate = () => {
    const s = sess.current;
    if (!s || s.active) return;
    s.active = true;
    if (s.touch) navigator.vibrate?.(8);
    if (s.o && s.handle) {
      const st = relStart(s.o, s.day0);
      setD({ kind: s.handle, o: s.o, day: s.day0, start: st, end: relEnd(s.o, s.day0) });
    } else if (s.o) {
      const st = relStart(s.o, s.day0);
      setD({ kind: "move", o: s.o, day: s.day0, start: st, len: relEnd(s.o, s.day0) - st, grab: s.min0 - st });
      setSelected(s.o.key);
    } else {
      const a = Math.floor(s.min0 / SNAP) * SNAP;
      setD({ kind: "create", day: s.day0, a, b: a + (s.touch ? 60 : SNAP) });
    }
    loop();
  };

  const update = () => {
    const s = sess.current;
    const d = dragRef.current;
    if (!s?.active || !d) return;
    const { day, min } = locate(s.x, s.y);
    if (d.kind === "create") {
      const m = clamp(snap(min), 0, 1440);
      const a0 = Math.floor(s.min0 / SNAP) * SNAP;
      // Si può trascinare verso il basso o verso l'alto dal punto di partenza.
      const [a, b] = m > a0 ? [a0, Math.max(m, a0 + SNAP)] : [Math.min(m, a0), a0 + SNAP];
      if (a !== d.a || b !== d.b) setD({ ...d, a, b });
    } else if (d.kind === "move") {
      const start = clamp(snap(min - d.grab), 0, 1440 - SNAP);
      if (start !== d.start || day !== d.day) setD({ ...d, start, day });
    } else if (d.kind === "end") {
      const end = clamp(snap(min), d.start + SNAP, 1440);
      if (end !== d.end) setD({ ...d, end });
    } else {
      const start = clamp(snap(min), 0, d.end - SNAP);
      if (start !== d.start) setD({ ...d, start });
    }
  };

  // Vicino ai bordi la griglia scorre da sola mentre trascini.
  const loop = () => {
    const tick = () => {
      const s = sess.current;
      const el = scrollRef.current;
      if (!s?.active || !el) return;
      const r = el.getBoundingClientRect();
      const top = r.top + (headRef.current?.offsetHeight ?? 0);
      const v = s.y < top + 36 ? -(top + 36 - s.y) / 3 : s.y > r.bottom - 36 ? (s.y - (r.bottom - 36)) / 3 : 0;
      if (v) {
        el.scrollTop += clamp(v, -18, 18);
        update();
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const finish = (cancelled: boolean) => {
    const s = sess.current;
    sess.current = null;
    if (!s) return;
    clearTimeout(s.timer);
    if (s.touch && !cancelled) swallowClick.current = true;
    const d = dragRef.current;
    setD(null);
    const P = props.current;
    if (s.active && d && !cancelled) {
      if (d.kind === "create") return P.onCreate(P.days[d.day], d.a, d.b);
      const o = d.o;
      const day = P.days[d.day];
      const [start, end] = d.kind === "move" ? [d.start, d.start + d.len] : [d.start, d.end];
      const newStart = at(day, start);
      const newEnd = at(day, end);
      if (newStart !== o.start || newEnd !== o.end) P.onChange(o, newStart, newEnd);
      if (s.touch) setSelected(o.key);
      return;
    }
    if (cancelled || s.scrolling) {
      // Swipe orizzontale col dito: giorno/settimana dopo o prima.
      const dx = s.x - s.x0;
      const dy = s.y - s.y0;
      if (s.touch && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2) P.onSwipe?.(dx < 0 ? 1 : -1);
      return;
    }
    // Tocco / clic semplice.
    if (selected && !s.o) return setSelected(null);
    if (s.o) return P.onOpen(s.o);
    const a = Math.floor(s.min0 / 30) * 30;
    P.onCreate(P.days[s.day0], a, a + 60);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || sess.current) return;
    const t = e.target as HTMLElement;
    const occEl = t.closest<HTMLElement>("[data-key]");
    const o = occEl ? (byKey.get(occEl.dataset.key!) ?? null) : null;
    const touch = e.pointerType !== "mouse";
    const handleEl = t.closest<HTMLElement>("[data-handle]");
    const handle = handleEl && o && (!touch || selected === o.key) ? (handleEl.dataset.handle as "start" | "end") : null;
    const { day, min } = locate(e.clientX, e.clientY);
    sess.current = { id: e.pointerId, touch, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, o, handle, day0: day, min0: min, active: false, scrolling: false };

    if (handle) {
      e.preventDefault();
      activate();
    } else if (touch) {
      sess.current.timer = setTimeout(activate, o ? 300 : 450);
    }

    const move = (ev: PointerEvent) => {
      const s = sess.current;
      if (!s || ev.pointerId !== s.id) return;
      s.x = ev.clientX;
      s.y = ev.clientY;
      const dist = Math.hypot(s.x - s.x0, s.y - s.y0);
      if (!s.active) {
        if (s.touch) {
          if (dist > 10) {
            clearTimeout(s.timer);
            s.scrolling = true;
          }
          return;
        }
        if (dist < 4) return;
        activate();
      }
      update();
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== sess.current?.id) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      finish(false);
    };
    const cancel = (ev: PointerEvent) => {
      if (ev.pointerId !== sess.current?.id) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      const s = sess.current;
      // Il browser ha preso il gesto per scorrere: non è un errore, solo niente trascinamento.
      if (s && !s.active) s.scrolling = true;
      finish(!s?.active);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };

  /* ---------- Trascina dalla colonna "da pianificare" (desktop) ---------- */
  const backlogDrag = (e: React.DragEvent) => {
    const type = e.dataTransfer.types.find((t) => t.startsWith("text/x-cal-min-"));
    if (!type) return null;
    const len = Number(type.slice("text/x-cal-min-".length)) || 60;
    const { day, min } = locate(e.clientX, e.clientY);
    return { day, min: clamp(Math.floor((min - 15) / SNAP) * SNAP, 0, 1440 - SNAP), len };
  };

  const nowDay = dayOf(p.now);
  const nowMin = minuteOf(p.now);
  const H = 24 * hourPx;
  const cols = { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` } as CSSProperties;
  const gutter = p.compact ? "w-9" : "w-12";

  return (
    <div
      ref={scrollRef}
      className="cal-grid scroll-thin relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Intestazione: giorni + eventi di tutto il giorno */}
      <div ref={headRef} className="sticky top-0 z-20 border-b border-line bg-[#080808]/90 backdrop-blur-xl">
        <div className="flex">
          <div className={`${gutter} shrink-0`} />
          <div className="grid flex-1" style={cols}>
            {days.map((d) => {
              const today = d === nowDay;
              const head = (
                <>
                  <span className={`text-[10px] font-semibold tracking-[0.12em] uppercase ${today ? "text-fg" : "text-muted"}`}>
                    {WEEKDAYS_SHORT[weekday(d) - 1]}
                  </span>
                  <span
                    className={`grid size-7 place-items-center rounded-full text-[15px] font-medium tabular-nums ${today ? "chrome font-semibold" : weekday(d) > 5 ? "text-[#9a9a9a]" : ""}`}
                  >
                    {+d.slice(8)}
                  </span>
                </>
              );
              return p.onDayClick ? (
                <button key={d} onClick={() => p.onDayClick!(d)} className="press flex flex-col items-center gap-0.5 rounded-lg py-1.5 hover:bg-white/[0.04]" title="Apri il giorno">
                  {head}
                </button>
              ) : (
                <div key={d} className={`flex items-center gap-2 py-1.5 ${days.length === 1 ? "justify-start pl-3" : "flex-col justify-center gap-0.5"}`}>
                  {head}
                </div>
              );
            })}
          </div>
        </div>
        {allDay.some((l) => l.length) && (
          <div className="flex border-t border-line">
            <div className={`${gutter} shrink-0 py-1 pr-1.5 text-right text-[9px] leading-tight text-muted`}>{p.compact ? "" : "tutto il giorno"}</div>
            <div className="grid flex-1 gap-px py-1" style={cols}>
              {allDay.map((list, i) => (
                <div key={days[i]} className="min-w-0 space-y-0.5 px-0.5">
                  {list.slice(0, p.compact ? 2 : 3).map((o) => (
                    <button
                      key={o.key}
                      onClick={() => p.onOpen(o)}
                      className={`press block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium ${o.isDone ? "opacity-50 line-through" : ""}`}
                      style={chip(colorOf(p.categories, o.category))}
                    >
                      {o.title}
                    </button>
                  ))}
                  {list.length > (p.compact ? 2 : 3) && <div className="px-1 text-[10px] text-muted">+{list.length - (p.compact ? 2 : 3)}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Corpo: ore + colonne */}
      <div className="relative flex" style={{ height: H }}>
        <div
          className={`${gutter} relative shrink-0`}
          style={{
            // tacche delle ore che continuano la griglia nella colonna degli orari
            backgroundImage: "linear-gradient(to bottom, rgb(255 255 255 / 0.085) 1px, transparent 1px)",
            backgroundSize: `6px ${hourPx}px`,
            backgroundPosition: "right top",
            backgroundRepeat: "repeat-y",
          }}
        >
          {Array.from({ length: 23 }, (_, h) => (
            <span key={h} className="absolute right-1.5 -translate-y-1/2 text-[10px] text-muted tabular-nums" style={{ top: (h + 1) * hourPx }}>
              {p.compact ? h + 1 : `${String(h + 1).padStart(2, "0")}:00`}
            </span>
          ))}
          {days.includes(nowDay) && !p.compact && (
            <span className="absolute right-1 z-10 -translate-y-1/2 rounded-full bg-fg px-1 text-[9px] font-semibold text-black tabular-nums" style={{ top: (nowMin / 60) * hourPx }}>
              {hhmm(nowMin)}
            </span>
          )}
        </div>

        <div
          ref={colsRef}
          className="relative grid flex-1 touch-pan-y"
          style={{
            ...cols,
            // Griglia appena visibile: ore, mezz'ore e quarti d'ora sempre più leggeri.
            backgroundImage: `linear-gradient(to bottom, rgb(255 255 255 / 0.085) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.018) 1px, transparent 1px)`,
            backgroundSize: `100% ${hourPx}px, 100% ${hourPx / 2}px, 100% ${hourPx / 4}px`,
          }}
          onPointerDown={onPointerDown}
          onDragOver={(e) => {
            const d = backlogDrag(e);
            if (!d) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (!drop || drop.day !== d.day || drop.min !== d.min) setDrop(d);
          }}
          onDragLeave={(e) => {
            if (!colsRef.current?.contains(e.relatedTarget as Node)) setDrop(null);
          }}
          onDrop={(e) => {
            const d = backlogDrag(e);
            const id = e.dataTransfer.getData("text/x-cal-id") || e.dataTransfer.getData("text/plain");
            setDrop(null);
            if (!d || !id) return;
            e.preventDefault();
            p.onDropBacklog(id, at(days[d.day], d.min));
          }}
        >
          {days.map((d, i) => (
            <div key={d} className={`relative ${i ? "border-l border-white/[0.075]" : ""} ${weekday(d) > 5 ? "bg-white/[0.012]" : ""}`}>
              {placed[i].map((pl) => {
                const dragging = drag && drag.kind !== "create" && drag.o.key === pl.o.key;
                return (
                  <EventBlock
                    key={pl.o.key}
                    o={pl.o}
                    color={colorOf(p.categories, pl.o.category)}
                    top={(pl.top / 60) * hourPx}
                    height={((pl.bottom - pl.top) / 60) * hourPx}
                    left={pl.col / pl.cols}
                    width={1 / pl.cols}
                    compact={p.compact}
                    faded={!!dragging}
                    selected={selected === pl.o.key}
                    clipTop={pl.clipTop}
                    clipBottom={pl.clipBottom}
                  />
                );
              })}

              {/* Linea di "adesso" */}
              {d === nowDay && (
                <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: (nowMin / 60) * hourPx }}>
                  <div className="h-[2px] bg-gradient-to-r from-white via-white/75 to-white/25 shadow-[0_0_8px_rgb(255_255_255/0.4)]" />
                  <div className="absolute -top-[4px] -left-[5px] size-[10px] rounded-full bg-white shadow-[0_0_10px_rgb(255_255_255/0.8)]" />
                </div>
              )}

              {/* Anteprima del trascinamento */}
              {drag && drag.day === i && <Ghost drag={drag} hourPx={hourPx} categories={p.categories} />}
              {drop && drop.day === i && (
                <div
                  className="pointer-events-none absolute inset-x-1 z-20 rounded-lg border border-dashed border-white/50 bg-white/[0.08]"
                  style={{ top: (drop.min / 60) * hourPx, height: (drop.len / 60) * hourPx }}
                >
                  <span className="px-1.5 text-[11px] font-semibold">{hhmm(drop.min)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const chip = (color: string): CSSProperties => ({
  background: `color-mix(in oklab, ${color} 30%, #0a0a0a)`,
  boxShadow: `inset 2px 0 0 ${color}`,
});

function EventBlock(props: {
  o: Occurrence;
  color: string;
  top: number;
  height: number;
  left: number;
  width: number;
  compact?: boolean;
  faded: boolean;
  selected: boolean;
  clipTop: boolean;
  clipBottom: boolean;
}) {
  const { o, color, height } = props;
  const short = height < 34;
  return (
    <div
      data-key={o.key}
      className={`cal-event group absolute z-[1] cursor-grab overflow-hidden rounded-lg transition-[opacity,box-shadow] duration-150 active:cursor-grabbing ${
        props.faded ? "opacity-30" : ""
      } ${props.selected ? "z-[2] ring-2 ring-white/80" : "hover:brightness-110"} ${o.isDone ? "cal-done" : ""}`}
      style={{
        top: props.top + 1,
        height: Math.max(height - 2, 14),
        left: `calc(${props.left * 100}% + 2px)`,
        width: `calc(${props.width * 100}% - 4px)`,
        background: `color-mix(in oklab, ${color} 27%, #0b0b0b)`,
        boxShadow: `inset 3px 0 0 ${color}, inset 0 0 0 1px color-mix(in oklab, ${color} 22%, transparent)`,
        borderTopLeftRadius: props.clipTop ? 0 : undefined,
        borderTopRightRadius: props.clipTop ? 0 : undefined,
        borderBottomLeftRadius: props.clipBottom ? 0 : undefined,
        borderBottomRightRadius: props.clipBottom ? 0 : undefined,
      }}
    >
      <div className={`flex h-full min-w-0 ${short ? "items-center gap-1.5 px-2" : "flex-col px-2 py-1"} ${props.compact ? "px-1!" : ""}`}>
        <span className={`truncate font-semibold ${props.compact ? "text-[10px] leading-tight" : "text-[12px] leading-snug"} ${o.isDone ? "line-through decoration-white/50" : ""}`}>
          {o.isDone && "✓ "}
          {o.title}
        </span>
        {!props.compact && (
          <span className={`truncate text-[11px] text-white/60 tabular-nums ${short ? "shrink-0" : ""}`}>
            {o.start.slice(11)}–{o.end.slice(11)}
            {!short && o.place ? ` · ${o.place}` : ""}
            {o.repeat ? " ↻" : ""}
            {o.by !== "tu" ? ` · ${o.by}` : ""}
          </span>
        )}
      </div>
      {/* Maniglie per cambiare la durata (col mouse sempre; col dito quando l'evento è selezionato) */}
      {!props.clipTop && (
        <div data-handle="start" className={`absolute inset-x-0 top-0 h-2 cursor-ns-resize ${props.selected ? "touch-none" : ""}`}>
          {props.selected && <span className="absolute -top-1 left-1/2 h-1.5 w-8 -translate-x-1/2 rounded-full bg-white shadow" />}
        </div>
      )}
      {!props.clipBottom && (
        <div data-handle="end" className={`absolute inset-x-0 bottom-0 h-2.5 cursor-ns-resize ${props.selected ? "touch-none" : ""}`}>
          <span
            className={`absolute bottom-0.5 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-white/70 transition-opacity ${props.selected ? "w-8! bg-white opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          />
        </div>
      )}
    </div>
  );
}

function Ghost({ drag, hourPx, categories }: { drag: Drag; hourPx: number; categories: Category[] }) {
  const [a, b] = drag.kind === "create" ? [drag.a, drag.b] : drag.kind === "move" ? [drag.start, drag.start + drag.len] : [drag.start, drag.end];
  const color = drag.kind === "create" ? "#d9d9d9" : colorOf(categories, drag.o.category);
  const visibleB = Math.min(b, 1440);
  return (
    <div
      className="pointer-events-none absolute inset-x-1 z-30 rounded-lg"
      style={{
        top: (Math.max(0, a) / 60) * hourPx + 1,
        height: Math.max(((visibleB - Math.max(0, a)) / 60) * hourPx - 2, 14),
        background:
          drag.kind === "create"
            ? "linear-gradient(180deg, rgb(255 255 255 / 0.22), rgb(255 255 255 / 0.1))"
            : `linear-gradient(180deg, color-mix(in oklab, ${color} 50%, #111), color-mix(in oklab, ${color} 34%, #0a0a0a))`,
        boxShadow: `inset 3px 0 0 ${color}, 0 0 0 1px rgb(255 255 255 / 0.55), 0 18px 40px -12px rgb(0 0 0 / 0.95), 0 0 24px -6px ${color}`,
      }}
    >
      <div className="flex flex-col px-2 py-1 leading-tight">
        <span className="truncate text-[12px] font-semibold">{drag.kind === "create" ? "Nuovo" : drag.o.title}</span>
        <span className="text-[11px] font-medium text-white/80 tabular-nums">
          {hhmm(Math.max(0, a))}–{hhmm(b % 1440)}
        </span>
      </div>
    </div>
  );
}
