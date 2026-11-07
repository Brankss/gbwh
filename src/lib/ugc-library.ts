// Libreria creativa della UGC Factory: i format e i tipi di hook da cui gli agent SCELGONO
// (niente format inventati a caso). Gli id sono stabili: li salvano i concept.
// Contenuto in italiano, pensato per insegnare il "gusto" pubblicitario, non solo la teoria.

export type Format = {
  id: string;
  name: string;
  /** Quando usarlo (tipo di prodotto, livello di consapevolezza del pubblico). */
  when: string;
  /** Struttura del video, beat per beat. */
  structure: string[];
  /** Un esempio concreto, raccontato come lo vedresti. */
  example: string;
  /** Errori che lo rovinano. */
  pitfalls: string[];
};

export type HookType = {
  id: string;
  name: string;
  /** Cosa fa scattare nella testa di chi scrolla. */
  why: string;
  examples: string[];
};

export const FORMATS: Format[] = [
  { id: "problema_soluzione", name: "Problema → soluzione", when: "", structure: [], example: "", pitfalls: [] },
  { id: "prima_dopo", name: "Prima / dopo", when: "", structure: [], example: "", pitfalls: [] },
  { id: "testimonianza", name: "Testimonianza", when: "", structure: [], example: "", pitfalls: [] },
  { id: "confronto", name: "Confronto / test", when: "", structure: [], example: "", pitfalls: [] },
  { id: "sfida", name: "Sfida", when: "", structure: [], example: "", pitfalls: [] },
  { id: "tre_motivi", name: "3 motivi", when: "", structure: [], example: "", pitfalls: [] },
  { id: "reazione", name: "Unboxing / reazione", when: "", structure: [], example: "", pitfalls: [] },
  { id: "pov", name: "POV", when: "", structure: [], example: "", pitfalls: [] },
  { id: "contrarian", name: "Contrarian", when: "", structure: [], example: "", pitfalls: [] },
  { id: "demo_asmr", name: "Demo / ASMR", when: "", structure: [], example: "", pitfalls: [] },
  { id: "storia", name: "Mini storia", when: "", structure: [], example: "", pitfalls: [] },
  { id: "esperimento", name: "Esperimento", when: "", structure: [], example: "", pitfalls: [] },
];

export const HOOK_TYPES: HookType[] = [
  { id: "problema", name: "Problema", why: "", examples: [] },
  { id: "contrarian", name: "Contrarian", why: "", examples: [] },
  { id: "curiosita", name: "Curiosità", why: "", examples: [] },
  { id: "risultato", name: "Risultato", why: "", examples: [] },
  { id: "prova_sociale", name: "Prova sociale", why: "", examples: [] },
  { id: "pov", name: "POV / scenario", why: "", examples: [] },
  { id: "domanda", name: "Domanda diretta", why: "", examples: [] },
  { id: "shock_visivo", name: "Interruzione visiva", why: "", examples: [] },
  { id: "sfida", name: "Sfida", why: "", examples: [] },
  { id: "storia", name: "Inizio di storia", why: "", examples: [] },
  { id: "confronto", name: "Confronto", why: "", examples: [] },
  { id: "asmr", name: "Sensoriale / ASMR", why: "", examples: [] },
];

/** Il "gusto": regole pratiche che separano un ad che ferma lo scroll da uno showcase noioso. */
export const PRINCIPLES: { title: string; text: string }[] = [];

/** Griglia del critico: domande a cui rispondere prima di approvare (peso = quanto conta sul voto). */
export type RubricItem = { id: string; question: string; weight: number; stage: "gate" | "revisione" | "entrambi" };
export const REVIEW_RUBRIC: RubricItem[] = [];

/** Regole per scrivere script che l'AI riesce a girare bene (scene, battute, labiale). */
export const SCRIPT_RULES: string[] = [];

export const formatOf = (id: string) => FORMATS.find((f) => f.id === id);
export const hookTypeOf = (id: string) => HOOK_TYPES.find((h) => h.id === id);
