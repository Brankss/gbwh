"use client";

import { useActionState } from "react";
import { Liquid } from "@/components/liquid";
import { login } from "./actions";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden p-4">
      {/* Mercurio nero, grande, dietro la porta d'ingresso */}
      <Liquid variant="hero" />

      <form action={action} className="card relative w-full max-w-sm space-y-6 p-7 animate-pop">
        <div className="space-y-1.5">
          <h1 className="chrome-text text-4xl font-black tracking-tighter">Bentornato</h1>
          <p className="text-sm text-muted">Il tuo hub ti aspetta.</p>
        </div>
        <input
          name="password"
          type="password"
          autoFocus
          required
          autoComplete="current-password"
          placeholder="Password"
          className="field w-full"
        />
        {error && <p className="text-sm text-[#ec8585]">{error}</p>}
        <button disabled={pending} className="chrome btn-primary w-full">
          {pending ? "Entro…" : "Entra"}
        </button>
      </form>
    </main>
  );
}
