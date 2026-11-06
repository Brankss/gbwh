import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, safeEqual, sessionToken } from "@/lib/auth";

// Tutto il sito è dietro password, tranne il login e l'endpoint dove scrivono i bot.
export async function proxy(request: NextRequest) {
  const expected = await sessionToken();
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;

  if (expected && cookie && safeEqual(cookie, expected)) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!login|api/board|api/agent|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest).*)"],
};
