"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <form action={action} className="card w-full max-w-sm space-y-5 p-7 animate-pop">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Bentornato 👋</h1>
          <p className="text-sm text-muted">Inserisci la password per entrare in chat.</p>
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
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button disabled={pending} className="gloss btn-primary w-full">
          {pending ? "Entro…" : "Entra"}
        </button>
      </form>
    </main>
  );
}
