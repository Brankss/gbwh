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

      <form action={action} className="card relative w-full max-w-sm space-y-7 p-6 animate-pop sm:p-8">
        <div className="space-y-2">
          <h1 className="chrome-text text-4xl font-black tracking-tighter">Bentornato</h1>
          <p className="text-sm text-muted">Il tuo hub ti aspetta.</p>
        </div>
        <div className="space-y-3">
          <input
            name="password"
            type="password"
            autoFocus
            required
            autoComplete="current-password"
            placeholder="Password"
            aria-label="Password"
            className="field h-12 w-full text-[15px]"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button disabled={pending} className="chrome btn-primary press w-full">
            {pending ? "Entro…" : "Entra"}
          </button>
        </div>
      </form>
    </main>
  );
}
