import "server-only";
import { z } from "zod";
import {
  CAL_TZ,
  DEFAULT_SETTINGS,
  MAX_CATEGORIES,
  PALETTE,
  addDays,
  addMinutes,
  dayOf,
  diffDays,
  diffMinutes,
  expand,
  findCategory,
  freeSlots,
  isDay,
  normalizeWhen,
  overlaps,
  relevant,
  slugify,
  toMs,
  wallNow,
  whenLabel,
  type CalEvent,
  type CalLogEntry,
  type CalRequest,
  type CalSettings,
  type Category,
  type Occurrence,
} from "./calendar";
import { parseQuick, parsedToFields } from "./calendar-parse";
import { get, list, put, remove } from "./db";
import { redis } from "./redis";

// Calendario lato server: unica porta d'ingresso per te (pagina) e per gli agent (API con token).

const COL = "cal";
const REQ_COL = "calreq";
const SETTINGS_KEY = "cal:settings";
const LOG_KEY = "cal:log";
const LOG_KEEP = 300;

type Mem = { settings?: CalSettings; log: CalLogEntry[] };
const mem = ((globalThis as { __calMem?: Mem }).__calMem ??= { log: [] });

export const tz = () => process.env.CALENDAR_TZ?.trim() || CAL_TZ;
export const now = () => wallNow(tz());

/* ------------------------------------------------------------------ */
/* Impostazioni e registro                                             */
/* ------------------------------------------------------------------ */

export async function getSettings(): Promise<CalSettings> {
  const saved = redis ? await redis.get<Partial<CalSettings>>(SETTINGS_KEY) : mem.settings;
  return { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
}

const categoryInput = z.object({
  id: z.string().trim().max(32).optional(),
  name: z.string().trim().min(1).max(30),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
});

export const settingsInput = z
  .object({
    categories: z.array(categoryInput).max(MAX_CATEGORIES),
    manager: z.string().trim().max(32).nullable(),
    prefs: z.string().max(4000),
    dayStart: z.number().int().min(0).max(23),
    dayEnd: z.number().int().min(1).max(24),
  })
  .partial();

export async function saveSettings(patch: z.infer<typeof settingsInput>): Promise<CalSettings> {
  const current = await getSettings();
  const categories = patch.categories?.map((c) => ({ id: c.id || slugify(c.name) || crypto.randomUUID().slice(0, 8), name: c.name, color: c.color }));
  const next: CalSettings = { ...current, ...patch, categories: categories ?? current.categories };
  if (next.dayEnd <= next.dayStart) next.dayEnd = Math.min(24, next.dayStart + 1);
  if (redis) await redis.set(SETTINGS_KEY, next);
  else mem.settings = next;
  return next;
}

export async function logChange(entry: Omit<CalLogEntry, "at">) {
  const e = { at: Date.now(), ...entry };
  if (redis) {
    const p = redis.pipeline();
    p.lpush(LOG_KEY, e);
    p.ltrim(LOG_KEY, 0, LOG_KEEP - 1);
    await p.exec();
  } else {
    mem.log.unshift(e);
    mem.log.length = Math.min(mem.log.length, LOG_KEEP);
  }
}

export async function getLog(opts: { since?: number; limit?: number } = {}): Promise<CalLogEntry[]> {
  const all = redis ? ((await redis.lrange<CalLogEntry>(LOG_KEY, 0, LOG_KEEP - 1)) ?? []) : mem.log;
  return all.filter((e) => !opts.since || e.at > opts.since).slice(0, opts.limit ?? LOG_KEEP);
}

/* ------------------------------------------------------------------ */
/* Lettura                                                             */
/* ------------------------------------------------------------------ */

export const allEvents = () => list<CalEvent>(COL);
export const getEvent = (id: string) => get<CalEvent>(COL, id);

export async function eventsBetween(from: string, to: string) {
  const all = await allEvents();
  return { events: relevant(all, from, to), backlog: all.filter((e) => !e.start).sort((a, b) => a.createdAt - b.createdAt) };
}

export async function occurrencesBetween(from: string, to: string): Promise<Occurrence[]> {
  return expand(await allEvents(), from, to);
}

/* ------------------------------------------------------------------ */
/* Input (uguale per te e per gli agent)                               */
/* ------------------------------------------------------------------ */

const when = z.string().trim().max(40);
const repeatInput = z.object({
  freq: z.enum(["daily", "weekly", "monthly"]),
  interval: z.number().int().min(1).max(12).optional(),
  days: z.array(z.number().int().min(1).max(7)).max(7).optional(),
  until: when.optional(),
});

export const eventInput = z.object({
  /** In alternativa ai campi: una frase in italiano ("palestra domani 18-19:30 #sport"). */
  text: z.string().trim().max(500).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  start: when.optional(),
  end: when.optional(),
  minutes: z.number().int().min(5).max(24 * 60).optional(),
  allDay: z.boolean().optional(),
  due: when.optional(),
  category: z.string().trim().max(40).optional(),
  place: z.string().trim().max(200).optional(),
  notes: z.string().max(4000).optional(),
  done: z.boolean().optional(),
  repeat: repeatInput.nullable().optional(),
  ref: z.string().trim().max(120).optional(),
});
export type EventInput = z.infer<typeof eventInput>;

export const patchInput = eventInput.omit({ text: true }).extend({
  /** Per gli eventi che si ripetono: quale giorno stai toccando. */
  occurrence: when.optional(),
  /** "this" (default se c'è occurrence) = solo quel giorno; "all" = tutta la serie. */
  scope: z.enum(["this", "all"]).optional(),
  /** true = togli dal calendario e rimetti tra le cose da pianificare. */
  unschedule: z.boolean().optional(),
});
export type PatchInput = z.infer<typeof patchInput>;

type Result<T> = { ok: true; value: T } | { ok: false; error: string; status?: number };
const fail = (error: string, status = 400) => ({ ok: false as const, error, status });

/** Categoria per id o nome; se non esiste la crea (un colore della palette), finché c'è posto. */
async function resolveCategory(value: string | undefined, settings: CalSettings): Promise<string | undefined> {
  if (!value) return undefined;
  const found = findCategory(settings.categories, value);
  if (found) return found.id;
  if (settings.categories.length >= MAX_CATEGORIES) return undefined;
  const name = value.replace(/^#/, "").trim().slice(0, 30);
  const cat: Category = { id: slugify(name) || crypto.randomUUID().slice(0, 8), name: name[0].toUpperCase() + name.slice(1), color: PALETTE[settings.categories.length % PALETTE.length] };
  settings.categories = [...settings.categories, cat];
  await saveSettings({ categories: settings.categories });
  return cat.id;
}

type Timing = Pick<CalEvent, "start" | "end" | "allDay" | "minutes">;

/** Mette in ordine start/end/allDay da quello che arriva (anche "18:30" come fine, ISO con fuso, ecc.). */
function resolveTiming(input: { start?: string; end?: string; minutes?: number; allDay?: boolean }): Result<Timing> {
  if (!input.start) return { ok: true, value: { minutes: input.minutes } };
  const start = normalizeWhen(input.start, tz());
  if (!start) return fail(`start non valido: "${input.start}". Usa "AAAA-MM-GG" o "AAAA-MM-GGTHH:MM" (ora di Roma).`);
  const allDay = input.allDay ?? isDay(start);
  if (allDay) {
    const first = dayOf(start);
    const last = input.end ? normalizeWhen(input.end, tz()) : first;
    if (!last) return fail(`end non valido: "${input.end}".`);
    const lastDay = dayOf(last) < first ? first : dayOf(last);
    if (diffDays(first, lastDay) > 60) return fail("Un evento di tutto il giorno può durare al massimo 60 giorni.");
    return { ok: true, value: { start: first, end: lastDay, allDay: true } };
  }
  const s = isDay(start) ? `${start}T09:00` : start;
  let end: string | null;
  if (input.end && /^\d{1,2}[:.]\d{2}$/.test(input.end.trim())) {
    // Solo l'ora di fine: stesso giorno (o il giorno dopo se è prima dell'inizio).
    const [h, m] = input.end.trim().split(/[:.]/).map(Number);
    end = addMinutes(`${dayOf(s)}T00:00`, h * 60 + m);
    if (end <= s) end = addMinutes(end, 1440);
  } else end = input.end ? normalizeWhen(input.end, tz()) : addMinutes(s, input.minutes ?? 60);
  if (!end) return fail(`end non valido: "${input.end}".`);
  if (isDay(end)) end = `${end}T${s.slice(11)}`;
  if (end <= s) {
    // "dalle 23 alle 01" con lo stesso giorno: si intende la notte.
    if (dayOf(end) === dayOf(s)) end = addMinutes(end, 1440);
    if (end <= s) return fail("end deve venire dopo start.");
  }
  if (diffMinutes(s, end) > 7 * 1440) return fail("Un evento a orario può durare al massimo 7 giorni.");
  return { ok: true, value: { start: s, end, allDay: false } };
}

function resolveRepeat(r: EventInput["repeat"], start: string | undefined): Result<CalEvent["repeat"]> {
  if (!r || !start) return { ok: true, value: undefined };
  const until = r.until ? normalizeWhen(r.until, tz()) : undefined;
  if (r.until && !until) return fail(`repeat.until non valido: "${r.until}".`);
  const days = r.days?.length ? [...new Set(r.days)].sort() : undefined;
  return { ok: true, value: { freq: r.freq, ...(r.interval && r.interval > 1 ? { interval: r.interval } : {}), ...(days ? { days } : {}), ...(until ? { until: dayOf(until) } : {}) } };
}

/** Testo libero → campi, con le categorie attuali. */
function fromText(text: string, settings: CalSettings) {
  const parsed = parseQuick(text, now(), settings.categories);
  return { parsed, fields: parsedToFields(parsed) };
}

/* ------------------------------------------------------------------ */
/* Scrittura                                                           */
/* ------------------------------------------------------------------ */

export type Conflict = { id: string; title: string; when: string };

async function conflictsFor(e: CalEvent): Promise<Conflict[]> {
  if (!e.start || e.allDay || !e.end) return [];
  const occs = expand(await allEvents(), dayOf(e.start), dayOf(e.end));
  return overlaps(occs, e.start, e.end, e.id).map((o) => ({ id: o.id, title: o.title, when: whenLabel(o) }));
}

export async function createEvent(raw: EventInput, by: string): Promise<Result<{ event: CalEvent; conflicts: Conflict[]; updated: boolean; understood?: string[] }>> {
  const settings = await getSettings();
  let input: EventInput = raw;
  let understood: string[] | undefined;
  if (raw.text && !raw.title) {
    const { parsed, fields } = fromText(raw.text, settings);
    if (!fields.title) return fail(`Non ho capito il titolo in "${raw.text}".`);
    input = { ...fields, ...stripUndefined({ ...raw, text: undefined }), repeat: raw.repeat ?? fields.repeat };
    understood = parsed.understood;
  }
  if (!input.title) return fail("Serve un titolo (title) oppure una frase (text).");

  const timing = resolveTiming(input);
  if (!timing.ok) return timing;
  const repeat = resolveRepeat(input.repeat, timing.value.start);
  if (!repeat.ok) return repeat;
  const category = await resolveCategory(input.category, settings);
  const due = input.due ? normalizeWhen(input.due, tz()) : undefined;

  // Stesso ref dallo stesso autore: aggiorna invece di duplicare (gli agent possono riprovare senza paura).
  const existing = input.ref ? (await allEvents()).find((e) => e.ref === input.ref && e.by === by) : undefined;
  const nowMs = Date.now();
  const event: CalEvent = stripUndefined({
    id: existing?.id ?? crypto.randomUUID(),
    createdAt: existing?.createdAt ?? nowMs,
    updatedAt: nowMs,
    title: input.title,
    ...timing.value,
    due: due ? dayOf(due) : undefined,
    category,
    place: input.place || undefined,
    notes: input.notes || undefined,
    done: input.done || undefined,
    repeat: repeat.value,
    by,
    ref: input.ref,
  });
  await put(COL, event);
  await logChange({ by, action: existing ? "modificato" : event.start ? "aggiunto" : "da pianificare", title: event.title, id: event.id, when: whenLabel(event) });
  return { ok: true, value: { event, conflicts: await conflictsFor(event), updated: !!existing, understood } };
}

export async function updateEvent(id: string, patch: PatchInput, by: string): Promise<Result<{ event: CalEvent; detached?: boolean; conflicts: Conflict[] }>> {
  const current = await getEvent(id);
  if (!current) return fail("Evento non trovato.", 404);
  const settings = await getSettings();
  const nowMs = Date.now();
  const occ = patch.occurrence ? normalizeWhen(patch.occurrence, tz()) : null;
  const occDay = occ ? dayOf(occ) : null;
  const fields = stripUndefined({ ...patch, occurrence: undefined, scope: undefined, unschedule: undefined });

  // Occorrenza di una serie: "fatto" si segna solo su quel giorno.
  if (current.repeat && occDay && Object.keys(fields).length === 1 && fields.done !== undefined) {
    const doneDates = new Set(current.doneDates ?? []);
    if (fields.done) doneDates.add(occDay);
    else doneDates.delete(occDay);
    const event = { ...current, doneDates: [...doneDates].sort(), updatedAt: nowMs };
    await put(COL, event);
    await logChange({ by, action: fields.done ? "fatto" : "non fatto", title: current.title, id, when: occDay });
    return { ok: true, value: { event, conflicts: [] } };
  }

  // Solo questo giorno di una serie: la serie salta quel giorno e nasce un evento a parte.
  if (current.repeat && occDay && patch.scope !== "all") {
    const series = { ...current, exdates: [...new Set([...(current.exdates ?? []), occDay])].sort(), updatedAt: nowMs };
    const occStart = current.allDay ? occDay : `${occDay}${current.start!.slice(10)}`;
    const length = current.allDay ? diffDays(current.start!, current.end ?? current.start!) : diffMinutes(current.start!, current.end ?? current.start!);
    const occEnd = current.allDay ? addDays(occDay, length) : addMinutes(occStart, length);
    const base: EventInput = {
      title: current.title,
      start: occStart,
      end: occEnd,
      allDay: current.allDay,
      category: current.category,
      place: current.place,
      notes: current.notes,
      done: (current.doneDates ?? []).includes(occDay) || undefined,
    };
    if (patch.unschedule) {
      await put(COL, series);
      const created = await createEvent({ ...base, ...fields, start: undefined, end: undefined, allDay: undefined, minutes: current.allDay ? undefined : length, repeat: undefined }, current.by);
      if (!created.ok) return created;
      return { ok: true, value: { event: created.value.event, detached: true, conflicts: [] } };
    }
    const merged: EventInput = { ...base, ...fields, repeat: undefined };
    if (fields.start && !fields.end) {
      // Spostato senza dire la fine: la durata resta quella di prima.
      const s = normalizeWhen(fields.start, tz());
      if (s && isDay(s)) merged.end = addDays(s, current.allDay ? length : 0);
      else if (s) merged.end = addMinutes(s, current.allDay ? 60 : (fields.minutes ?? length));
      if (s) merged.allDay = isDay(s);
    }
    await put(COL, series);
    const created = await createEvent(merged, current.by);
    if (!created.ok) {
      await put(COL, current); // niente buchi nella serie se l'evento nuovo non è valido
      return created;
    }
    await logChange({ by, action: "modificato (solo un giorno)", title: current.title, id, when: occDay });
    return { ok: true, value: { event: created.value.event, detached: true, conflicts: created.value.conflicts } };
  }

  // Togli dal calendario → da pianificare.
  if (patch.unschedule) {
    const minutes = current.start && !current.allDay ? diffMinutes(current.start, current.end ?? current.start) : current.minutes;
    const event: CalEvent = stripUndefined({ ...current, ...fields, start: undefined, end: undefined, allDay: undefined, repeat: undefined, exdates: undefined, doneDates: undefined, minutes, updatedAt: nowMs });
    await put(COL, event);
    await logChange({ by, action: "tolto dal calendario", title: event.title, id });
    return { ok: true, value: { event, conflicts: [] } };
  }

  // Modifica normale (o tutta la serie).
  let start = fields.start ?? current.start;
  let end = fields.end ?? (fields.start && current.start && current.end && !fields.allDay ? undefined : current.end);
  let minutes = fields.minutes;
  if (fields.start && !fields.end && current.start && current.end) {
    // Spostato senza dire la fine: la durata resta quella di prima.
    const s = normalizeWhen(fields.start, tz());
    const wasAllDay = !!current.allDay;
    if (s && isDay(s) === wasAllDay) {
      if (wasAllDay) end = addDays(dayOf(s), diffDays(current.start, current.end));
      else minutes = minutes ?? diffMinutes(current.start, current.end);
    }
  }
  if (current.repeat && occDay && patch.scope === "all" && fields.start) {
    // Trascinata un'occorrenza "per tutta la serie": la serie si sposta della stessa quantità.
    const s = normalizeWhen(fields.start, tz());
    const occStart = current.allDay ? occDay : `${occDay}${current.start!.slice(10)}`;
    if (s) {
      const delta = toMs(s) - toMs(occStart);
      const len = current.allDay ? diffDays(current.start!, current.end!) : diffMinutes(current.start!, current.end!);
      const newLen = fields.end ? (current.allDay ? diffDays(s, normalizeWhen(fields.end, tz()) ?? s) : diffMinutes(s, normalizeWhen(fields.end, tz()) ?? s)) : len;
      start = current.allDay ? addDays(current.start!, Math.round(delta / 86_400_000)) : addMinutes(current.start!, Math.round(delta / 60_000));
      end = current.allDay ? addDays(start, newLen) : addMinutes(start, newLen);
      minutes = undefined;
    }
  }
  const timing = resolveTiming({ start, end, minutes: minutes ?? current.minutes, allDay: fields.allDay ?? (fields.start ? undefined : current.allDay) });
  if (!timing.ok) return timing;
  const repeat = patch.repeat === null ? { ok: true as const, value: undefined } : resolveRepeat(patch.repeat ?? current.repeat, timing.value.start);
  if (!repeat.ok) return repeat;
  const category = fields.category !== undefined ? await resolveCategory(fields.category, settings) : current.category;
  const due = fields.due !== undefined ? (fields.due ? normalizeWhen(fields.due, tz()) : null) : current.due;

  const event: CalEvent = stripUndefined({
    ...current,
    ...fields,
    ...timing.value,
    minutes: timing.value.start ? undefined : timing.value.minutes,
    category: fields.category === "" ? undefined : category,
    due: due ? dayOf(due) : undefined,
    repeat: repeat.value,
    exdates: repeat.value ? current.exdates : undefined,
    doneDates: repeat.value ? current.doneDates : undefined,
    place: (fields.place ?? current.place) || undefined,
    notes: (fields.notes ?? current.notes) || undefined,
    done: (fields.done ?? current.done) || undefined,
    updatedAt: nowMs,
  });
  await put(COL, event);
  await logChange({ by, action: "modificato", title: event.title, id, when: whenLabel(event) });
  return { ok: true, value: { event, conflicts: await conflictsFor(event) } };
}

export async function deleteEvent(id: string, by: string, occurrence?: string | null): Promise<Result<{ deleted: "event" | "occurrence" }>> {
  const current = await getEvent(id);
  if (!current) return fail("Evento non trovato.", 404);
  const occ = occurrence ? normalizeWhen(occurrence, tz()) : null;
  if (current.repeat && occ) {
    const exdates = [...new Set([...(current.exdates ?? []), dayOf(occ)])].sort();
    await put(COL, { ...current, exdates, updatedAt: Date.now() });
    await logChange({ by, action: "eliminato (solo un giorno)", title: current.title, id, when: dayOf(occ) });
    return { ok: true, value: { deleted: "occurrence" } };
  }
  await remove(COL, [id]);
  await logChange({ by, action: "eliminato", title: current.title, id, when: whenLabel(current) });
  return { ok: true, value: { deleted: "event" } };
}

/** Ripristina un evento così com'era (per "Annulla" dopo un'eliminazione o uno spostamento). */
export async function restoreEvent(event: CalEvent, by: string) {
  const restored = { ...event, updatedAt: Date.now() };
  await put(COL, restored);
  await logChange({ by, action: "ripristinato", title: event.title, id: event.id });
  return restored;
}

/** Copia gli eventi singoli a orario di una settimana su un'altra (per costruire la routine a partire da una settimana riuscita). */
export async function copyWeek(fromMonday: string, toMonday: string, by: string) {
  const shift = diffDays(fromMonday, toMonday);
  const sources = (await allEvents()).filter((e) => e.start && !e.repeat && dayOf(e.start) >= fromMonday && dayOf(e.start) <= addDays(fromMonday, 6));
  const nowMs = Date.now();
  const copies: CalEvent[] = sources.map((e) =>
    stripUndefined({
      ...e,
      id: crypto.randomUUID(),
      createdAt: nowMs,
      updatedAt: nowMs,
      start: e.allDay ? addDays(e.start!, shift) : addMinutes(e.start!, shift * 1440),
      end: e.end ? (e.allDay ? addDays(e.end, shift) : addMinutes(e.end, shift * 1440)) : undefined,
      done: undefined,
      ref: undefined,
      by,
    }),
  );
  for (const c of copies) await put(COL, c);
  if (copies.length) await logChange({ by, action: `copiata la settimana (${copies.length} eventi)`, title: `settimana del ${toMonday}` });
  return copies;
}

/* ------------------------------------------------------------------ */
/* Richieste al gestore                                                */
/* ------------------------------------------------------------------ */

export const requestInput = z.object({
  action: z.enum(["create", "update", "delete", "other"]).optional(),
  text: z.string().trim().max(2000).optional(),
  target: z.string().trim().max(80).optional(),
  occurrence: when.optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export async function listRequests(status?: CalRequest["status"]) {
  const all = await list<CalRequest>(REQ_COL);
  return status ? all.filter((r) => r.status === status) : all;
}

export async function createRequest(input: z.infer<typeof requestInput>, by: string): Promise<CalRequest> {
  const nowMs = Date.now();
  const req: CalRequest = stripUndefined({
    id: crypto.randomUUID(),
    createdAt: nowMs,
    updatedAt: nowMs,
    by,
    // Senza action: con target è una modifica, con payload un'aggiunta; solo testo = richiesta libera (decide il gestore).
    action: input.action ?? (input.target ? "update" : input.payload ? "create" : "other"),
    text: input.text,
    target: input.target,
    occurrence: input.occurrence,
    payload: input.payload,
    status: "pending" as const,
  });
  await put(REQ_COL, req);
  await logChange({ by, action: "richiesta", title: input.text ?? (input.payload?.title as string | undefined) ?? req.action });
  // Tieni solo le ultime 200 richieste decise.
  const decided = (await listRequests()).filter((r) => r.status !== "pending").slice(200);
  if (decided.length) await remove(REQ_COL, decided.map((r) => r.id));
  return req;
}

/** Applica una richiesta (quando la approvi tu, o il gestore con apply:true). */
export async function applyRequest(req: CalRequest): Promise<Result<{ result?: string }>> {
  const payload = (req.payload ?? {}) as Record<string, unknown>;
  if (req.action === "create" && Array.isArray(payload.events)) {
    const ids: string[] = [];
    for (const item of payload.events) {
      const one = eventInput.safeParse(item);
      if (!one.success) continue;
      const r = await createEvent(one.data, req.by);
      if (r.ok) ids.push(r.value.event.id);
    }
    return ids.length ? { ok: true, value: { result: ids.join(",") } } : fail("Nessun evento valido nella richiesta.");
  }
  if (req.action === "create") {
    const parsed = eventInput.safeParse(Object.keys(payload).length ? payload : { text: req.text });
    if (!parsed.success) return fail("Richiesta non applicabile in automatico: falla a mano.");
    const r = await createEvent(parsed.data, req.by);
    return r.ok ? { ok: true, value: { result: r.value.event.id } } : r;
  }
  if (req.action === "update" && req.target) {
    const parsed = patchInput.safeParse({ ...payload, occurrence: req.occurrence ?? payload.occurrence });
    if (!parsed.success || !Object.keys(payload).length) return fail("Richiesta di modifica senza campi: falla a mano.");
    const r = await updateEvent(req.target, parsed.data, req.by);
    return r.ok ? { ok: true, value: { result: r.value.event.id } } : r;
  }
  if (req.action === "delete" && req.target) {
    const r = await deleteEvent(req.target, req.by, req.occurrence);
    return r.ok ? { ok: true, value: { result: req.target } } : r;
  }
  return { ok: true, value: {} };
}

export async function decideRequest(
  id: string,
  decision: { status: "approved" | "rejected"; note?: string; apply?: boolean; result?: string },
  by: string,
): Promise<Result<CalRequest>> {
  const req = await get<CalRequest>(REQ_COL, id);
  if (!req) return fail("Richiesta non trovata.", 404);
  if (req.status !== "pending") return fail(`Richiesta già ${req.status === "approved" ? "approvata" : "rifiutata"}.`, 409);
  let result = decision.result;
  if (decision.status === "approved" && decision.apply) {
    const applied = await applyRequest(req);
    if (!applied.ok) return applied;
    result = applied.value.result ?? result;
  }
  const next: CalRequest = stripUndefined({ ...req, status: decision.status, note: decision.note, decidedBy: by, result, updatedAt: Date.now() });
  await put(REQ_COL, next);
  await logChange({ by, action: decision.status === "approved" ? "richiesta approvata" : "richiesta rifiutata", title: req.text ?? (req.payload?.title as string | undefined) ?? req.action });
  return { ok: true, value: next };
}

/* ------------------------------------------------------------------ */

/** Spazi liberi di un giorno dentro la fascia utile (oggi: solo da adesso in avanti). */
export function freeSlotsFor(occs: Occurrence[], day: string, settings: CalSettings, minutes: number, fromMin?: number, toMin?: number) {
  const n = now();
  return freeSlots(occs, day, {
    minutes,
    fromMin: fromMin ?? settings.dayStart * 60,
    toMin: toMin ?? settings.dayEnd * 60,
    notBefore: dayOf(n) === day ? n : undefined,
  });
}

function stripUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}
