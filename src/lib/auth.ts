// Usato sia dal proxy che dalle server action: solo Web Crypto, niente API Node.
export const SESSION_COOKIE = "gbwh_session";

/** Valore del cookie di sessione: hash della password, così se la cambi tutti vengono sloggati. */
export async function sessionToken(): Promise<string | null> {
  const password = process.env.APP_PASSWORD;
  if (!password) return null;
  const data = new TextEncoder().encode(`gbwh-session:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Confronto a tempo costante per non regalare info con i timing. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ---------- Ospite: la chat a parte con fillobot ---------- */

export const GUEST_COOKIE = "gbwh_fillo";
/** Hash della password ospite (il repo è pubblico: la password in chiaro non ci sta). FILLO_PASSWORD la sostituisce. */
const FILLO_HASH = "7842877cfaefb38ce24b456dfb2b42c6a01015d047094f10ff5cdb0095aa6849";

async function sha256(text: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isFilloPassword(password: string): Promise<boolean> {
  const custom = process.env.FILLO_PASSWORD?.trim();
  if (custom) return safeEqual(password, custom);
  return safeEqual(await sha256(`gbwh-fillo-pw:${password}`), FILLO_HASH);
}

/** Cookie dell'ospite: vale solo per /fillo, mai per l'hub. */
export async function filloSessionToken(): Promise<string | null> {
  const main = process.env.APP_PASSWORD;
  if (!main) return null;
  return sha256(`gbwh-fillo-session:${main}:${process.env.FILLO_PASSWORD?.trim() || FILLO_HASH}`);
}

/** Token di fillobot: apre solo la sua chat, niente bacheca, calendario o altro dell'hub. */
export async function filloBotToken(): Promise<string | null> {
  const secret = process.env.INBOUND_SECRET;
  if (!secret) return null;
  return (await sha256(`gbwh-fillo-bot:${secret}`)).slice(0, 40);
}
