// Config pubblica dei bot: niente segreti qui, questo file finisce anche nel browser.
export const BOTS = [
  { id: "berlu", name: "Berlusc" },
  { id: "syrup", name: "Syrup" },
  { id: "aurelio", name: "Aurelio" },
] as const;

export type BotId = (typeof BOTS)[number]["id"];

export const BOT_IDS = BOTS.map((b) => b.id) as BotId[];

export function isBotId(value: unknown): value is BotId {
  return typeof value === "string" && (BOT_IDS as string[]).includes(value);
}

export type Message = {
  id: string;
  bot: BotId;
  from: "me" | "bot";
  text: string;
  ts: number;
  failed?: boolean;
};

export type Inbox = Record<BotId, Message[]>;

export const MAX_TEXT = 4000;
