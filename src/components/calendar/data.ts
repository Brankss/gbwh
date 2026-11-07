"use client";

import { useCallback } from "react";
import { ApiError, send, useApi } from "@/lib/client";
import type { Bot } from "@/lib/bots";
import {
  addDays,
  addMonths,
  dayOf,
  startOfMonth,
  startOfWeek,
  type CalEvent,
  type CalLogEntry,
  type CalRequest,
  type CalSettings,
  type Occurrence,
} from "@/lib/calendar";

// Dati del calendario nel browser: una finestra di ~3 mesi attorno al giorno che guardi,
// così passare da un giorno/settimana/mese all'altro è istantaneo.

export type CalData = { events: CalEvent[]; backlog: CalEvent[]; now: string };
export type CalMeta = { settings: CalSettings; requests: CalRequest[]; log: CalLogEntry[]; bots: Bot[] };

export type EventFields = Partial<
  Pick<CalEvent, "title" | "start" | "end" | "allDay" | "minutes" | "due" | "category" | "place" | "notes" | "done">
> & { repeat?: CalEvent["repeat"] | null };

export type Toast = { text: string; undo?: () => void; error?: boolean };

export function windowFor(anchor: string) {
  return { from: startOfWeek(addMonths(anchor, -1)), to: addDays(addMonths(startOfMonth(anchor), 2), 6) };
}

const META = "/api/calendar/meta";

export function useCalendarData(anchor: string) {
  const { from, to } = windowFor(anchor);
  const key = `/api/calendar?from=${from}&to=${to}`;
  const data = useApi<CalData>(key, { refreshInterval: 20_000, keepPreviousData: true });
  const meta = useApi<CalMeta>(META, { refreshInterval: 30_000 });
  return { key, data, meta };
}

const tmpId = () => `tmp-${Math.random().toString(36).slice(2)}`;

function patchLocal(e: CalEvent, fields: EventFields): CalEvent {
  const next = { ...e, ...fields, updatedAt: Date.now() } as CalEvent;
  if (fields.repeat === null) delete next.repeat;
  return next;
}

/** Azioni con aggiornamento immediato sullo schermo (il server conferma subito dopo). */
export function useCalendarActions(data: ReturnType<typeof useApi<CalData>>, toast: (t: Toast) => void) {
  const { mutate } = data;

  const run = useCallback(
    async <T,>(change: (d: CalData) => CalData, request: () => Promise<T>): Promise<T | null> => {
      let result: T | null = null;
      try {
        await mutate(
          async () => {
            result = await request();
            return undefined;
          },
          { optimisticData: (d) => (d ? change(d) : (d as never)), rollbackOnError: true, populateCache: false, revalidate: true },
        );
        return result;
      } catch (e) {
        toast({ text: e instanceof ApiError ? e.message : "Qualcosa è andato storto", error: true });
        return null;
      }
    },
    [mutate, toast],
  );

  const restore = useCallback(
    (snapshot: CalEvent, drop?: string) =>
      run(
        (d) => ({
          ...d,
          events: [...d.events.filter((e) => e.id !== snapshot.id && e.id !== drop), ...(snapshot.start ? [snapshot] : [])],
          backlog: [...d.backlog.filter((e) => e.id !== snapshot.id && e.id !== drop), ...(snapshot.start ? [] : [snapshot])],
        }),
        async () => {
          if (drop) await send("DELETE", `/api/calendar/${drop}`);
          return send("POST", "/api/calendar", { restore: snapshot });
        },
      ),
    [run],
  );

  /** Modifica. Per un'occorrenza di una serie: scope "this" la stacca, "all" cambia la serie. */
  const update = useCallback(
    async (target: CalEvent | Occurrence, fields: EventFields & { unschedule?: boolean }, opts: { scope?: "this" | "all"; label?: string; quiet?: boolean } = {}) => {
      const occ = "occ" in target ? target.occ : undefined;
      const series = data.data?.events.find((e) => e.id === target.id) ?? data.data?.backlog.find((e) => e.id === target.id);
      const snapshot = series ?? (target as CalEvent);
      const scope = occ ? (opts.scope ?? "this") : undefined;
      const onlyDone = Object.keys(fields).length === 1 && "done" in fields;

      const res = await run(
        (d) => {
          const events = d.events.slice();
          let backlog = d.backlog.slice();
          const i = events.findIndex((e) => e.id === target.id);
          if (occ && onlyDone && i >= 0) {
            const set = new Set(events[i].doneDates ?? []);
            if (fields.done) set.add(occ);
            else set.delete(occ);
            events[i] = { ...events[i], doneDates: [...set] };
          } else if (occ && scope === "this" && i >= 0) {
            events[i] = { ...events[i], exdates: [...(events[i].exdates ?? []), occ] };
            const detached = patchLocal({ ...events[i], id: tmpId(), repeat: undefined, exdates: undefined, doneDates: undefined, start: target.start, end: target.end }, fields);
            if (fields.unschedule) backlog = [...backlog, { ...detached, start: undefined, end: undefined }];
            else events.push(detached);
          } else if (fields.unschedule) {
            const e = events[i] ?? backlog.find((b) => b.id === target.id);
            if (e) backlog = [...backlog.filter((b) => b.id !== e.id), { ...e, start: undefined, end: undefined, allDay: undefined, repeat: undefined }];
            if (i >= 0) events.splice(i, 1);
          } else if (i >= 0) {
            events[i] = patchLocal(events[i], fields);
          } else {
            const j = backlog.findIndex((e) => e.id === target.id);
            if (j >= 0) {
              const moved = patchLocal(backlog[j], fields);
              backlog = backlog.filter((e) => e.id !== target.id);
              if (moved.start) events.push(moved);
              else backlog.push(moved);
            }
          }
          return { ...d, events, backlog };
        },
        () =>
          send<{ event: CalEvent; detached?: boolean; conflicts: { title: string }[] }>("PATCH", `/api/calendar/${target.id}`, {
            ...fields,
            ...(occ ? { occurrence: occ, scope } : {}),
          }),
      );
      if (res && !opts.quiet) {
        const clash = res.conflicts?.length ? ` · si accavalla con ${res.conflicts.map((c) => `«${c.title}»`).join(", ")}` : "";
        toast({ text: `${opts.label ?? "Modificato"} «${res.event.title}»${clash}`, undo: () => restore(snapshot, res.detached ? res.event.id : undefined) });
      }
      return res?.event ?? null;
    },
    [data.data, run, toast, restore],
  );

  const remove = useCallback(
    async (target: CalEvent | Occurrence, opts: { occurrenceOnly?: boolean } = {}) => {
      const occ = "occ" in target && opts.occurrenceOnly !== false ? target.occ : undefined;
      const series = data.data?.events.find((e) => e.id === target.id) ?? data.data?.backlog.find((e) => e.id === target.id) ?? (target as CalEvent);
      const res = await run(
        (d) =>
          occ
            ? { ...d, events: d.events.map((e) => (e.id === target.id ? { ...e, exdates: [...(e.exdates ?? []), occ] } : e)) }
            : { ...d, events: d.events.filter((e) => e.id !== target.id), backlog: d.backlog.filter((e) => e.id !== target.id) },
        () => send("DELETE", `/api/calendar/${target.id}${occ ? `?occurrence=${occ}` : ""}`),
      );
      if (res) toast({ text: `Eliminato «${target.title}»${occ ? " (solo quel giorno)" : ""}`, undo: () => restore(series) });
    },
    [data.data, run, toast, restore],
  );

  const create = useCallback(
    async (fields: EventFields, label = "Aggiunto") => {
      const local: CalEvent = { id: tmpId(), createdAt: Date.now(), updatedAt: Date.now(), by: "tu", title: fields.title ?? "", ...fields } as CalEvent;
      const res = await run(
        (d) => (local.start ? { ...d, events: [...d.events, local] } : { ...d, backlog: [...d.backlog, local] }),
        () => send<{ event: CalEvent; conflicts: { title: string }[] }>("POST", "/api/calendar", fields),
      );
      if (res) {
        const clash = res.conflicts.length ? ` · si accavalla con ${res.conflicts.map((c) => `«${c.title}»`).join(", ")}` : "";
        toast({ text: `${label} «${res.event.title}»${clash}`, undo: () => remove(res.event) });
      }
      return res?.event ?? null;
    },
    [run, toast, remove],
  );

  const copyWeek = useCallback(
    async (from: string, to: string) => {
      const res = await run(
        (d) => d,
        () => send<{ events: CalEvent[] }>("POST", "/api/calendar", { copyWeek: { from, to } }),
      );
      if (res) toast({ text: res.events.length ? `Copiati ${res.events.length} eventi nella settimana dopo` : "Niente da copiare (gli eventi che si ripetono ci sono già)" });
      return res;
    },
    [run, toast],
  );

  return { create, update, remove, restore, copyWeek };
}

export async function saveSettings(patch: Partial<CalSettings>) {
  return send<{ settings: CalSettings }>("PATCH", META, patch, [META]);
}

export async function decideRequest(id: string, status: "approved" | "rejected", apply: boolean) {
  return send("PATCH", `/api/calendar/requests/${id}`, { status, apply }, [META]);
}

/** Il giorno di riferimento iniziale: oggi nel browser. */
export const todayOf = (now: string) => dayOf(now);
