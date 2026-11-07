// Calendario: tipi e funzioni pure, usate dal browser, dal server e quindi anche dagli agent.
//
// Le date sono "ora da parete" nel fuso di Branko (Europe/Rome), scritte come stringhe:
//   giorno   "2026-11-08"          orario   "2026-11-08T18:30"
// I calcoli si fanno in millisecondi su un calendario "finto UTC": niente fusi, quindi l'ora
// legale non sposta mai un evento.

export const CAL_TZ = "Europe/Rome";

/* ------------------------------------------------------------------ */
/* Tipi                                                                */
/* ------------------------------------------------------------------ */

/** Ripetizione. days: 1 = lunedì … 7 = domenica. until: ultimo giorno incluso. */
export type Repeat = { freq: "daily" | "weekly" | "monthly"; interval?: number; days?: number[]; until?: string };

export type CalEvent = {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  /** Senza start è una cosa "da pianificare" (sta nella colonna a lato, non nella griglia). */
  start?: string;
  /** Orario: fine esclusa. Tutto il giorno: ultimo giorno incluso. */
  end?: string;
  allDay?: boolean;
  /** Durata prevista per le cose da pianificare. */
  minutes?: number;
  /** Da pianificare entro questo giorno. */
  due?: string;
  category?: string;
  place?: string;
  notes?: string;
  done?: boolean;
  repeat?: Repeat;
  /** Giorni saltati di un evento che si ripete. */
  exdates?: string[];
  /** Giorni segnati come fatti di un evento che si ripete. */
  doneDates?: string[];
  /** Chi l'ha creato: "tu" o l'id di un agent. */
  by: string;
  /** Id esterno scelto da un agent: con lo stesso ref si aggiorna invece di duplicare. */
  ref?: string;
};

/** Un evento piazzato in un giorno preciso (gli eventi che si ripetono diventano più occorrenze). */
export type Occurrence = CalEvent & {
  start: string;
  end: string;
  /** Chiave unica dell'occorrenza: id@giorno. */
  key: string;
  /** Giorno dell'occorrenza, solo per gli eventi che si ripetono. */
  occ?: string;
  isDone: boolean;
};

export type Category = { id: string; name: string; color: string };

export type CalSettings = {
  categories: Category[];
  /** Agent che gestisce il calendario: se c'è, le modifiche degli altri agent passano da lui. */
  manager: string | null;
  /** Cosa deve sapere chi organizza il tuo tempo (abitudini, preferenze, vincoli). */
  prefs: string;
  /** Fascia "utile" della giornata, in ore: la griglia parte da qui e gli spazi liberi si cercano qui dentro. */
  dayStart: number;
  dayEnd: number;
};

export type CalRequest = {
  id: string;
  createdAt: number;
  updatedAt: number;
  by: string;
  action: "create" | "update" | "delete" | "other";
  /** Richiesta a parole ("sposta la palestra a domani"). */
  text?: string;
  /** Richiesta già strutturata (gli stessi campi delle API). */
  payload?: Record<string, unknown>;
  target?: string;
  occurrence?: string;
  status: "pending" | "approved" | "rejected";
  note?: string;
  decidedBy?: string;
  /** Id dell'evento creato/modificato quando la richiesta è stata applicata. */
  result?: string;
};

export type CalLogEntry = { at: number; by: string; action: string; title: string; id?: string; when?: string };

/* ------------------------------------------------------------------ */
/* Categorie                                                           */
/* ------------------------------------------------------------------ */

/** Colori validati per il fondo scuro + argento neutro. */
export const PALETTE = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9a9a9a"] as const;

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "focus", name: "Focus", color: "#3987e5" },
  { id: "dropshipping", name: "Dropshipping", color: "#d95926" },
  { id: "sport", name: "Sport", color: "#199e70" },
  { id: "studio", name: "Studio", color: "#c98500" },
  { id: "personale", name: "Personale", color: "#d55181" },
  { id: "riposo", name: "Riposo", color: "#9a9a9a" },
];

export const DEFAULT_SETTINGS: CalSettings = { categories: DEFAULT_CATEGORIES, manager: null, prefs: "", dayStart: 7, dayEnd: 23 };

export const MAX_CATEGORIES = 14;
export const NEUTRAL = "#8a8a8a";

/** "Palestra" → "palestra", "Città" → "citta": per confrontare nomi scritti a mano. */
export const fold = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export const slugify = (s: string) =>
  fold(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);

/** Trova una categoria per id o per nome (anche solo l'inizio: "drop" → Dropshipping). */
export function findCategory(categories: Category[], value: string | undefined): Category | undefined {
  if (!value) return undefined;
  const v = fold(value.replace(/^#/, ""));
  if (!v) return undefined;
  return (
    categories.find((c) => c.id === v || fold(c.name) === v) ??
    categories.find((c) => fold(c.name).startsWith(v) || c.id.startsWith(v))
  );
}

export const colorOf = (categories: Category[], id: string | undefined) => categories.find((c) => c.id === id)?.color ?? NEUTRAL;

/* ------------------------------------------------------------------ */
/* Date "da parete"                                                    */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");

export const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const isDateTime = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s);

/** "2026-11-08" o "2026-11-08T18:30" → millisecondi (finto UTC). */
export function toMs(s: string): number {
  const [y, m, d] = [+s.slice(0, 4), +s.slice(5, 7), +s.slice(8, 10)];
  const h = s.length > 10 ? +s.slice(11, 13) : 0;
  const min = s.length > 10 ? +s.slice(14, 16) : 0;
  return Date.UTC(y, m - 1, d, h, min);
}

export function fromMs(ms: number, withTime = true): string {
  const d = new Date(ms);
  const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return withTime ? `${day}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : day;
}

export const dayOf = (s: string) => s.slice(0, 10);
/** Minuti dalla mezzanotte. */
export const minuteOf = (s: string) => (s.length > 10 ? +s.slice(11, 13) * 60 + +s.slice(14, 16) : 0);
export const at = (day: string, minutes: number) => fromMs(toMs(day) + minutes * 60_000);
export const hhmm = (minutes: number) => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;

export const addDays = (day: string, n: number) => fromMs(toMs(day) + n * DAY_MS, false);
export const addMinutes = (dt: string, n: number) => fromMs(toMs(dt) + n * 60_000);
export const diffDays = (a: string, b: string) => Math.round((toMs(dayOf(b)) - toMs(dayOf(a))) / DAY_MS);
export const diffMinutes = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / 60_000);

/** 1 = lunedì … 7 = domenica. */
export function weekday(day: string) {
  const w = new Date(toMs(day)).getUTCDay();
  return w === 0 ? 7 : w;
}
export const startOfWeek = (day: string) => addDays(day, 1 - weekday(day));
export const startOfMonth = (day: string) => `${day.slice(0, 7)}-01`;
export function addMonths(day: string, n: number) {
  const d = new Date(toMs(startOfMonth(day)));
  d.setUTCMonth(d.getUTCMonth() + n);
  return fromMs(d.getTime(), false);
}
export function daysInMonth(day: string) {
  const d = new Date(toMs(startOfMonth(day)));
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}
export const range = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));

/** Ora attuale "da parete" nel fuso indicato (sul server) o del browser (se tz è omesso). */
export function wallNow(tz?: string, now = Date.now()): string {
  if (!tz) {
    const d = new Date(now);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/**
 * Accetta quello che un agent potrebbe mandare e lo porta all'ora da parete di Roma:
 * "2026-11-08", "2026-11-08 18:30", "2026-11-08T18:30:00", "2026-11-08T17:30:00Z", "…+01:00".
 */
export function normalizeWhen(value: string, tz = CAL_TZ): string | null {
  const s = value.trim().replace(" ", "T");
  if (isDay(s)) return s;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(s);
  if (!m) return null;
  const [, day, h, min, zone] = m;
  if (+h > 24 || +min > 59) return null;
  if (!zone) return +h === 24 ? at(day, 24 * 60) : `${day}T${pad(+h)}:${min}`;
  const ms = Date.parse(`${day}T${pad(+h)}:${min}:00${zone.length === 5 ? `${zone.slice(0, 3)}:${zone.slice(3)}` : zone}`);
  return Number.isNaN(ms) ? null : wallNow(tz, ms);
}

/* ------------------------------------------------------------------ */
/* Nomi in italiano                                                    */
/* ------------------------------------------------------------------ */

export const WEEKDAYS = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];
export const WEEKDAYS_SHORT = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];
export const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
export const MONTHS_SHORT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

/** "sab 8 nov" */
export function dayLabel(day: string, long = false) {
  const wd = weekday(day) - 1;
  const month = +day.slice(5, 7) - 1;
  return long ? `${WEEKDAYS[wd]} ${+day.slice(8, 10)} ${MONTHS[month]}` : `${WEEKDAYS_SHORT[wd]} ${+day.slice(8, 10)} ${MONTHS_SHORT[month]}`;
}

export function durationLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}

export function repeatLabel(r: Repeat | undefined) {
  if (!r) return "";
  const every = r.interval && r.interval > 1 ? r.interval : 1;
  let base: string;
  if (r.freq === "daily") base = every > 1 ? `ogni ${every} giorni` : "ogni giorno";
  else if (r.freq === "monthly") base = every > 1 ? `ogni ${every} mesi` : "ogni mese";
  else {
    const days = [...(r.days ?? [])].sort();
    const names =
      days.join() === "1,2,3,4,5" ? "nei giorni feriali" : days.join() === "6,7" ? "nel weekend" : days.length ? `ogni ${days.map((d) => WEEKDAYS_SHORT[d - 1]).join(", ")}` : "ogni settimana";
    base = every > 1 ? `${names} (ogni ${every} settimane)` : names;
  }
  return r.until ? `${base} fino al ${dayLabel(r.until)}` : base;
}

/** Quando, in parole: "sab 8 nov 18:00–19:30", "dom 9 nov · tutto il giorno". */
export function whenLabel(e: { start?: string; end?: string; allDay?: boolean }) {
  if (!e.start) return "da pianificare";
  if (e.allDay) {
    const last = e.end && e.end !== e.start ? ` → ${dayLabel(e.end)}` : "";
    return `${dayLabel(dayOf(e.start))}${last} · tutto il giorno`;
  }
  const end = e.end ?? e.start;
  const sameDay = dayOf(end) === dayOf(e.start) || (minuteOf(end) === 0 && diffDays(e.start, end) === 1);
  return sameDay
    ? `${dayLabel(dayOf(e.start))} ${e.start.slice(11)}–${end.slice(11)}`
    : `${dayLabel(dayOf(e.start))} ${e.start.slice(11)} → ${dayLabel(dayOf(end))} ${end.slice(11)}`;
}

/* ------------------------------------------------------------------ */
/* Occorrenze                                                          */
/* ------------------------------------------------------------------ */

/** Durata in minuti (orari) o in giorni-1 (tutto il giorno). */
function span(e: CalEvent) {
  if (!e.start) return 0;
  if (e.allDay) return Math.max(0, diffDays(e.start, e.end ?? e.start));
  return Math.max(5, diffMinutes(e.start, e.end ?? addMinutes(e.start, 60)));
}

function occurrence(e: CalEvent, start: string, occ?: string): Occurrence {
  const s = span(e);
  const end = e.allDay ? addDays(start, s) : addMinutes(start, s);
  return { ...e, start, end, key: `${e.id}@${dayOf(start)}`, occ, isDone: occ ? (e.doneDates ?? []).includes(occ) : !!e.done };
}

/** [inizio, fine) in millisecondi, per vedere se un'occorrenza tocca un intervallo. */
export function bounds(o: { start: string; end: string; allDay?: boolean }): [number, number] {
  return o.allDay ? [toMs(dayOf(o.start)), toMs(dayOf(o.end)) + DAY_MS] : [toMs(o.start), toMs(o.end)];
}

function matches(r: Repeat, first: string, day: string) {
  const every = Math.max(1, r.interval ?? 1);
  const d = diffDays(first, day);
  if (d < 0) return false;
  if (r.freq === "daily") return d % every === 0;
  if (r.freq === "weekly") {
    const days = r.days?.length ? r.days : [weekday(first)];
    if (!days.includes(weekday(day))) return false;
    return (diffDays(startOfWeek(first), startOfWeek(day)) / 7) % every === 0;
  }
  if (day.slice(8) !== first.slice(8)) return false;
  const months = (+day.slice(0, 4) - +first.slice(0, 4)) * 12 + (+day.slice(5, 7) - +first.slice(5, 7));
  return months % every === 0;
}

/** Tutte le occorrenze che toccano i giorni [from, to] (inclusi), ordinate per inizio. */
export function expand(events: CalEvent[], from: string, to: string): Occurrence[] {
  const lo = toMs(from);
  const hi = toMs(to) + DAY_MS;
  const out: Occurrence[] = [];
  for (const e of events) {
    if (!e.start) continue;
    if (!e.repeat) {
      const o = occurrence(e, e.start);
      const [s, en] = bounds(o);
      if (s < hi && en > lo) out.push(o);
      continue;
    }
    const first = dayOf(e.start);
    const time = e.allDay ? "" : e.start.slice(10);
    const reach = e.allDay ? span(e) : Math.ceil(span(e) / 1440);
    // Si parte qualche giorno prima di "from" per prendere le occorrenze lunghe che ci sbordano dentro.
    let day = diffDays(first, from) - reach > 0 ? addDays(from, -reach) : first;
    const last = e.repeat.until && e.repeat.until < to ? e.repeat.until : to;
    const skip = new Set(e.exdates ?? []);
    for (let guard = 0; day <= last && guard < 1500; guard++, day = addDays(day, 1)) {
      if (skip.has(day) || !matches(e.repeat, first, day)) continue;
      const o = occurrence(e, `${day}${time}`, day);
      const [s, en] = bounds(o);
      if (s < hi && en > lo) out.push(o);
    }
  }
  return out.sort((a, b) => toMs(a.start) - toMs(b.start) || (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0));
}

/** Eventi grezzi che possono avere occorrenze tra from e to (per non mandare al browser tutto lo storico). */
export function relevant(events: CalEvent[], from: string, to: string) {
  return events.filter((e) => {
    if (!e.start) return false;
    if (e.repeat) return dayOf(e.start) <= to && (!e.repeat.until || e.repeat.until >= addDays(from, -7));
    const [s, en] = bounds({ start: e.start, end: e.end ?? e.start, allDay: e.allDay });
    return s < toMs(to) + DAY_MS && en > toMs(from);
  });
}

/* ------------------------------------------------------------------ */
/* Spazi liberi e sovrapposizioni                                      */
/* ------------------------------------------------------------------ */

export type Slot = { start: string; end: string; minutes: number };

/** Buchi liberi di almeno `minutes` minuti in un giorno, tra fromMin e toMin. */
export function freeSlots(occs: Occurrence[], day: string, opts: { minutes: number; fromMin: number; toMin: number; notBefore?: string }): Slot[] {
  const dayStart = toMs(day);
  let lo = dayStart + opts.fromMin * 60_000;
  const hi = dayStart + opts.toMin * 60_000;
  if (opts.notBefore) {
    // Arrotonda al quarto d'ora successivo.
    const nb = Math.ceil(toMs(opts.notBefore) / 900_000) * 900_000;
    lo = Math.max(lo, nb);
  }
  const busy = occs
    .filter((o) => !o.allDay)
    .map(bounds)
    .filter(([s, e]) => s < hi && e > lo)
    .sort((a, b) => a[0] - b[0]);
  const slots: Slot[] = [];
  let cursor = lo;
  for (const [s, e] of [...busy, [hi, hi] as [number, number]]) {
    if (s - cursor >= opts.minutes * 60_000) slots.push({ start: fromMs(cursor), end: fromMs(s), minutes: Math.round((s - cursor) / 60_000) });
    cursor = Math.max(cursor, e);
  }
  return slots;
}

/** Occorrenze a orario che si sovrappongono a [start, end), escluso l'evento stesso. */
export function overlaps(occs: Occurrence[], start: string, end: string, exceptId?: string) {
  const [s, e] = [toMs(start), toMs(end)];
  return occs.filter((o) => !o.allDay && o.id !== exceptId && toMs(o.start) < e && toMs(o.end) > s);
}

/* ------------------------------------------------------------------ */
/* Impaginazione di un giorno (colonne affiancate se si sovrappongono) */
/* ------------------------------------------------------------------ */

export type Placed = { o: Occurrence; top: number; bottom: number; col: number; cols: number; clipTop: boolean; clipBottom: boolean };

/** top/bottom in minuti dalla mezzanotte del giorno; gli eventi che passano la mezzanotte vengono tagliati. */
export function layoutDay(occs: Occurrence[], day: string): Placed[] {
  const d0 = toMs(day);
  const items = occs
    .filter((o) => !o.allDay)
    .filter((o) => {
      // Solo gli eventi che toccano davvero questo giorno.
      const [s, e] = bounds(o);
      return s < d0 + DAY_MS && e > d0;
    })
    .map((o) => {
      const [s, e] = bounds(o);
      const top = Math.max(0, (s - d0) / 60_000);
      const bottom = Math.min(1440, (e - d0) / 60_000);
      return { o, top, bottom: Math.max(bottom, top + 10), col: 0, cols: 1, clipTop: s < d0, clipBottom: e > d0 + DAY_MS };
    })
    .sort((a, b) => a.top - b.top || b.bottom - a.bottom);

  // Gruppi di eventi che si toccano: dentro un gruppo ognuno prende la prima colonna libera.
  let group: Placed[] = [];
  let groupEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...group.map((p) => p.col + 1));
    group.forEach((p) => (p.cols = cols));
    group = [];
  };
  for (const p of items) {
    if (p.top >= groupEnd && group.length) flush();
    const ends: number[] = [];
    for (const q of group) ends[q.col] = Math.max(ends[q.col] ?? 0, q.bottom);
    let col = 0;
    while (ends[col] !== undefined && ends[col] > p.top) col++;
    p.col = col;
    group.push(p);
    groupEnd = Math.max(groupEnd, p.bottom);
  }
  if (group.length) flush();
  return items;
}

/** Minuti per categoria (solo eventi a orario) nell'intervallo, per "dove va il tuo tempo". */
export function timeByCategory(occs: Occurrence[], from: string, to: string) {
  const lo = toMs(from);
  const hi = toMs(to) + DAY_MS;
  const totals = new Map<string, { minutes: number; done: number; count: number }>();
  for (const o of occs) {
    if (o.allDay) continue;
    const [s, e] = bounds(o);
    const m = Math.max(0, (Math.min(e, hi) - Math.max(s, lo)) / 60_000);
    if (!m) continue;
    const k = o.category ?? "";
    const t = totals.get(k) ?? { minutes: 0, done: 0, count: 0 };
    t.minutes += m;
    t.count++;
    if (o.isDone) t.done += m;
    totals.set(k, t);
  }
  return [...totals.entries()].map(([category, t]) => ({ category, ...t })).sort((a, b) => b.minutes - a.minutes);
}
