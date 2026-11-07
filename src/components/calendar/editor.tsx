"use client";

import { useEffect, useRef, useState } from "react";
import { ago } from "@/lib/client";
import {
  WEEKDAYS_SHORT,
  addDays,
  addMinutes,
  dayOf,
  diffMinutes,
  durationLabel,
  hhmm,
  minuteOf,
  repeatLabel,
  weekday,
  type CalEvent,
  type Category,
  type Occurrence,
  type Repeat,
} from "@/lib/calendar";
import { Icon } from "../icons";
import { Button, Field, Modal, inputClass } from "../kit";
import type { EventFields } from "./data";

export type Draft = {
  title: string;
  mode: "timed" | "allday" | "backlog";
  day: string;
  startTime: string;
  endTime: string;
  endDay: string;
  minutes: number;
  due: string;
  category?: string;
  place: string;
  notes: string;
  done: boolean;
  repeat: Repeat | null;
};

/** Bozza dell'editor a partire da un evento esistente o da valori di partenza. */
export function draftFrom(e: Partial<CalEvent | Occurrence>, fallbackDay: string): Draft {
  const start = e.start;
  const timed = !!start && !e.allDay;
  const day = start ? dayOf(start) : fallbackDay;
  const st = timed ? start!.slice(11) : "09:00";
  const en = timed && e.end ? e.end.slice(11) : hhmm((minuteOf(`${day}T${st}`) + 60) % 1440);
  return {
    title: e.title ?? "",
    mode: !start ? (e.id ? "backlog" : "timed") : e.allDay ? "allday" : "timed",
    day,
    startTime: st,
    endTime: en,
    endDay: e.allDay && e.end ? e.end : day,
    minutes: e.minutes ?? (timed && e.end ? diffMinutes(start!, e.end) : 60),
    due: e.due ?? "",
    category: e.category,
    place: e.place ?? "",
    notes: e.notes ?? "",
    done: "isDone" in e ? !!e.isDone : !!e.done,
    repeat: e.repeat ?? null,
  };
}

export function fieldsFrom(d: Draft): EventFields {
  const base = { title: d.title.trim(), category: d.category ?? "", place: d.place.trim(), notes: d.notes.trim(), done: d.done };
  if (d.mode === "backlog") return { ...base, minutes: d.minutes, due: d.due || undefined };
  if (d.mode === "allday") return { ...base, start: d.day, end: d.endDay >= d.day ? d.endDay : d.day, allDay: true, repeat: d.repeat };
  const start = `${d.day}T${d.startTime}`;
  let end = `${d.day}T${d.endTime}`;
  if (end <= start) end = `${addDays(d.day, 1)}T${d.endTime}`; // passa la mezzanotte
  return { ...base, start, end, allDay: false, repeat: d.repeat };
}

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];

type RepeatPreset = "none" | "daily" | "weekdays" | "weekly" | "custom" | "monthly";
function presetOf(r: Repeat | null): RepeatPreset {
  if (!r) return "none";
  if (r.freq === "daily") return "daily";
  if (r.freq === "monthly") return "monthly";
  const days = [...(r.days ?? [])].sort().join();
  if (days === "1,2,3,4,5") return "weekdays";
  return (r.days?.length ?? 0) > 1 ? "custom" : "weekly";
}

export function EventEditor(p: {
  draft: Draft;
  existing?: CalEvent | Occurrence;
  categories: Category[];
  byName: (id: string) => string;
  onSave: (fields: EventFields, scope: "this" | "all") => void;
  onDelete?: (scope: "this" | "all") => void;
  onClose: () => void;
}) {
  const [d, setD] = useState<Draft>(p.draft);
  const isSeries = !!p.existing?.repeat && !!(p.existing as Occurrence).occ;
  const [scope, setScope] = useState<"this" | "all">("this");
  const titleRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  useEffect(() => {
    if (!p.existing) titleRef.current?.focus();
  }, [p.existing]);

  const duration = (() => {
    const s = minuteOf(`${d.day}T${d.startTime}`);
    let e = minuteOf(`${d.day}T${d.endTime}`);
    if (e <= s) e += 1440;
    return e - s;
  })();
  const setDuration = (m: number) => set({ endTime: addMinutes(`${d.day}T${d.startTime}`, m).slice(11) });
  const setStart = (t: string) => set({ startTime: t, endTime: addMinutes(`${d.day}T${t}`, duration).slice(11) });

  const preset = presetOf(d.repeat);
  const setPreset = (v: RepeatPreset) => {
    const until = d.repeat?.until;
    const wd = weekday(d.day);
    const r: Repeat | null =
      v === "none"
        ? null
        : v === "daily"
          ? { freq: "daily" }
          : v === "weekdays"
            ? { freq: "weekly", days: [1, 2, 3, 4, 5] }
            : v === "weekly"
              ? { freq: "weekly", days: [wd] }
              : v === "custom"
                ? { freq: "weekly", days: d.repeat?.days?.length ? d.repeat.days : [wd] }
                : { freq: "monthly" };
    set({ repeat: r && until ? { ...r, until } : r });
  };

  const save = () => {
    if (!d.title.trim()) return titleRef.current?.focus();
    const fields = fieldsFrom(d);
    if (isSeries && scope === "this") delete fields.repeat;
    p.onSave(fields, scope);
  };

  const showRepeat = d.mode !== "backlog" && (!isSeries || scope === "all");

  return (
    <Modal
      title={p.existing ? "Modifica" : "Nuovo"}
      onClose={p.onClose}
      footer={
        <>
          {p.onDelete && (
            <Button variant="danger" icon="trash" onClick={() => p.onDelete!(scope)}>
              <span className="hidden sm:inline">{isSeries && scope === "this" ? "Elimina questo" : "Elimina"}</span>
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="ghost" onClick={p.onClose}>
            Annulla
          </Button>
          <Button icon="check" onClick={save}>
            Salva
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-4"
      >
        <input
          ref={titleRef}
          value={d.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Cosa fai?"
          aria-label="Titolo"
          className="w-full border-b border-line bg-transparent pb-3 text-[1.375rem] font-semibold tracking-tight outline-none placeholder:text-[#5a5a5a] focus:border-white/25"
          maxLength={200}
        />

        {isSeries && (
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: "this", label: "Solo questo giorno" },
              { value: "all", label: "Tutta la serie" },
            ]}
          />
        )}

        <Segmented
          value={d.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: "timed", label: "Orario" },
            { value: "allday", label: "Tutto il giorno" },
            { value: "backlog", label: "Da pianificare" },
          ]}
        />

        {d.mode === "timed" && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="col-span-2 sm:col-span-1">
                <Field label="Giorno">
                  <input type="date" value={d.day} onChange={(e) => e.target.value && set({ day: e.target.value })} className={inputClass} />
                </Field>
              </div>
              <Field label="Dalle">
                <input type="time" step={300} value={d.startTime} onChange={(e) => e.target.value && setStart(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Alle">
                <input type="time" step={300} value={d.endTime} onChange={(e) => e.target.value && set({ endTime: e.target.value })} className={inputClass} />
              </Field>
            </div>
            <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5">
              {DURATIONS.map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setDuration(m)}
                  aria-pressed={duration === m}
                  className="press chip h-8! px-3! text-xs!"
                >
                  {durationLabel(m)}
                </button>
              ))}
              {!DURATIONS.includes(duration) && <span className="grid h-8 shrink-0 place-items-center px-2 text-xs text-muted">{durationLabel(duration)}</span>}
            </div>
          </div>
        )}

        {d.mode === "allday" && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Dal">
              <input type="date" value={d.day} onChange={(e) => e.target.value && set({ day: e.target.value, endDay: e.target.value > d.endDay ? e.target.value : d.endDay })} className={inputClass} />
            </Field>
            <Field label="Al (incluso)">
              <input type="date" value={d.endDay} min={d.day} onChange={(e) => e.target.value && set({ endDay: e.target.value })} className={inputClass} />
            </Field>
          </div>
        )}

        {d.mode === "backlog" && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Quanto ci vuole">
              <select value={d.minutes} onChange={(e) => set({ minutes: +e.target.value })} className={inputClass}>
                {[15, 30, 45, 60, 90, 120, 180, 240].map((m) => (
                  <option key={m} value={m}>
                    {durationLabel(m)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Entro" hint="facoltativo">
              <input type="date" value={d.due} onChange={(e) => set({ due: e.target.value })} className={inputClass} />
            </Field>
          </div>
        )}

        {showRepeat && (
          <div className="space-y-2">
            <Field label="Si ripete">
              <select value={preset} onChange={(e) => setPreset(e.target.value as RepeatPreset)} className={inputClass}>
                <option value="none">Non si ripete</option>
                <option value="daily">Ogni giorno</option>
                <option value="weekdays">Giorni feriali (lun–ven)</option>
                <option value="weekly">Ogni {WEEKDAYS_SHORT[weekday(d.day) - 1]}</option>
                <option value="custom">Giorni scelti…</option>
                <option value="monthly">Ogni mese, il {+d.day.slice(8)}</option>
              </select>
            </Field>
            {preset === "custom" && (
              <div className="flex gap-1">
                {WEEKDAYS_SHORT.map((w, i) => {
                  const on = d.repeat?.days?.includes(i + 1);
                  return (
                    <button
                      type="button"
                      key={w}
                      onClick={() => {
                        const days = new Set(d.repeat?.days ?? []);
                        if (on) days.delete(i + 1);
                        else days.add(i + 1);
                        if (days.size) set({ repeat: { ...d.repeat!, days: [...days].sort() } });
                      }}
                      aria-pressed={!!on}
                      className="press chip h-9 flex-1 justify-center rounded-lg! px-0! text-xs!"
                    >
                      {w}
                    </button>
                  );
                })}
              </div>
            )}
            {d.repeat && (
              <div className="flex items-center gap-2 text-xs text-muted">
                <span>Fino al</span>
                <input
                  type="date"
                  value={d.repeat.until ?? ""}
                  min={d.day}
                  onChange={(e) => set({ repeat: { ...d.repeat!, until: e.target.value || undefined } })}
                  className="field h-9 w-auto py-0 text-[13px]"
                />
                <span className="truncate">{d.repeat.until ? "" : "(per sempre)"}</span>
              </div>
            )}
          </div>
        )}

        <div role="group" aria-label="Categoria" className="space-y-1.5">
          <span className="block text-xs font-medium text-soft">Categoria</span>
          <div className="flex flex-wrap gap-1.5">
            {p.categories.map((c) => {
              const on = d.category === c.id;
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => set({ category: on ? undefined : c.id })}
                  aria-pressed={on}
                  className="press chip"
                  style={on ? { background: `color-mix(in oklab, ${c.color} 28%, #0c0c0c)`, boxShadow: `inset 0 0 0 1px ${c.color}` } : undefined}
                >
                  <span className="size-2 rounded-full" style={{ background: c.color }} />
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Dove" hint="facoltativo">
            <input value={d.place} onChange={(e) => set({ place: e.target.value })} placeholder="Palestra, casa, Milano…" className={inputClass} maxLength={200} />
          </Field>
          <label className="field flex cursor-pointer items-center gap-2.5 self-end text-sm">
            <input type="checkbox" checked={d.done} onChange={(e) => set({ done: e.target.checked })} className="size-4 accent-white" />
            Fatto
          </label>
        </div>

        <Field label="Note">
          <textarea value={d.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} className={`${inputClass} resize-none`} maxLength={4000} />
        </Field>

        {p.existing && (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Icon name={p.existing.by === "tu" ? "check" : "spark"} className="size-3.5" />
            {p.existing.by === "tu" ? "Aggiunto da te" : `Aggiunto da ${p.byName(p.existing.by)}`} · {ago(p.existing.createdAt)}
            {p.existing.repeat ? ` · ${repeatLabel(p.existing.repeat)}` : ""}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="seg flex! w-full">
      {options.map((o) => (
        <button type="button" key={o.value} onClick={() => onChange(o.value)} aria-pressed={o.value === value} className="press seg-item flex-1 px-2! text-[13px]!">
          {o.label}
        </button>
      ))}
    </div>
  );
}
