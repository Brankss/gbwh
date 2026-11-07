import "server-only";
import type { NextRequest } from "next/server";
import { toBotId } from "./bots";
import { dayLabel, repeatLabel, whenLabel, type CalEvent, type CalRequest, type CalSettings, type Occurrence } from "./calendar";
import { createRequest, type requestInput } from "./calendar-store";
import { getBots } from "./store";
import { wakeWithin } from "./wake";
import type { z } from "zod";

// Il "protocollo" del calendario per gli agent: come si presentano, cosa possono fare,
// e lo smistamento automatico verso il gestore del calendario quando c'è.

/** Id dell'agent che scrive: campo `agent` nel body oppure ?agent= nell'indirizzo. */
export function agentFrom(request: NextRequest, body?: unknown): string | null {
  const fromBody = body && typeof body === "object" ? (body as Record<string, unknown>).agent : undefined;
  return toBotId(fromBody ?? request.nextUrl.searchParams.get("agent"));
}

export const needAgent = () =>
  Response.json({ error: "Manca 'agent': il tuo id (lo stesso della bacheca), nel body o come ?agent=." }, { status: 400 });

export async function botName(id: string) {
  if (id === "tu") return "Branko";
  return (await getBots()).find((b) => b.id === id)?.name ?? id;
}

/** Un'occorrenza come la vede un agent: piatta, con il quando già scritto in italiano. */
export function viewOccurrence(o: Occurrence, settings: CalSettings) {
  return clean({
    id: o.id,
    occurrence: o.repeat ? o.occ : undefined,
    title: o.title,
    start: o.start,
    end: o.end,
    allDay: o.allDay || undefined,
    quando: whenLabel(o),
    category: settings.categories.find((c) => c.id === o.category)?.name,
    place: o.place,
    notes: o.notes,
    done: o.isDone || undefined,
    repeat: o.repeat ? { ...o.repeat, descrizione: repeatLabel(o.repeat) } : undefined,
    by: o.by,
    ref: o.ref,
  });
}

export function viewBacklog(e: CalEvent, settings: CalSettings) {
  return clean({
    id: e.id,
    title: e.title,
    minutes: e.minutes,
    due: e.due,
    category: settings.categories.find((c) => c.id === e.category)?.name,
    notes: e.notes,
    by: e.by,
    ref: e.ref,
  });
}

export function viewRequest(r: CalRequest) {
  return clean({ ...r, createdAt: undefined, updatedAt: undefined, at: new Date(r.createdAt).toISOString() });
}

/**
 * Se c'è un gestore e chi scrive non è lui, la modifica diventa una richiesta per il gestore
 * (che viene svegliato via email). Restituisce la risposta da dare, o null se si può procedere.
 */
export async function routeToManager(agent: string, settings: CalSettings, req: z.infer<typeof requestInput>): Promise<Response | null> {
  if (!settings.manager || settings.manager === agent) return null;
  const request = await createRequest(req, agent);
  const who = await botName(agent);
  const what = req.text ?? JSON.stringify({ action: req.action, target: req.target, occurrence: req.occurrence, ...req.payload });
  const wake = await wakeWithin(settings.manager, { kind: "calendario", text: `${who} (${agent}) chiede: ${what}` });
  const manager = await botName(settings.manager);
  return Response.json(
    {
      ok: true,
      routed: true,
      request: viewRequest(request),
      message: `Il calendario lo gestisce ${manager}: ho girato la tua richiesta a lui. Stato: GET /api/agent/calendar/requests?by=${agent}`,
      wake,
    },
    { status: 202 },
  );
}

export function protocol(settings: CalSettings, managerName: string | null) {
  return {
    cosa: "Il calendario personale di Branko: tempo, giornate, settimane, logistica. Tu lo leggi e lo modifichi con queste API.",
    auth: "Come le altre API: header 'Authorization: Bearer <token>' oppure ?token=<token>.",
    chi_sei: "Ogni modifica porta il tuo id nel campo 'agent' (lo stesso id della bacheca, es. 'berlu'). Branko nel registro compare come 'tu'.",
    orari:
      "Ora di Roma, senza fuso: '2026-11-08T18:30'. Giornata intera: '2026-11-08' (oppure allDay:true). " +
      "Se mandi un ISO con fuso ('…Z', '…+01:00') lo converto io. 'end' degli eventi a orario è esclusa; quella dei giorni interi è inclusa.",
    gestore: settings.manager
      ? `Il calendario lo gestisce ${managerName} (agent '${settings.manager}'). Se NON sei tu, ogni modifica che mandi (POST/PATCH/DELETE) ` +
        "diventa automaticamente una RICHIESTA per lui: rispondo 202 con la richiesta, lui viene svegliato via email e decide. " +
        "Puoi anche scrivergli a parole con POST /api/agent/calendar/requests."
      : "Nessun gestore per ora: chiunque modifica direttamente. Quando Branko ne sceglie uno, le modifiche degli altri passeranno da lui senza che cambi nulla per te.",
    endpoints: {
      "GET /api/agent/calendar": "Questa guida + adesso, oggi, prossimi 7 giorni, da pianificare, preferenze, categorie, richieste in attesa.",
      "GET /api/agent/calendar?from=AAAA-MM-GG&to=AAAA-MM-GG": "Eventi tra due giorni inclusi (max 92). Gli eventi che si ripetono arrivano già divisi per giorno: id + occurrence.",
      "GET /api/agent/calendar/free?date=AAAA-MM-GG&minutes=60": "Spazi liberi nella fascia utile della giornata. Opzionali: from=09:00, to=13:00, days=7 (cerca anche nei giorni dopo).",
      "POST /api/agent/calendar":
        "Aggiungi. Body {agent, text:'palestra domani 18-19:30 #sport'} con una frase in italiano, oppure strutturato " +
        "{agent, title, start, end? | minutes?, allDay?, category?, place?, notes?, repeat?, due?, ref?}. Senza start = 'da pianificare'. " +
        "Più eventi insieme: {agent, events:[…]} (max 50).",
      "PATCH /api/agent/calendar/<id>":
        "Modifica: {agent, …solo i campi da cambiare}. Se sposti solo start, la durata resta. Evento che si ripete: aggiungi occurrence:'AAAA-MM-GG' " +
        "e scope 'this' (solo quel giorno, default) o 'all' (tutta la serie). {agent, done:true, occurrence?} = fatto. {agent, unschedule:true} = torna da pianificare. repeat:null = non si ripete più.",
      "DELETE /api/agent/calendar/<id>?agent=<id>&occurrence=AAAA-MM-GG": "Elimina; con occurrence solo quel giorno della serie.",
      "GET /api/agent/calendar/changes?since=<ms>": "Registro delle modifiche: chi ha fatto cosa (per restare allineato).",
      "GET /api/agent/calendar/requests?status=pending&by=<id>": "Richieste per il gestore (filtri facoltativi).",
      "POST /api/agent/calendar/requests":
        "Chiedi al gestore: {agent, text:'sposta la palestra a domani sera'} oppure {agent, action:'create'|'update'|'delete', target?:<id evento>, occurrence?, payload?:{…campi}}.",
      "PATCH /api/agent/calendar/requests/<id>":
        "Solo il gestore: {agent, status:'approved'|'rejected', note?, apply?:true}. apply:true = la applico io dal payload; altrimenti la applichi tu con le API sopra e mi passi result:<id evento>.",
      "PATCH /api/agent/calendar/settings":
        "Gestore (o chiunque se non c'è): {agent, prefs?, categories?:[{name, color}], dayStart?, dayEnd?}. prefs = quello che sai delle abitudini e dei vincoli di Branko: tienilo breve e aggiornato.",
    },
    campi: {
      repeat: "{freq:'daily'|'weekly'|'monthly', interval?:2, days?:[1..7] (1=lunedì), until?:'AAAA-MM-GG'}",
      category: "Nome o id di una categoria. Un nome nuovo crea la categoria (max 14): preferisci quelle che ci sono.",
      ref: "Un tuo id stabile (es. 'promemoria-dentista'): con lo stesso ref aggiorno invece di duplicare. Utile se riprovi.",
      due: "Per le cose da pianificare: entro che giorno.",
    },
    frasi: [
      "palestra domani 18-19:30 #sport",
      "call con Marco lunedì alle 15 per mezz'ora",
      "studio ogni lun e gio dalle 9 alle 11 #studio",
      "standup giorni feriali alle 9:15 15 min fino al 30/11",
      "cena da Luca stasera",
      "rinnovare passaporto da pianificare 1h",
    ],
    regole: [
      "Prima di aggiungere guarda cosa c'è (GET ?from&to o /free). Se rispondo con 'conflicts', sistema o avvisa: non accavallare a caso.",
      "Quello che non ha un orario preciso va 'da pianificare' (niente start): Branko lo trascina nel calendario quando vuole.",
      "Lascia respiro tra le cose e rispetta le preferenze. Non riempire ogni buco.",
      "Non cancellare né spostare cose messe da Branko ('by':'tu') senza che te l'abbia chiesto.",
      "Le cose che deve sapere subito vanno negli Annunci (POST /api/agent/alerts), non nel calendario.",
    ],
    fascia_utile: `${settings.dayStart}:00–${settings.dayEnd}:00`,
  };
}

/** "sab 8 nov" ecc. per riassunti testuali. */
export const day = (d: string) => dayLabel(d, true);

function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}
