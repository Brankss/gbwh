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
