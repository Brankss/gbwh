import { NextResponse, type NextRequest } from "next/server";
import { GUEST_COOKIE, SESSION_COOKIE, filloSessionToken, safeEqual, sessionToken } from "@/lib/auth";

// Tutto il sito è dietro password, tranne il login e l'endpoint dove scrivono i bot.
export async function proxy(request: NextRequest) {
  const expected = await sessionToken();
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;

  if (expected && cookie && safeEqual(cookie, expected)) return NextResponse.next();

  const path = request.nextUrl.pathname;
  // fillobot entra con il suo token, controllato dalla route stessa.
  if (path === "/api/fillo/bot") return NextResponse.next();
  // Ospite (password a parte): vede solo la sua chat con fillobot, nient'altro dell'hub.
  const guest = request.cookies.get(GUEST_COOKIE)?.value;
  const guestExpected = guest ? await filloSessionToken() : null;
  if (guest && guestExpected && safeEqual(guest, guestExpected)) {
    if (path === "/fillo" || path === "/api/fillo") return NextResponse.next();
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    return NextResponse.redirect(new URL("/fillo", request.url));
  }

  // I media caricati nell'hub (/api/media/<id>) si aprono anche col token degli agent:
  // il critico deve poter guardare il video che deve giudicare.
  if (request.method === "GET" && request.nextUrl.pathname.startsWith("/api/media/")) {
    const secret = process.env.INBOUND_SECRET;
    const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.nextUrl.searchParams.get("token") ?? "";
    if (secret && provided && safeEqual(provided, secret)) return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!login|api/board|api/agent|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest).*)"],
};
