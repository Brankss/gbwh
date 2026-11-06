import "server-only";
import type { NextRequest } from "next/server";
import { safeEqual } from "./auth";

/**
 * Accesso degli agent (bot, Hermes…): header `Authorization: Bearer <INBOUND_SECRET>`
 * oppure `?token=<INBOUND_SECRET>`. Restituisce una Response d'errore, o null se ok.
 */
export function agentAuthError(request: NextRequest): Response | null {
  const secret = process.env.INBOUND_SECRET;
  if (!secret) return Response.json({ error: "INBOUND_SECRET non configurato" }, { status: 503 });
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.nextUrl.searchParams.get("token") ?? "";
  return safeEqual(provided, secret) ? null : Response.json({ error: "Non autorizzato" }, { status: 401 });
}

/** Errori di validazione leggibili da un agent: "campo: problema". */
export function zodMessage(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  return error.issues.map((i) => `${i.path.map(String).join(".") || "body"}: ${i.message}`).join("; ");
}
