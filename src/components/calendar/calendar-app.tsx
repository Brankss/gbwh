"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useNow } from "@/lib/client";
import {
  MONTHS,
  MONTHS_SHORT,
  addDays,
  addMinutes,
  addMonths,
  dayLabel,
  dayOf,
  daysInMonth,
  expand,
  freeSlots,
  hhmm,
  minuteOf,
  range,
  startOfMonth,
  startOfWeek,
  wallNow,
  type CalEvent,
  type Occurrence,
} from "@/lib/calendar";
import { Icon } from "../icons";
import { Modal, PageHeader } from "../kit";
import { useCalendarActions, useCalendarData, type EventFields, type Toast } from "./data";
import { EventEditor, draftFrom, type Draft } from "./editor";
import { MonthGrid } from "./month-grid";
import { QuickAdd } from "./quick-add";
import { CalendarSettings } from "./settings";
import { SidePanel } from "./side-panel";
import { TimeGrid } from "./time-grid";

type View = "day" | "week" | "month";

/** true su schermi stretti (telefono): la settimana diventa compatta. */
function useNarrow() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(max-width: 767px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false,
  );
}
const ZOOM = [32, 44, 60, 84];

function readLocal(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export function CalendarApp() {
  const nowMs = useNow(); // la pagina monta questo componente solo quando l'ora è nota
  const now = wallNow(undefined, nowMs);
  const today = dayOf(now);

  const [view, setViewState] = useState<View>(() => {
    const saved = readLocal("cal:view");
    if (saved === "day" || saved === "week" || saved === "month") return saved;
    return window.matchMedia("(min-width: 768px)").matches ? "week" : "day";
  });
  const [anchor, setAnchor] = useState(today);
  const [zoom, setZoomState] = useState(() => Math.min(ZOOM.length - 1, Math.max(0, Number(readLocal("cal:zoom") ?? 1))));
  const [editor, setEditor] = useState<{ draft: Draft; existing?: CalEvent | Occurrence } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [panel, setPanel] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"agenti" | "categorie" | "richieste" | "registro" | null>(null);
  const quickRef = useRef<HTMLInputElement>(null);
  const narrow = useNarrow();

  const setView = (v: View) => {
    setViewState(v);
    writeLocal("cal:view", v);
  };
  const setZoom = (z: number) => {
    const v = Math.min(ZOOM.length - 1, Math.max(0, z));
    setZoomState(v);
    writeLocal("cal:zoom", String(v));
  };

  const { data, meta } = useCalendarData(anchor);
  const showToast = useCallback((t: Toast) => setToast(t), []);
  const actions = useCalendarActions(data, showToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.undo ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const settings = meta.data?.settings;
  const categories = useMemo(() => settings?.categories ?? [], [settings]);
  const events = useMemo(() => data.data?.events ?? [], [data.data]);
  const backlog = data.data?.backlog ?? [];
  const pending = meta.data?.requests.filter((r) => r.status === "pending").length ?? 0;
  const byName = useCallback((id: string) => (id === "tu" ? "Tu" : (meta.data?.bots.find((b) => b.id === id)?.name ?? id)), [meta.data]);

  const days = useMemo(
    () => (view === "day" ? [anchor] : view === "week" ? range(startOfWeek(anchor), 7) : range(startOfWeek(startOfMonth(anchor)), 42)),
    [view, anchor],
  );
  const occs = useMemo(() => expand(events, days[0], days[days.length - 1]), [events, days]);
  const [statsFrom, statsTo] = view === "month" ? [startOfMonth(anchor), addDays(startOfMonth(anchor), daysInMonth(anchor) - 1)] : [days[0], days[days.length - 1]];

  const shift = useCallback(
    (dir: 1 | -1) => setAnchor((a) => (view === "day" ? addDays(a, dir) : view === "week" ? addDays(a, 7 * dir) : addMonths(a, dir))),
    [view],
  );

  const label = (() => {
    if (view === "day") return dayLabel(anchor, true);
    if (view === "month") return `${MONTHS[+anchor.slice(5, 7) - 1]} ${anchor.slice(0, 4)}`;
    const a = days[0];
    const b = days[6];
    return a.slice(5, 7) === b.slice(5, 7)
      ? `${+a.slice(8)} – ${+b.slice(8)} ${MONTHS_SHORT[+b.slice(5, 7) - 1]} ${b.slice(0, 4)}`
      : `${+a.slice(8)} ${MONTHS_SHORT[+a.slice(5, 7) - 1]} – ${+b.slice(8)} ${MONTHS_SHORT[+b.slice(5, 7) - 1]} ${b.slice(0, 4)}`;
  })();
  const isNowVisible = days.includes(today) && (view !== "month" || anchor.slice(0, 7) === today.slice(0, 7));
  const atToday = view === "day" ? anchor === today : isNowVisible;
  const shortLabel =
    view === "day"
      ? anchor === addDays(today, 1)
        ? "Domani"
        : anchor === addDays(today, -1)
          ? "Ieri"
          : dayLabel(anchor)
      : view === "week"
        ? `${+days[0].slice(8)}–${+days[6].slice(8)} ${MONTHS_SHORT[+days[6].slice(5, 7) - 1]}`
        : `${MONTHS_SHORT[+anchor.slice(5, 7) - 1]} ${anchor.slice(2, 4)}`;

  /* ---------- Azioni ---------- */
  const openNew = (patch: Partial<Draft>, from?: EventFields) =>
    setEditor({ draft: { ...draftFrom((from ?? {}) as Partial<CalEvent>, anchor), ...patch } });

  const openSlot = (day: string, a: number, b: number) => openNew({ mode: "timed", day, startTime: hhmm(a), endTime: hhmm(b % 1440) });
  const openOcc = (o: Occurrence | CalEvent) => setEditor({ draft: draftFrom(o, anchor), existing: o });

  const save = async (fields: EventFields, scope: "this" | "all") => {
    const existing = editor?.existing;
    setEditor(null);
    if (!existing) return void actions.create(fields);
    if (existing.start && !fields.start) return void actions.update(existing, { ...fields, unschedule: true }, { scope, label: "Da pianificare:" });
    await actions.update(existing, fields, { scope, label: "Salvato" });
  };

  const place = (e: CalEvent) => {
    const minutes = e.minutes ?? 60;
    const fromDay = anchor > today ? anchor : today;
    for (let i = 0; i < 14; i++) {
      const day = addDays(fromDay, i);
      const [slot] = freeSlots(expand(events, day, day), day, {
        minutes,
        fromMin: (settings?.dayStart ?? 7) * 60,
        toMin: (settings?.dayEnd ?? 23) * 60,
        notBefore: day === today ? now : undefined,
      });
      if (slot) {
        void actions.update(e, { start: slot.start, end: addMinutes(slot.start, minutes), allDay: false }, { label: `Messo ${dayLabel(day)} ${slot.start.slice(11)}:` });
        if (view !== "month" && !days.includes(day)) setAnchor(day);
        return;
      }
    }
    showToast({ text: "Nessuno spazio libero nei prossimi 14 giorni", error: true });
  };

  const dropBacklog = (id: string, start: string) => {
    const e = backlog.find((b) => b.id === id);
    if (e) void actions.update(e, { start, end: addMinutes(start, e.minutes ?? 60), allDay: false }, { label: "Pianificato" });
  };

  /* ---------- Tastiera (desktop) ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (editor || settingsTab || panel || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      const k = e.key.toLowerCase();
      if (k === "t") setAnchor(today);
      else if (k === "g") setView("day");
      else if (k === "s") setView("week");
      else if (k === "m") setView("month");
      else if (e.key === "ArrowLeft") shift(-1);
      else if (e.key === "ArrowRight") shift(1);
      else if (k === "n" || e.key === "/") {
        e.preventDefault();
        quickRef.current?.focus();
      } else if (e.key === "+" || e.key === "=") setZoom(zoom + 1);
      else if (e.key === "-") setZoom(zoom - 1);
      else return;
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const side = (
    <SidePanel
      backlog={backlog}
      categories={categories}
      occs={occs}
      statsFrom={statsFrom}
      statsTo={statsTo}
      statsLabel={view === "day" ? "oggi" : view === "week" ? "settimana" : "mese"}
      requests={meta.data?.requests ?? []}
      log={meta.data?.log ?? []}
      byName={byName}
      onOpenBacklog={(e) => {
        setPanel(false);
        openOcc(e);
      }}
      onPlace={(e) => {
        setPanel(false);
        place(e);
      }}
      onToast={showToast}
      onAllRequests={() => {
        setPanel(false);
        setSettingsTab("richieste");
      }}
      extra={
        view === "week" && (
          <button
            onClick={() => void actions.copyWeek(days[0], addDays(days[0], 7))}
            className="press flex w-full items-center gap-2.5 rounded-xl border border-white/10 px-3 py-2.5 text-left text-[13px] text-[#b4b4b4] hover:border-white/25 hover:text-fg"
          >
            <Icon name="copy" className="size-4 shrink-0" />
            <span>
              <span className="block font-medium text-fg">Copia questa settimana nella prossima</span>
              <span className="block text-[11.5px] text-muted">Per ripartire da una settimana venuta bene.</span>
            </span>
          </button>
        )
      }
    />
  );

  return (
    <>
      <PageHeader
        wide
        title="Calendario"
        subtitle={label[0].toUpperCase() + label.slice(1)}
        actions={
          <>
            <button
              onClick={() => setPanel(true)}
              aria-label="Da pianificare e statistiche"
              className="press relative grid size-9 place-items-center rounded-full text-[#b4b4b4] hover:bg-white/[0.07] hover:text-fg lg:hidden"
            >
              <Icon name="inbox" />
              {backlog.length > 0 && (
                <span className="chrome absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold ring-2 ring-black">{backlog.length}</span>
              )}
            </button>
            <button
              onClick={() => setSettingsTab(pending ? "richieste" : "agenti")}
              aria-label="Impostazioni calendario"
              title="Agenti, categorie, richieste"
              className="press relative grid size-9 place-items-center rounded-full text-[#b4b4b4] hover:bg-white/[0.07] hover:text-fg"
            >
              <Icon name="sliders" />
              {pending > 0 && (
                <span className="chrome absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold ring-2 ring-black">{pending}</span>
              )}
            </button>
            <button
              onClick={() => openNew({ mode: "timed", day: anchor, startTime: hhmm(Math.min(22 * 60, Math.ceil((minuteOf(now) + 1) / 30) * 30)), endTime: hhmm(Math.min(23 * 60, Math.ceil((minuteOf(now) + 1) / 30) * 30 + 60)) })}
              aria-label="Nuovo evento"
              className="press chrome grid size-9 place-items-center rounded-full"
            >
              <Icon name="plus" />
            </button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mx-auto w-full max-w-6xl space-y-2.5 px-3 pt-3 md:px-6">
          {/* Navigazione */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="matte flex shrink-0 items-center rounded-2xl p-1">
              <NavButton label="Indietro" icon="back" onClick={() => shift(-1)} />
              <button
                onClick={() => setAnchor(today)}
                disabled={atToday}
                title={atToday ? undefined : "Torna a oggi"}
                className={`press h-8 min-w-[3.25rem] rounded-xl px-2 text-[13px] font-semibold whitespace-nowrap tabular-nums max-[380px]:px-1 sm:px-3 ${atToday ? "" : "text-[#d6d6d6]"}`}
              >
                {/* Mostra quello che stai guardando; "Oggi" solo quando ci sei sopra. Toccalo per tornare a oggi. */}
                {atToday ? "Oggi" : shortLabel}
              </button>
              <NavButton label="Avanti" icon="forward" onClick={() => shift(1)} />
            </div>
            <span className="hidden min-w-0 truncate text-[15px] font-semibold tracking-tight capitalize lg:block">{label}</span>
            <span className="flex-1" />
            {view !== "month" && (
              <div className="matte hidden items-center rounded-2xl p-1 sm:flex">
                <NavButton label="Riduci" icon="minus" onClick={() => setZoom(zoom - 1)} disabled={zoom === 0} />
                <NavButton label="Ingrandisci" icon="plus" onClick={() => setZoom(zoom + 1)} disabled={zoom === ZOOM.length - 1} />
              </div>
            )}
            <div role="tablist" className="matte flex shrink-0 gap-1 rounded-2xl p-1">
              {(
                [
                  ["day", "Giorno", "Giorno"],
                  ["week", "Sett.", "Settimana"],
                  ["month", "Mese", "Mese"],
                ] as const
              ).map(([v, short, long]) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={`press h-8 rounded-xl px-2.5 text-sm font-medium whitespace-nowrap max-[380px]:px-1.5 sm:px-3.5 ${view === v ? "gloss text-fg" : "border border-transparent text-muted hover:bg-white/[0.04] hover:text-fg"}`}
                >
                  <span className="sm:hidden">{short}</span>
                  <span className="hidden sm:inline">{long}</span>
                </button>
              ))}
            </div>
          </div>

          {settings && <QuickAdd ref={quickRef} now={now} categories={categories} onAdd={(f) => void actions.create(f)} onDetails={(f) => openNew({}, f)} />}
        </div>

        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 gap-5 px-3 pt-2.5 pb-[max(0.75rem,var(--badge-space,0px))] md:px-6">
          <div className="matte relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[1.25rem]">
            {!data.data || !settings ? (
              <div className="m-3 flex-1 skeleton rounded-xl" />
            ) : view === "month" ? (
              <MonthGrid
                anchor={anchor}
                occs={occs}
                categories={categories}
                today={today}
                selected={anchor}
                onSelect={setAnchor}
                onOpenDay={(d) => {
                  setAnchor(d);
                  setView("day");
                }}
                onOpen={openOcc}
                onAdd={(d) => openNew({ mode: "timed", day: d, startTime: "09:00", endTime: "10:00" })}
              />
            ) : (
              <TimeGrid
                key={view}
                days={days}
                occs={occs}
                categories={categories}
                now={now}
                hourPx={ZOOM[zoom]}
                compact={view === "week" && narrow}
                scrollTo={days.includes(today) ? Math.max(0, minuteOf(now) - 90) : settings.dayStart * 60}
                onOpen={openOcc}
                onCreate={openSlot}
                onChange={(o, start, end) => void actions.update(o, { start, end, allDay: false }, { label: "Spostato" })}
                onDropBacklog={dropBacklog}
                onDayClick={view === "week" ? (d) => (setAnchor(d), setView("day")) : undefined}
                onSwipe={shift}
              />
            )}
          </div>
          <aside className="scroll-thin hidden w-72 shrink-0 overflow-y-auto pb-6 lg:block">{settings && side}</aside>
        </div>
      </div>

      {panel && (
        <Modal title="Da pianificare e tempo" onClose={() => setPanel(false)}>
          {side}
        </Modal>
      )}

      {editor && settings && (
        <EventEditor
          key={editor.existing?.id ?? "new"}
          draft={editor.draft}
          existing={editor.existing}
          categories={categories}
          byName={byName}
          onClose={() => setEditor(null)}
          onSave={save}
          onDelete={
            editor.existing
              ? (scope) => {
                  const ex = editor.existing!;
                  setEditor(null);
                  void actions.remove(ex, { occurrenceOnly: scope === "this" });
                }
              : undefined
          }
        />
      )}

      {settingsTab && meta.data && <CalendarSettings meta={meta.data} initialTab={settingsTab} onClose={() => setSettingsTab(null)} onToast={showToast} />}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4" style={{ bottom: "max(1.25rem, calc(var(--badge-space, 0px) + 0.5rem))" }}>
          <div
            role="status"
            className={`card animate-rise pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl! py-2.5 pr-2 pl-4 text-sm shadow-[0_20px_50px_-15px_rgb(0_0_0/0.9)] ${toast.error ? "text-[#ec8585]" : ""}`}
          >
            <span className="min-w-0 flex-1 leading-snug">{toast.text}</span>
            {toast.undo && (
              <button
                onClick={() => {
                  toast.undo!();
                  setToast(null);
                }}
                className="press chrome h-8 shrink-0 rounded-xl px-3 text-[13px] font-semibold"
              >
                Annulla
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function NavButton({ label, icon, onClick, disabled }: { label: string; icon: "back" | "forward" | "plus" | "minus"; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label} className="press grid size-8 place-items-center max-[380px]:size-7 rounded-xl text-[#b4b4b4] hover:bg-white/[0.06] hover:text-fg disabled:opacity-30">
      <Icon name={icon} className="size-4" />
    </button>
  );
}
