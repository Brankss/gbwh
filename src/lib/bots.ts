// Tipi e config pubblica dei bot: niente segreti qui, questo file finisce anche nel browser.

export type Bot = {
  id: string;
  name: string;
  /** true = creato da solo alla prima risposta di un bot sconosciuto. */
  auto?: boolean;
  createdAt?: number;
};

/** Bot di partenza. Gli altri si aggiungono da soli quando scrivono in bacheca. */
export const DEFAULT_BOTS: Bot[] = [
  { id: "berlu", name: "Berlusc" },
  { id: "syrup", name: "Syrup" },
  { id: "aurelio", name: "Aurelio" },
];

export type BotId = string;

/** Tetto ai bot creati in automatico, per non riempire la home se qualcosa impazzisce. */
export const MAX_BOTS = 50;

/** Trasforma "Mr Black!" in "mr-black": lettere, numeri, - e _, max 32 caratteri. */
export function toBotId(value: unknown): BotId | null {
  if (typeof value !== "string") return null;
  const id = value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  return id || null;
}

/** Nome da mostrare: testo semplice, senza caratteri di controllo, max 40 caratteri. */
export function toBotName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
  return name || null;
}

export type Media = { url: string; type: "image" | "video" };

export type Message = {
  id: string;
  bot: BotId;
  from: "me" | "bot";
  text: string;
  media?: Media[];
  ts: number;
};

export type Inbox = Record<BotId, Message[]>;

/** Annuncio in bacheca: lo leggono solo i bot in `visibleTo` (vuoto = solo tu). */
export type Note = {
  id: string;
  text: string;
  visibleTo: BotId[];
  ts: number;
  updatedAt?: number;
};

/** Per ogni bot: quando l'agent ha letto la bacheca l'ultima volta (timestamp ms). */
export type ReadAt = Record<BotId, number>;

export const MAX_TEXT = 4000;
