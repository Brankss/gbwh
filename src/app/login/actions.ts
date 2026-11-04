"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, safeEqual, sessionToken } from "@/lib/auth";

export async function login(_prev: string | null, formData: FormData): Promise<string | null> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.APP_PASSWORD;

  if (!expected) return "APP_PASSWORD non è configurata sul server.";

  // Piccolo rallentamento per scoraggiare i tentativi a raffica.
  await new Promise((r) => setTimeout(r, 400));
  if (!safeEqual(password, expected)) return "Password sbagliata.";

  (await cookies()).set(SESSION_COOKIE, (await sessionToken())!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  redirect("/");
}
