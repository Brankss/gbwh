/* eslint-disable @typescript-eslint/no-unused-expressions -- catene "prova questo || altrimenti quello" volute */
// Scrittura veloce in italiano: "palestra domani 18-19:30 #sport" → evento.
// La usano la barra "Aggiungi al volo" e gli agent (campo `text`), così tutti parlano la stessa lingua.

import {
  MONTHS,
  MONTHS_SHORT,
  WEEKDAYS,
  WEEKDAYS_SHORT,
  addDays,
  addMinutes,
  at,
  dayOf,
  findCategory,
  fromMs,
  minuteOf,
  toMs,
  weekday,
  type Category,
  type Repeat,
} from "./calendar";

export type Parsed = {
  title: string;
  /** Giorno dell'evento (assente = da pianificare). */
  day?: string;
  /** Minuti dalla mezzanotte. */
  startMin?: number;
  endMin?: number;
  minutes?: number;
  allDay?: boolean;
  repeat?: Repeat;
  category?: string;
  /** Cosa è stato capito, per l'anteprima ("domani", "18:00–19:30", "#sport"…). */
  understood: string[];
};

const NUM: Record<string, number> = { un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10 };
const toNum = (s: string) => NUM[s.toLowerCase()] ?? Number(s.replace(",", "."));

// "lunedì|lunedi|lun" … in ordine dal più lungo, per non fermarsi a "lun" dentro "lunedì".
const WD_ALT = WEEKDAYS.flatMap((w, i) => [w, w.replace("ì", "i"), WEEKDAYS_SHORT[i]]).join("|");
const MONTH_ALT = [...MONTHS, ...MONTHS_SHORT].join("|");

function weekdayIndex(word: string) {
  const w = word.toLowerCase().replace("ì", "i");
  return WEEKDAYS_SHORT.findIndex((s) => w.startsWith(s)) + 1;
}
function monthIndex(word: string) {
  const w = word.toLowerCase();
  return MONTHS_SHORT.findIndex((s) => w.startsWith(s)) + 1;
}

/** Prossimo giorno (oggi incluso) con quel giorno della settimana. */
function nextWeekday(today: string, wd: number, strictlyAfter = false) {
  let d = (wd - weekday(today) + 7) % 7;
  if (d === 0 && strictlyAfter) d = 7;
  return addDays(today, d);
}

const H = String.raw`([01]?\d|2[0-4])(?:[:.]([0-5]\d))?`;
/** Fine parola che funziona anche dopo le lettere accentate (\b in JS non le conosce). */
const END = String.raw`(?=[\s,.;!?])`;

/** "2026-11-31" non esiste: scartato. */
const validDay = (d: string) => fromMs(toMs(d), false) === d;

export function parseQuick(input: string, now: string, categories: Category[] = []): Parsed {
  const today = dayOf(now);
  let s = ` ${input.replace(/\s+/g, " ")} `;
  const understood: string[] = [];
  const out: Omit<Parsed, "title" | "understood"> = {};
  let evening = false;
  let morning = false;
  let fromWeekday = false;

  /** Cerca un pezzo, lo usa e lo toglie dal titolo. */
  const take = (re: RegExp, apply: (m: RegExpExecArray) => string | void) => {
    const m = re.exec(s);
    if (!m) return false;
    const label = apply(m);
    if (label) understood.push(label);
    s = `${s.slice(0, m.index)} ${s.slice(m.index + m[0].length)}`;
    return true;
  };

  // Categoria: #sport, #drop…
  take(/\s#([\p{L}\d_-]+)/u, (m) => {
    const c = findCategory(categories, m[1]);
    if (c) {
      out.category = c.id;
      return `#${c.name}`;
    }
    out.category = m[1];
    return `#${m[1]}`;
  });

  if (take(/\s(?:tutto il giorno|tutta la giornata|giornata intera)\b/i, () => "tutto il giorno")) out.allDay = true;
  const backlog = take(/\s(?:da pianificare|prima o poi|quando (?:posso|riesco))\b/i, () => "da pianificare");

  /* ---------- Ripetizioni ---------- */
  take(/\sfino (?:al|a) (\d{1,2})(?:[/.](\d{1,2})| (\p{L}+))?/iu, (m) => {
    const month = m[2] ? +m[2] : m[3] ? monthIndex(m[3]) : +today.slice(5, 7);
    if (!month) return;
    let until = `${today.slice(0, 4)}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    if (until < today) until = `${+today.slice(0, 4) + 1}${until.slice(4)}`;
    out.repeat = { ...(out.repeat ?? { freq: "daily" }), until };
    return `fino al ${+until.slice(8)}/${+until.slice(5, 7)}`;
  });
  const until = out.repeat?.until;
  const withUntil = (r: Repeat): Repeat => (until ? { ...r, until } : r);
  out.repeat = undefined;

  take(/\s(?:ogni giorno|tutti i giorni|ogni di)\b/i, () => {
    out.repeat = withUntil({ freq: "daily" });
    return "ogni giorno";
  }) ||
    take(new RegExp(String.raw`\s(?:nei |i )?giorni feriali${END}|\s(?:dal )?luned[iì] al venerd[iì]${END}|\slun-ven${END}`, "i"), () => {
      out.repeat = withUntil({ freq: "weekly", days: [1, 2, 3, 4, 5] });
      return "giorni feriali";
    }) ||
    take(/\s(?:ogni|nel|nei) (?:weekend|fine settimana|fine-settimana)\b/i, () => {
      out.repeat = withUntil({ freq: "weekly", days: [6, 7] });
      return "weekend";
    }) ||
    take(new RegExp(String.raw`\sogni ((?:${WD_ALT})(?:\s*(?:,|e)\s*(?:${WD_ALT}))*)${END}`, "i"), (m) => {
      const days = [...new Set(m[1].split(/\s*(?:,|\be\b)\s*/i).map(weekdayIndex).filter(Boolean))].sort();
      out.repeat = withUntil({ freq: "weekly", days });
      return `ogni ${days.map((d) => WEEKDAYS_SHORT[d - 1]).join(", ")}`;
    }) ||
    take(/\sogni (\d+|due|tre|quattro) (giorni|settimane|mesi)\b/i, (m) => {
      const interval = toNum(m[1]);
      const freq = m[2].startsWith("g") ? "daily" : m[2].startsWith("s") ? "weekly" : "monthly";
      out.repeat = withUntil({ freq, interval });
      return `ogni ${interval} ${m[2]}`;
    }) ||
    take(/\s(?:ogni settimana|settimanale)\b/i, () => {
      out.repeat = withUntil({ freq: "weekly" });
      return "ogni settimana";
    }) ||
    take(/\s(?:ogni mese|mensile)\b/i, () => {
      out.repeat = withUntil({ freq: "monthly" });
      return "ogni mese";
    });

  /* ---------- Giorno ---------- */
  const setDay = (d: string, label: string) => {
    if (!validDay(d)) return undefined;
    out.day = d;
    return label;
  };
  take(/\s(\d{4}-\d{2}-\d{2})(?=\s)/, (m) => (validDay(m[1]) ? setDay(m[1], m[1]) : undefined)) ||
    take(/\s(stasera|stanotte)\b/i, (m) => {
    evening = true;
    return setDay(today, m[1].toLowerCase());
  }) ||
    take(/\s(stamattina|stamani)\b/i, (m) => {
      morning = true;
      return setDay(today, m[1].toLowerCase());
    }) ||
    take(/\sdopodomani\b/i, () => setDay(addDays(today, 2), "dopodomani")) ||
    take(/\s(domattina|domani mattina)\b/i, () => {
      morning = true;
      return setDay(addDays(today, 1), "domani mattina");
    }) ||
    take(/\sdomani sera\b/i, () => {
      evening = true;
      return setDay(addDays(today, 1), "domani sera");
    }) ||
    take(/\sdomani\b/i, () => setDay(addDays(today, 1), "domani")) ||
    take(/\soggi\b/i, () => setDay(today, "oggi")) ||
    take(/\s(?:tra|fra) (\d+|un|una|due|tre|quattro|cinque|sei|sette|dieci) (giorni|giorno|settimane|settimana)\b/i, (m) => {
      const n = toNum(m[1]) * (m[2].startsWith("sett") ? 7 : 1);
      return setDay(addDays(today, n), `tra ${n} giorni`);
    }) ||
    take(/\s(?:il |l')?(\d{1,2})[/](\d{1,2})(?:[/](\d{2,4}))?\b/i, (m) => {
      const year = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : +today.slice(0, 4);
      let d = `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      if (!m[3] && d < today) d = `${year + 1}${d.slice(4)}`;
      return setDay(d, `${+m[1]}/${+m[2]}`);
    }) ||
    take(new RegExp(String.raw`\s(?:(?:${WD_ALT}) )?(?:il |l')?(\d{1,2}) (${MONTH_ALT})${END}(?: (\d{4}))?`, "i"), (m) => {
      const month = monthIndex(m[2]);
      const year = m[3] ? +m[3] : +today.slice(0, 4);
      let d = `${year}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      if (!m[3] && d < today) d = `${year + 1}${d.slice(4)}`;
      return setDay(d, `${+m[1]} ${MONTHS_SHORT[month - 1]}`);
    }) ||
    // "martedì 10", "venerdì 13 alle 21": giorno della settimana + numero (non "lunedì 15-17", che è un orario).
    take(new RegExp(String.raw`\s(?:${WD_ALT}) (\d{1,2})(?=\s)(?!\s?[-–:.]\s?\d)`, "i"), (m) => {
      let d = `${today.slice(0, 8)}${m[1].padStart(2, "0")}`;
      if (d < today) d = addDays(`${today.slice(0, 8)}01`, 31).slice(0, 8) + m[1].padStart(2, "0");
      return setDay(d, `il ${+m[1]}`);
    }) ||
    take(new RegExp(String.raw`\s(?:(prossimo|prossima|questo|questa) )?(${WD_ALT})(?: (prossimo|prossima))?${END}`, "i"), (m) => {
      const wd = weekdayIndex(m[2]);
      const next = /prossim/i.test(`${m[1] ?? ""}${m[3] ?? ""}`);
      fromWeekday = true;
      return setDay(nextWeekday(today, wd, next), `${WEEKDAYS[wd - 1]}${next ? " prossimo" : ""}`);
    }) ||
    take(/\sil (\d{1,2})\b(?![:.]\d)/i, (m) => {
      let d = `${today.slice(0, 8)}${m[1].padStart(2, "0")}`;
      if (d < today) d = addDays(`${d.slice(0, 8)}01`, 31).slice(0, 8) + m[1].padStart(2, "0");
      return setDay(d, `il ${+m[1]}`);
    });

  /* ---------- Fascia della giornata ---------- */
  take(/\s(?:di sera|la sera|in serata|di notte)\b/i, () => {
    evening = true;
  });
  take(/\s(?:di pomeriggio|del pomeriggio|nel pomeriggio|il pomeriggio)\b/i, () => {
    evening = true;
  });
  take(/\s(?:di mattina|del mattino|la mattina|in mattinata)\b/i, () => {
    morning = true;
  });

  /* ---------- Durata ---------- */
  const setMinutes = (m: number, label?: string) => {
    if (m > 0 && m <= 24 * 60) out.minutes = Math.round(m);
    return label ?? undefined;
  };
  take(/\s(?:per )?(un'?ora|1 ora) e mezz[ao]\b/i, () => setMinutes(90, "1h 30m")) ||
    take(/\s(?:per )?(\d+|due|tre|quattro) ore e mezz[ao]\b/i, (m) => setMinutes(toNum(m[1]) * 60 + 30, `${toNum(m[1])}h 30m`)) ||
    take(/\s(?:per )?mezz'?ora\b/i, () => setMinutes(30, "30m")) ||
    take(/\s(?:per )?(?:un'?ora|1 ora)\b/i, () => setMinutes(60, "1h")) ||
    take(/\s(?:per )?(\d+(?:[.,]\d+)?|due|tre|quattro|cinque|sei) or[ae]\b/i, (m) => setMinutes(toNum(m[1]) * 60, `${toNum(m[1])}h`)) ||
    take(/\s(?:per )?(\d+)\s?h(?:\s?(\d{1,2})(?:m|min)?)?(?=\s)/i, (m) => setMinutes(+m[1] * 60 + (m[2] ? +m[2] : 0), `${m[1]}h${m[2] ? ` ${m[2]}m` : ""}`)) ||
    take(/\s(?:per )?(\d+)\s?(?:min|minuti|m)\b/i, (m) => setMinutes(+m[1], `${m[1]}m`));

  /* ---------- Orario ---------- */
  let start: number | undefined;
  let end: number | undefined;
  const mins = (h: string, m?: string) => +h * 60 + (m ? +m : 0);
  take(new RegExp(String.raw`\s(?:dalle|dall'|dale|da) ?${H} (?:alle|all'|a|-|–) ?${H}(?=\s)`, "i"), (m) => {
    start = mins(m[1], m[2]);
    end = mins(m[3], m[4]);
  }) ||
    take(new RegExp(String.raw`\s(?:alle |ore |h ?)?${H} ?[-–] ?${H}(?=\s)`, "i"), (m) => {
      start = mins(m[1], m[2]);
      end = mins(m[3], m[4]);
    }) ||
    take(/\s(?:a |verso )?mezzogiorno\b/i, () => {
      start = 12 * 60;
      morning = true; // già esplicito: niente "+12"
    }) ||
    take(/\s(?:a )?mezzanotte\b/i, () => {
      start = 0;
      morning = true;
    }) ||
    take(new RegExp(String.raw`\s(?:alle ore|alle|all'|ore|verso le|h|@) ?${H}(?=\s)`, "i"), (m) => {
      start = mins(m[1], m[2]);
    }) ||
    take(/\s([01]?\d|2[0-3])[:.]([0-5]\d)(?=\s)/, (m) => {
      start = mins(m[1], m[2]);
    });

  if (start !== undefined) {
    // "alle 6 di sera" → 18; "alle 3" senza indicazioni → 15 (nessuno fissa una cosa alle 3 di notte).
    const pm = (m: number) => (m < 12 * 60 && m >= 60 && (evening || (!morning && m < 7 * 60)) ? m + 12 * 60 : m);
    start = pm(start);
    // La fine è la prima lettura che viene dopo l'inizio: "dalle 10 alle 2" → 14:00, "dalle 23 alle 1" → 01:00.
    if (end !== undefined) while (end <= start) end += 12 * 60;
    out.startMin = start;
    out.endMin = end ?? start + (out.minutes ?? 60);
    out.allDay = false;
    understood.push(`${fmt(out.startMin)}–${fmt(out.endMin)}`);
  } else if (evening && out.day && !out.allDay) {
    // "stasera cena da Luca" senza ora: lo mettiamo alle 20 per un'ora (si sposta in un attimo).
    out.startMin = 20 * 60;
    out.endMin = out.startMin + (out.minutes ?? 60);
  }

  /* ---------- Combinazioni ---------- */
  if (!backlog) {
    // (TypeScript non vede che le funzioni sopra hanno riempito out.repeat)
    const repeat = out.repeat as Repeat | undefined;
    if (repeat && !out.day) {
      // "ogni lun e gio" senza data: si parte dal primo giorno giusto da oggi.
      const days = repeat.days;
      out.day = days?.length ? days.map((d) => nextWeekday(today, d)).sort()[0] : today;
    }
    if (out.startMin !== undefined && !out.day) {
      // Solo l'ora: oggi, oppure domani se quell'ora è già passata.
      out.day = out.startMin < minuteOf(now) ? addDays(today, 1) : today;
      understood.unshift(out.day === today ? "oggi" : "domani");
    }
    // "sabato alle 10" detto di sabato pomeriggio: si intende il prossimo sabato.
    if (fromWeekday && out.day === today && out.startMin !== undefined && out.startMin < minuteOf(now)) out.day = addDays(today, 7);
    if (out.day && out.startMin === undefined) out.allDay = true;
  } else {
    out.day = undefined;
    out.startMin = out.endMin = undefined;
    out.allDay = undefined;
    out.repeat = undefined;
  }

  return { title: cleanTitle(s), ...out, understood };
}

const fmt = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

const EDGE = /^(?:il|lo|la|le|alle|all'|a|ad|di|da|del|per|e|,|-|–|:)\s+|\s+(?:il|lo|la|le|alle|a|ad|di|da|del|per|e|,|-|–|:)$/i;
function cleanTitle(s: string) {
  let t = s.replace(/\s+/g, " ").replace(/\s+([,.!?])/g, "$1").trim();
  for (let i = 0; i < 6 && EDGE.test(t); i++) t = t.replace(EDGE, "").trim();
  t = t.replace(/^[,.\-–:]+|[,\-–:]+$/g, "").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}

/** Dal testo capito ai campi dell'evento (start/end come stringhe "da parete"). */
export function parsedToFields(p: Parsed) {
  if (!p.day) return { title: p.title, minutes: p.minutes, category: p.category };
  if (p.allDay || p.startMin === undefined) return { title: p.title, start: p.day, end: p.day, allDay: true, repeat: p.repeat, category: p.category };
  const start = at(p.day, p.startMin);
  return { title: p.title, start, end: addMinutes(start, (p.endMin ?? p.startMin + 60) - p.startMin), allDay: false, repeat: p.repeat, category: p.category };
}
