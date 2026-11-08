import "server-only";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { zodMessage } from "./agent-auth";
import { toBotId } from "./bots";
import {
  LEARNING_KINDS,
  QA_CHECKS,
  RESEARCH_KINDS,
  ROLES,
  STAGES,
  STAGE_IDS,
  VERDICTS,
  VIDEO_STATUS,
  stageOf,
  totalSeconds,
  type RoleId,
  type StageId,
  type UgcConcept,
  type UgcLearning,
  type UgcSettings,
  type UgcVideo,
} from "./ugc";
import { FORMATS, HOOK_TYPES, PRINCIPLES, REVIEW_RUBRIC, SCRIPT_RULES, formatOf } from "./ugc-library";
import { botName, getLog, listConcepts, queue, updateConcept, videosWithResults, type BriefSummary } from "./ugc-store";

export { agentFrom, needAgent } from "./calendar-agent";

// La UGC Factory vista da un agent: chi è, cosa può fare, cosa tocca a lui, e il protocollo
// (il testo da cui un bot impara il mestiere). Le regole della catena stanno in ugc-store.ts:
// qui ci sono solo le viste, i controlli "morbidi" e le spiegazioni in italiano.

export const TZ = "Europe/Rome";
const API = "/api/agent/ugc";

/* ------------------------------------------------------------------ */
/* Richieste e risposte                                                */
/* ------------------------------------------------------------------ */

export const refuse = (status: number, error: string) => Response.json({ error }, { status });

/**
 * Legge il body JSON di una scrittura: chi scrive (agent) + dati validati dallo schema.
 * `prepare` può sistemare il body grezzo prima della validazione (es. owner:null → libera).
 */
export async function agentBody<S extends z.ZodType>(
  request: NextRequest,
  schema: S,
  prepare?: (raw: Record<string, unknown>) => void,
): Promise<{ agent: string; data: z.infer<S> } | { error: Response }> {
  const raw = await request.json().catch(() => null);
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  const agent = toBotId(obj?.agent ?? request.nextUrl.searchParams.get("agent"));
  if (!agent) {
    return { error: refuse(400, "Manca 'agent': il tuo id (lo stesso della bacheca), nel body o come ?agent=.") };
  }
  if (!obj) return { error: refuse(400, "Body: serve un oggetto JSON, es. {\"agent\": \"" + agent + "\", …}.") };
  const copy = { ...obj };
  delete copy.agent;
  prepare?.(copy);
  const parsed = schema.safeParse(copy);
  if (!parsed.success) return { error: refuse(400, zodMessage(parsed.error)) };
  return { agent, data: parsed.data };
}

/** owner: null o "" = libera il lavoro; un nome qualsiasi diventa un id ("Berlu" → "berlu"). */
export function normalizeOwner(raw: Record<string, unknown>) {
  if (!("owner" in raw)) return;
  if (raw.owner === null || raw.owner === "") raw.owner = "";
  else if (typeof raw.owner === "string") raw.owner = toBotId(raw.owner) ?? "";
}

export const iso = (ms: number) => new Date(ms).toISOString();

export function adesso() {
  const d = new Date();
  return {
    iso: d.toISOString(),
    ms: d.getTime(),
    in_parole: `${new Intl.DateTimeFormat("it-IT", { timeZone: TZ, dateStyle: "full", timeStyle: "short" }).format(d)} (${TZ})`,
  };
}

/** "da 3 ore", "da 2 giorni". */
export function waiting(since: number) {
  const min = Math.max(0, Math.round((Date.now() - since) / 60_000));
  if (min < 60) return `da ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `da ${h} ${h === 1 ? "ora" : "ore"}`;
  return `da ${Math.round(h / 24)} giorni`;
}

/* ------------------------------------------------------------------ */
/* Squadra e ruoli                                                     */
/* ------------------------------------------------------------------ */

export const roleLabel = (r: string | null) => (r === "tu" ? "Branko" : (ROLES.find((x) => x.id === r)?.label ?? "nessuno"));

export async function team(settings: UgcSettings, agent?: string | null) {
  const squadra = await Promise.all(
    ROLES.map(async (r) => {
      const bot = settings.roles[r.id];
      return { ruolo: r.id, nome_ruolo: r.label, cosa_fa: r.does, bot: bot ?? null, nome: bot ? await botName(bot) : null };
    }),
  );
  const mine = agent ? rolesOf(settings, agent) : [];
  return {
    ruoli: squadra,
    sveglia_automatica: settings.autoWake,
    ...(agent && {
      i_tuoi_ruoli: mine,
      nota: mine.length
        ? `Sei ${mine.map((r) => roleLabel(r)).join(", ")}. La tua coda: GET ${API}/queue?agent=${agent}`
        : `Nessun ruolo assegnato a '${agent}'. Puoi comunque lavorare su qualsiasi fase (prendi il lavoro dalla coda di tutti: GET ${API}/queue?agent=${agent}).`,
    }),
  };
}

export const rolesOf = (settings: UgcSettings, agent: string) => ROLES.map((r) => r.id).filter((r) => settings.roles[r] === agent);

/* ------------------------------------------------------------------ */
/* Viste compatte                                                      */
/* ------------------------------------------------------------------ */

export function viewBriefShort(b: BriefSummary) {
  return {
    id: b.id,
    title: b.title,
    prodotto: b.productName,
    target: b.target.length > 200 ? `${b.target.slice(0, 200)}…` : b.target,
    angoli: b.angles.length,
    ricerca: b.research,
    concept: b.concepts,
    concept_attivi: b.active,
    vincenti: b.winners,
    status: b.status,
    aggiornato: iso(b.updatedAt),
  };
}

export function viewConceptShort(c: UgcConcept) {
  const chosen = c.hooks.find((h) => h.chosen);
  return {
    id: c.id,
    briefId: c.briefId,
    title: c.title,
    stage: c.stage,
    fase: stageOf(c.stage).label,
    tocca_a: roleLabel(stageOf(c.stage).role),
    format: c.format,
    format_nome: formatOf(c.format)?.name ?? c.format,
    hook_scelto: chosen?.text ?? null,
    hook: c.hooks.length,
    scene: c.scenes.length,
    owner: c.owner ?? null,
    by: c.by,
    aggiornato: iso(c.updatedAt),
  };
}

export function viewLearning(l: UgcLearning) {
  return { ...l, creato: iso(l.createdAt) };
}

/* ------------------------------------------------------------------ */
/* Cosa fare adesso con un concept                                     */
/* ------------------------------------------------------------------ */

/** Il prossimo passo di un concept, con gli endpoint da chiamare (in ordine). */
export function nextStep(c: UgcConcept, latestVideo?: UgcVideo | null): { cosa_fare: string; chiama: string[] } {
  const p = `${API}/concepts/${c.id}`;
  const claim = `PATCH ${p} {agent, owner:"<il tuo id>"}  (prendilo, così nessun altro ci lavora in parallelo)`;
  switch (c.stage) {
    case "idea":
      return {
        cosa_fare:
          "Completa il concept: angolo, format della libreria, almeno 3 hook (ognuno con un type di HOOK_TYPES, uno solo chosen:true), " +
          "storia hook → buildup → payoff → cta e 'why' (perché ferma lo scroll). Se c'è una revisione 'da rifare', applica le correzioni. Poi mandalo al gate.",
        chiama: [`GET ${p}  (brief, revisioni, Playbook, struttura del format)`, claim, `PATCH ${p} {agent, hooks:[…], story:{…}, why, …}`, `PATCH ${p} {agent, stage:"gate", note:"cosa hai fatto"}`],
      };
    case "gate":
      return {
        cosa_fare:
          "Giudica il concept PRIMA che si spenda per produrlo (griglia: libreria.REVIEW_RUBRIC). Fermerebbe lo scroll nei primi 2 secondi? " +
          "approvato → script; da rifare → torna a idea (scrivi le correzioni in fix); scartato → fermo.",
        chiama: [`GET ${p}`, `POST ${p}/reviews {agent, verdict:"approvato"|"da rifare"|"scartato", score:1-10, scrollStop:true|false, good?, fix:[…]}`],
      };
    case "script":
      return {
        cosa_fare:
          "Scrivi le scene (2–5 s l'una): shot (inquadratura), action, line (battuta), onScreen (testo a schermo). Segui libreria.SCRIPT_RULES. Poi passa a produzione.",
        chiama: [`GET ${p}`, claim, `PATCH ${p} {agent, scenes:[{sec, shot, action, line?, onScreen?}], durationSec?}`, `PATCH ${p} {agent, stage:"produzione", note?}`],
      };
    case "produzione":
      return {
        cosa_fare:
          "Genera le scene con i TUOI strumenti (fuori dall'hub), monta (ritmo, sottotitoli, musica), controlla la qualità (QA_CHECKS) e carica il video: " +
          "con status 'in revisione' (default) il concept va da solo dal critico.",
        chiama: [`GET ${p}`, claim, `POST ${p}/videos {agent, media:"https://…mp4" | {url,type} | {data,mime}, hookId?, durationSec?, qa:{…}, notes?}  (oppure multipart con 'file')`],
      };
    case "revisione":
      return {
        cosa_fare:
          "Guarda il video montato" +
          (latestVideo ? ` (v${latestVideo.version}: ${latestVideo.media.url})` : "") +
          ": qualità tecnica (QA_CHECKS) e forza dei primi 3 secondi. approvato → pronto (arriva da solo un Annuncio a Branko); da rifare → produzione; scartato → fermo.",
        chiama: [`POST ${p}/reviews {agent, verdict, score, scrollStop, good?, fix:[…], videoId?${latestVideo ? `:"${latestVideo.id}"` : ""}}`],
      };
    case "pronto":
      return { cosa_fare: "Tocca a Branko: guarda il video e decide se metterlo in test. Tu non devi fare nulla (l'Annuncio parte da solo).", chiama: [] };
    case "in_test":
      return {
        cosa_fare:
          "Il video è online: aggiungi i numeri del giorno (stesso video + piattaforma + giorno = aggiorna). Quando i numeri bastano, scrivi la lezione nel Playbook e chiudi: vincente o scartato.",
        chiama: [
          `POST ${API}/videos/${latestVideo?.id ?? "<videoId>"}/results {agent, platform, date:"AAAA-MM-GG", spend?, impressions?, hookRate?, holdRate?, ctr?, cpc?, purchases?, revenue?, roas?}`,
          `POST ${API}/learnings {agent, kind, text, strength:"ipotesi"|"provato", evidence, conceptId:"${c.id}"}`,
          `PATCH ${p} {agent, stage:"vincente"|"scartato", note:"perché, in numeri"}`,
        ],
      };
    case "vincente":
      return {
        cosa_fare: "Funziona: scrivi nel Playbook PERCHÉ (provato, con i numeri) e proponi varianti (nuovi hook sullo stesso corpo = nuovi concept sullo stesso brief).",
        chiama: [`POST ${API}/learnings {agent, kind, text, strength:"provato", evidence, conceptId:"${c.id}"}`, `POST ${API}/concepts {agent, briefId:"${c.briefId}", …}`],
      };
    default:
      return { cosa_fare: "Fermo. Se c'è una lezione, scrivila nel Playbook.", chiama: [`POST ${API}/learnings {agent, kind, text, conceptId:"${c.id}"}`] };
  }
}

/** La coda di un ruolo (da queue() dello storage), con cosa fare, cosa chiamare e chi l'ha preso. */
export async function roleQueue(role: RoleId, agent?: string | null) {
  const [items, concepts, videos] = await Promise.all([queue(role), listConcepts(), videosWithResults()]);
  return items.map((it) => {
    const base = { ruolo: role, tipo: it.kind, id: it.id, titolo: it.title, in_attesa: waiting(it.since), dal: iso(it.since) };
    if (it.kind === "risposta") return { ...base, cosa_fare: it.todo, chiama: [`PATCH ${API}/questions/${it.id} {agent, chiudi:true}`] };
    if (it.kind !== "concept") return { ...base, ...briefStep({ id: it.id }, it.todo) };
    const c = concepts.find((x) => x.id === it.id);
    if (!c) return { ...base, cosa_fare: it.todo, chiama: [] };
    const latest = videos.filter((v) => v.video.conceptId === c.id).sort((a, b) => b.video.version - a.video.version)[0]?.video;
    return {
      ...base,
      fase: c.stage,
      nome_fase: stageOf(c.stage).label,
      briefId: c.briefId,
      format: c.format,
      preso_da: c.owner ?? null,
      ...(c.owner && c.owner !== agent && { attenzione: `Lo sta già lavorando '${c.owner}': scegli un'altra voce, a meno che non sia fermo da molto.` }),
      ...nextStep(c, latest),
    };
  });
}

/** Il prossimo passo di un brief (lavoro dello stratega). */
export function briefStep(b: { id: string }, todo: string) {
  const p = `${API}/briefs/${b.id}`;
  if (todo.startsWith("Fai la ricerca")) return { cosa_fare: todo, chiama: [`GET ${p}`, `POST ${p}/research {agent, kind:"ad competitor"|"voce cliente"|"insight"|"trend", text, url?, source?, why?}`] };
  if (todo.startsWith("Proponi")) return { cosa_fare: todo, chiama: [`GET ${p}`, `PATCH ${p} {agent, angles:[{text, why}]}  (manda TUTTI gli angoli: la lista sostituisce quella vecchia)`] };
  return { cosa_fare: todo, chiama: [`GET ${p}`, `POST ${API}/concepts {agent, briefId:"${b.id}", title, angle, format, hooks:[…], story:{…}, why}`] };
}

/* ------------------------------------------------------------------ */
/* Controlli morbidi                                                   */
/* ------------------------------------------------------------------ */

/** Cosa manca a un concept per essere fatto bene nella sua fase (avvisi, non errori). */
export function checkConcept(c: UgcConcept): string[] {
  const out: string[] = [];
  const at = STAGE_IDS.indexOf(c.stage);
  const hookIds = HOOK_TYPES.map((h) => h.id);
  if (c.stage === "scartato") return out;
  if (c.hooks.length < 3) out.push(`Servono almeno 3 hook (ora ${c.hooks.length}): varianti diverse dei primi 2 secondi, ognuna con un type.`);
  for (const h of c.hooks) {
    if (!hookIds.includes(h.type)) out.push(`Hook "${h.text.slice(0, 50)}": type "${h.type}" non è nella libreria. Usa uno di: ${hookIds.join(", ")}.`);
  }
  if (c.hooks.length && !c.hooks.some((h) => h.chosen)) out.push("Nessun hook ha chosen:true: indica quello su cui punti.");
  const missing = (["hook", "buildup", "payoff", "cta"] as const).filter((k) => !c.story[k]?.trim());
  if (missing.length) out.push(`Storia incompleta: manca ${missing.join(", ")}.`);
  if (!c.why) out.push("Manca 'why': perché qualcuno dovrebbe fermarsi a guardarlo.");
  if (at >= STAGE_IDS.indexOf("script") && c.stage !== "vincente") {
    if (!c.scenes.length) out.push(c.stage === "script" ? "Mancano le scene: scrivile prima di passare a produzione." : "Il concept non ha scene.");
    c.scenes.forEach((s, i) => {
      if (s.sec < 2 || s.sec > 5) out.push(`Scena ${i + 1}: ${s.sec} s. Stai tra 2 e 5 secondi (l'AI regge bene solo inquadrature brevi).`);
    });
    if (c.durationSec && c.scenes.length && Math.abs(totalSeconds(c.scenes) - c.durationSec) > 3) {
      out.push(`Le scene durano ${totalSeconds(c.scenes)} s ma durationSec è ${c.durationSec}.`);
    }
  }
  return out;
}

/**
 * Un agent non può scavalcare con un PATCH le due revisioni del critico (gate e revisione video):
 * si passa solo con POST …/reviews. Scartare si può sempre; da "scartato" si riparte da capo.
 */
export function stageJumpError(from: StageId, to: StageId): string | null {
  if (to === from || to === "scartato") return null;
  const idx = (s: StageId) => (s === "scartato" ? -1 : STAGE_IDS.indexOf(s));
  const [a, b] = [idx(from), idx(to)];
  const gate = idx("gate");
  const rev = idx("revisione");
  if (a <= gate && b > gate) {
    return `Non si passa da "${stageOf(from).label}" a "${stageOf(to).label}" saltando il gate: ${
      a < gate ? 'prima manda il concept al gate (stage:"gate")' : "serve una revisione"
    }. Il critico decide con POST ${API}/concepts/<id>/reviews (approvato → script).`;
  }
  if (a <= rev && b > rev) {
    return `Non si passa a "${stageOf(to).label}" senza la revisione del video: carica il video (POST …/videos, status "in revisione") e il critico lo approva con POST …/reviews.`;
  }
  return null;
}

/** Chi ha scritto il concept: autore, chi ne ha cambiato i contenuti, chi l'ha mandato al gate. */
async function authorsOf(c: UgcConcept) {
  const log = await getLog({ conceptId: c.id });
  const toGate = `${stageOf("idea").label} → ${stageOf("gate").label}`;
  const who = new Set([c.by]);
  for (const e of log) {
    if (e.action.startsWith(toGate)) who.add(e.by);
    const m = /^concept modificato \((.*)\)$/.exec(e.action);
    if (m && m[1].split(", ").some((f) => f !== "owner")) who.add(e.by);
  }
  return who;
}

/** Chi può revisionare: il critico assegnato; se non c'è, chiunque tranne l'autore al gate. */
export async function reviewGuard(agent: string, c: UgcConcept, settings: UgcSettings): Promise<Response | null> {
  const critic = settings.roles.critico;
  if (critic) {
    if (critic === agent) return null;
    return refuse(
      403,
      `Le revisioni le fa il critico: ${await botName(critic)} ('${critic}'). Viene svegliato da solo quando c'è da giudicare. ` +
        "Se hai un parere, scrivilo nel concept (PATCH con note) o in bacheca.",
    );
  }
  if (c.stage === "gate" && (await authorsOf(c)).has(agent)) {
    return refuse(
      403,
      "Non puoi approvare il tuo stesso concept: il gate serve a un giudizio esterno PRIMA di spendere per produrre. " +
        "Chiedi a un altro bot di fare da critico (o a Branko, che può revisionare dall'hub o assegnare un critico in Squadra). " +
        "Intanto puoi lavorare su altro dalla coda.",
    );
  }
  return null;
}

/**
 * Quando un concept cambia fase, chi l'aveva preso lo lascia: il lavoro della fase dopo
 * è libero per chi ha quel ruolo (altrimenti la coda lo mostrerebbe "preso").
 */
export async function releaseOwner(before: UgcConcept, after: UgcConcept, by: string, keep?: boolean) {
  if (keep || before.stage === after.stage || !after.owner) return after;
  const r = await updateConcept(after.id, { owner: undefined }, by);
  return r.ok ? r.value : after;
}

/* ------------------------------------------------------------------ */
/* Libreria                                                            */
/* ------------------------------------------------------------------ */

export function library() {
  return { FORMATS, HOOK_TYPES, PRINCIPLES, REVIEW_RUBRIC, SCRIPT_RULES };
}

/* ------------------------------------------------------------------ */
/* Il protocollo                                                       */
/* ------------------------------------------------------------------ */

export function protocol(settings: UgcSettings, names: Partial<Record<RoleId, string>>) {
  const who = (role: string | null) => {
    if (role === "tu") return "Branko";
    if (!role) return "nessuno";
    const bot = settings.roles[role as RoleId];
    return bot ? `${roleLabel(role)}: ${names[role as RoleId] ?? bot} ('${bot}')` : `${roleLabel(role)} (non assegnato: chiunque)`;
  };
  const critic = settings.roles.critico;
  return {
    cosa:
      "La UGC Factory è la catena di montaggio dei video pubblicitari UGC di Branko (video stile 'persona vera col telefono' per TikTok, Reels, Meta). " +
      "Nei primi test il punto debole non era il generatore video ma l'IDEA: per questo la creatività sta in fasi esplicite e un critico giudica il concept " +
      "PRIMA che si spenda per produrlo. Qui restano brief, ricerca, concept, script, revisioni, video finiti, numeri e lezioni (il Playbook): " +
      "la factory è ripetibile e impara dai numeri veri, non dalla memoria di un singolo bot.",
    generazione:
      "I video NON si generano nell'hub. Li generi e li monti fuori, con i tuoi strumenti; qui carichi il video finito e lavori su tutto il resto " +
      "(idea, script, revisioni, numeri, lezioni). Se cambia lo strumento, qui non cambia nulla.",
    auth: "Header 'Authorization: Bearer <token>' oppure ?token=<token> su ogni richiesta.",
    chi_sei:
      "Ogni scrittura porta il tuo id nel campo 'agent' (nel body JSON o come ?agent=): lo stesso id della bacheca, es. 'berlu'. " +
      "Nel registro Branko compare come 'tu'. Le letture non lo richiedono, ma con ?agent= ti dico i tuoi ruoli e la tua coda.",
    squadra:
      "Cinque ruoli: stratega (brief, ricerca, angoli), regista (concept e script), critico (gate e revisione video), producer (genera, monta, carica), " +
      "analista (numeri e Playbook). Branko li assegna dall'hub. Un ruolo non assegnato lo può fare chiunque: un bot da solo può portare avanti tutta la catena, " +
      "con un'unica eccezione, il gate (vedi 'revisioni').",
    catena: STAGES.map((s) => ({ fase: s.id, nome: s.label, chi: who(s.role), cosa: s.todo })),
    passaggi_automatici: [
      "Revisione al gate: approvato → script, da rifare → idea, scartato → scartato.",
      "Revisione del video: approvato → pronto (il video diventa 'approvato'), da rifare → produzione (video 'bozza'), scartato → scartato.",
      "Video caricato con status 'in revisione' (è il default) mentre il concept è in script o produzione → il concept passa a revisione.",
      "Primi numeri su un video di un concept 'pronto' → il concept passa a in_test e il video a 'pubblicato'.",
      "pronto o vincente → parte da solo un Annuncio per Branko.",
      "A ogni cambio di fase viene svegliato via email il bot che ha il ruolo di quella fase (se la sveglia automatica è attiva e non è lui ad aver fatto il passaggio).",
      "Quando la fase cambia, 'owner' si libera: il lavoro della fase dopo è di chi lo prende.",
    ],
    come_lavorare: [
      `1. Guarda la tua coda: GET ${API}/queue?agent=<id> (o ?role=regista). Ogni voce dice cosa fare e quali endpoint chiamare, la più vecchia per prima.`,
      "2. Prendi una voce libera (preso_da vuoto, o già tua) e dichiarala: PATCH …/concepts/<id> {agent, owner:'<il tuo id>'}. Non lavorare su una voce presa da un altro bot.",
      "3. Leggi tutto prima di scrivere: GET …/concepts/<id> (brief, revisioni, video, numeri, Playbook, struttura del format) e il Playbook in GET /api/agent/ugc.",
      "4. Fai il lavoro e salvalo (PATCH dei campi, POST di video/revisioni/numeri).",
      "5. Sposta la fase: PATCH …/concepts/<id> {agent, stage:'<fase dopo>', note:'una riga su cosa hai fatto o cosa serve'}. La nota finisce nel registro e nella mail al prossimo bot.",
      "6. Se molli una voce a metà, liberala: {agent, owner:null}.",
    ],
    fasi:
      "Le fasi si spostano con PATCH …/concepts/<id> {agent, stage, note?}. Il gate e la revisione video NON si scavalcano: si passano solo con una revisione " +
      "(POST …/reviews); un PATCH che li salta viene rifiutato. Scartare si può sempre. 'pronto' → 'in_test' lo decide Branko " +
      "(oppure succede da solo quando arrivano i primi numeri del video pubblicato).",
    gate:
      "Il gate esiste per giudicare l'idea PRIMA di spendere tempo e soldi in produzione: è molto più economico rifare un concept che un video. " +
      "Domanda chiave: una persona che scrolla si ferma nei primi 2 secondi, e capisce cosa le cambia? Usa la griglia libreria.REVIEW_RUBRIC. " +
      "Nel dubbio 'da rifare' con correzioni precise, non un 'approvato' di cortesia.",
    concept: {
      briefId: "Il brief da cui parte (GET /api/agent/ugc/briefs). Prima di scriverlo leggi brief, ricerca (voce dei clienti!) e Playbook.",
      angle: "L'angolo di vendita: un'idea sola, detta come la direbbe il cliente (meglio se presa dagli angoli del brief).",
      format: `Id di un format della libreria, OBBLIGATORIO e scelto da lì: ${FORMATS.map((f) => f.id).join(", ")}. Un id inventato viene rifiutato. La struttura beat per beat è in libreria.FORMATS (e in GET …/concepts/<id>).`,
      hooks: `Almeno 3 varianti dei primi 2 secondi: [{text, type, visual?, chosen?}]. type = id di libreria.HOOK_TYPES (${HOOK_TYPES.map((h) => h.id).join(", ")}). Una sola con chosen:true (quella su cui punti). Le altre servono per i test A/B sullo stesso corpo.`,
      story: "{hook, buildup, payoff, cta}: hook (l'aggancio), buildup (tensione / problema vissuto), payoff (il prodotto risolve, si VEDE), cta (cosa fare adesso).",
      why: "La tesi: perché qualcuno dovrebbe fermarsi a guardarlo. Se non sai scriverla in una frase, l'idea non è pronta.",
      character: "Chi appare e parla (età, tono, dove si trova).",
      durationSec: "Durata prevista in secondi (di solito 15–35).",
      scenes:
        "Nella fase script: [{sec, shot, action, line?, onScreen?, notes?}], ogni scena 2–5 s. shot = inquadratura (es. 'primo piano, telefono in mano, cucina'), " +
        "action = cosa succede, line = battuta parlata, onScreen = testo a schermo. Regole pratiche in libreria.SCRIPT_RULES.",
      liste: "hooks e scenes si mandano sempre COMPLETE: la lista nuova sostituisce la vecchia (gli id che rimandi restano gli stessi).",
      avvisi: "Le risposte su un concept contengono 'avvisi': cosa manca per farlo bene in quella fase. Non bloccano, ma il critico li guarda.",
    },
    revisioni:
      (critic
        ? `Le revisioni le fa SOLO il critico assegnato (${names.critico ?? critic}, '${critic}'): gli altri ricevono 403. `
        : "Non c'è un critico assegnato: può revisionare chiunque, TRANNE chi ha scritto il concept quando è al gate (403: non puoi approvare il tuo stesso concept). ") +
      "Body: {agent, verdict:'approvato'|'da rifare'|'scartato', score:1-10, scrollStop:true|false, good?, fix:[…]}. Con 'da rifare' fix è obbligatorio: " +
      "correzioni concrete e applicabili ('l'hook dice il prodotto troppo presto: apri sul problema'), non giudizi vaghi. La revisione sposta la fase da sola (vedi passaggi_automatici). " +
      "In revisione video si giudica l'ultima versione (o videoId): qualità tecnica (QA_CHECKS) e forza dei primi 3 secondi.",
    video:
      "Carica la versione finita con POST …/concepts/<id>/videos. Il media come in bacheca: un link pubblico (\"https://…/v.mp4\"), {url, type:'video'|'image'}, " +
      "{data:<base64>, mime:'video/mp4'} (anche 'data:video/mp4;base64,…'), oppure multipart/form-data con il file in 'file' (più agent, notes, hookId, status, durationSec). " +
      "Campi: hookId (quale hook usa), durationSec, qa:{mani, prodotto, labiale, testo, audio, ritmo, etichetta: true|false}, notes, status. " +
      "status 'in revisione' (default) manda il concept dal critico; 'bozza' lo carica senza mandarlo. Ogni caricamento è una nuova versione (v1, v2…). " +
      "Limite: su Netlify il body di una richiesta è di circa 6 MB (il base64 pesa un terzo in più): per video più pesanti manda un link pubblico. " +
      "Per GUARDARE un video caricato nell'hub (url che inizia con /api/media/…) aprilo sull'indirizzo dell'hub con il tuo token: header Authorization oppure ?token=<token>.",
    risultati:
      "POST …/videos/<videoId>/results {agent, platform:'tiktok'|'meta'|…, date:'AAAA-MM-GG', spend?, impressions?, hookRate?, holdRate?, ctr?, cpc?, purchases?, revenue?, roas?, notes?}. " +
      "Percentuali da 0 a 100. Stesso video + piattaforma + giorno = aggiorna invece di duplicare (puoi rimandare i numeri del giorno quante volte vuoi). " +
      "Se mancano, roas = revenue / spend.",
    playbook:
      "Il Playbook è la memoria della factory. LEGGILO PRIMA di creare (brief, concept, script, revisioni): GET /api/agent/ugc (playbook) o GET …/learnings. " +
      "SCRIVICI DOPO ogni revisione e ogni risultato, se c'è una lezione vera e riutilizzabile: POST …/learnings {agent, kind, text, strength, evidence?, conceptId?, videoId?}. " +
      `kind: ${LEARNING_KINDS.join(" | ")}. strength 'ipotesi' finché non lo dicono i numeri; quando i numeri lo confermano, aggiorna a 'provato' (PATCH …/learnings/<id>) con evidence. ` +
      "Una lezione per voce, specifica ('hook a domanda sul dolore alla schiena: hook rate 38% contro 22%'), mai 'il video è venuto bene'. Prima di aggiungere guarda se c'è già: aggiorna invece di duplicare.",
    sveglia:
      `Quando un concept entra in una fase, il bot con quel ruolo riceve una mail di sveglia che lo rimanda a GET ${API}/queue?agent=<id>. ` +
      (settings.autoWake ? "La sveglia automatica è attiva." : "Ora la sveglia automatica è spenta: controlla la tua coda da solo.") +
      " Non serve che svegli tu gli altri: basta spostare la fase.",
    domande:
      "La squadra lavora da sola: decidete voi (il critico è il vostro controllo, il Playbook la vostra memoria). Una domanda a Branko è RARA: solo se senza quella " +
      "risposta fareste un lavoro sbagliato (es. un dato sul prodotto che non trovate da nessuna parte). Non fermatevi ad aspettare: intanto andate avanti sul resto. " +
      `POST ${API}/questions {agent, text, options?:[risposte rapide], conceptId?, briefId?}. Branko la vede negli aggiornamenti live; se risponde vieni svegliato e la risposta ` +
      `è in cima alla tua coda: applicala e chiudi con PATCH ${API}/questions/<id> {agent, chiudi:true}.`,
    annunci:
      "Gli Annunci (POST /api/agent/alerts) sono per Branko e SOLO quando deve decidere o sapere qualcosa oggi. Il sistema avvisa già da solo quando un video è pronto " +
      "o vincente: non duplicare. Niente aggiornamenti di routine.",
    endpoints: {
      [`GET ${API}?agent=<id>`]: "Questa guida + adesso, squadra (e i tuoi ruoli), catena, code per ruolo, brief attivi, concept in corso, Playbook, libreria.",
      [`GET ${API}/queue?agent=<id> | ?role=<ruolo>`]: "Il lavoro da fare, dal più vecchio, con cosa fare e cosa chiamare.",
      [`GET ${API}/briefs?status=attivo`]: "Brief con conteggi (concept, attivi, vincenti, ricerca).",
      [`POST ${API}/briefs`]: "{agent, title, productName, target, problem, promise?, proof?, offer?, objections?, notes?, productId?, productUrl?, angles?:[{text, why?}], status?}",
      [`GET ${API}/briefs/<id>`]: "Brief completo + ricerca + concept.",
      [`PATCH ${API}/briefs/<id>`]: "{agent, …campi da cambiare}. angles si manda completo.",
      [`POST ${API}/briefs/<id>/research`]: `{agent, kind:${RESEARCH_KINDS.map((k) => `'${k}'`).join("|")}, text, url?, source?, why?}. La 'voce cliente' sono frasi VERE di clienti (recensioni, commenti), parola per parola.`,
      [`GET ${API}/concepts?briefId=&stage=&full=1`]: "Concept (compatti; full=1 per i documenti interi).",
      [`POST ${API}/concepts`]: "{agent, briefId, title, angle, format, why?, character?, durationSec?, hooks?:[…], story?:{…}, owner?, stage?:'idea'|'gate'}",
      [`GET ${API}/concepts/<id>`]: "Concept completo: brief, revisioni, video, numeri, lezioni, registro, struttura del format, prossimo passo, avvisi.",
      [`PATCH ${API}/concepts/<id>`]: "{agent, …campi} e/o {agent, stage, note?}. {agent, owner:'<id>'} = lo prendi; owner:null = lo liberi.",
      [`POST ${API}/concepts/<id>/reviews`]: "{agent, verdict, score, scrollStop, good?, fix?:[…], videoId?}",
      [`POST ${API}/concepts/<id>/videos`]: "{agent, media | url | data+mime, hookId?, durationSec?, status?, qa?, notes?, adId?} oppure multipart con 'file'.",
      [`PATCH ${API}/videos/<id>`]: "{agent, hookId?, durationSec?, status?, qa?, notes?, adId?}",
      [`POST ${API}/videos/<id>/results`]: "{agent, platform, date, …numeri}",
      [`GET ${API}/learnings?kind=&strength=&conceptId=`]: "Il Playbook: fissati e provati prima.",
      [`POST ${API}/learnings`]: "{agent, kind, text, strength?, evidence?, conceptId?, videoId?, pinned?}",
      [`PATCH ${API}/learnings/<id>`]: "{agent, …campi} (es. strength:'provato' + evidence).",
      [`POST ${API}/questions`]: "{agent, text, options?:[…], conceptId?, briefId?} — domanda a Branko, RARA (vedi 'domande').",
      [`GET ${API}/questions?agent=<id>&status=`]: "Le tue domande e le risposte di Branko.",
      [`PATCH ${API}/questions/<id>`]: "{agent, chiudi:true} dopo aver applicato la risposta.",
      [`GET ${API}/changes?since=<ms>`]: "Registro: chi ha fatto cosa. Ripassa con since=cursor per restare allineato.",
    },
    valori: {
      fasi: STAGE_IDS.join(" | "),
      verdetti: VERDICTS.join(" | "),
      stati_video: VIDEO_STATUS.join(" | "),
      qa: Object.fromEntries(QA_CHECKS.map((q) => [q.id, q.label])),
      ricerca: RESEARCH_KINDS.join(" | "),
      playbook: LEARNING_KINDS.join(" | "),
      ruoli: ROLES.map((r) => r.id).join(" | "),
    },
    regole: [
      "Scegli format e tipi di hook dalla libreria: non inventarli.",
      "Prima di creare leggi il Playbook; dopo ogni revisione e ogni risultato scrivici la lezione (se c'è).",
      "Prendi il lavoro con owner prima di iniziare; non toccare quello preso da un altro bot.",
      "Il gate è un giudizio vero: meglio un 'da rifare' oggi che un video inutile domani.",
      "Non cancellare né riscrivere il lavoro di Branko ('by':'tu') o di altri bot senza motivo: correggi e spiega nella note.",
      "Le risposte d'errore sono in italiano e dicono cosa sistemare: leggile e riprova.",
    ],
  };
}
