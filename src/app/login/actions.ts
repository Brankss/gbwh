"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GUEST_COOKIE, SESSION_COOKIE, filloSessionToken, isFilloPassword, safeEqual, sessionToken } from "@/lib/auth";

export async function login(_prev: string | null, formData: FormData): Promise<string | null> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.APP_PASSWORD;

  if (!expected) return "APP_PASSWORD non è configurata sul server.";

  // Piccolo rallentamento per scoraggiare i tentativi a raffica.
  await new Promise((r) => setTimeout(r, 400));
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 90 };

  // Password ospite: porta alla chat a parte con fillobot, senza accesso all'hub.
  if (!safeEqual(password, expected) && (await isFilloPassword(password))) {
    const jar = await cookies();
    jar.delete(SESSION_COOKIE);
    jar.set(GUEST_COOKIE, (await filloSessionToken())!, options);
    redirect("/fillo");
  }
  if (!safeEqual(password, expected)) return "Password sbagliata.";

  (await cookies()).set(SESSION_COOKIE, (await sessionToken())!, options);
  redirect("/");
}
