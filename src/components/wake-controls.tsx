"use client";

import { useState } from "react";
import { ago, send, useApi } from "@/lib/client";
import type { WakeLog } from "@/lib/wake";

type Status = { configured: boolean; address: string | null; bots: Record<string, WakeLog> };

const KEY = "/api/wake";

function useWake() {
  return useApi<Status>(KEY, { refreshInterval: 30_000 });
}

/** Riga sotto il nome del bot: quando è stato svegliato l'ultima volta, o perché non ci si è riusciti. */
export function WakeLine({ botId }: { botId: string }) {
  const { data } = useWake();
  const log = data?.bots[botId];
  if (!data?.configured || !log) return null;
  if (log.result === "failed") {
    return (
      <div className="truncate text-[11px] text-[#ec8585]" title={log.error}>
        ⚡ sveglia non riuscita · {log.error}
      </div>
    );
  }
  return <div className="truncate text-[11px] text-muted">⚡ svegliato via email {ago(log.at)}</div>;
}

/** Pulsante ⚡: sveglia subito il bot (ignora l'anti-raffica). */
export function WakeButton({ botId, name }: { botId: string; name: string }) {
  const { data } = useWake();
  const [state, setState] = useState<"idle" | "busy" | "ok" | "err">("idle");
  if (!data?.configured) return null;

  const wake = async () => {
    setState("busy");
    try {
      await send("POST", KEY, { bot: botId }, [KEY]);
      setState("ok");
    } catch {
      setState("err");
    }
    setTimeout(() => setState("idle"), 2500);
  };

  return (
    <button
      onClick={wake}
      disabled={state === "busy"}
      title={`Sveglia ${name} adesso via email`}
      aria-label={`Sveglia ${name}`}
      className="press ml-auto flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-3 text-xs font-medium text-[#b4b4b4] hover:border-white/25 hover:bg-white/[0.05] hover:text-fg disabled:opacity-50"
    >
      <span aria-hidden>⚡</span>
      {state === "busy" ? "Sveglio…" : state === "ok" ? "Inviata" : state === "err" ? "Errore" : "Sveglia"}
    </button>
  );
}

/** In fondo alla lista dei bot: la sveglia email è configurata? Pulsante per provarla. */
export function WakeSettings() {
  const { data } = useWake();
  const [test, setTest] = useState<{ ok: boolean; error?: string } | "busy" | null>(null);
  if (!data) return null;

  const run = async () => {
    setTest("busy");
    const res = await fetch(`${KEY}/test`, { method: "POST" });
    setTest(await res.json().catch(() => ({ ok: false, error: "Risposta non valida" })));
  };

  return (
    <div className="mx-3 mt-4 mb-2 space-y-1.5 matte rounded-2xl [html[data-nf-badge]_&]:mb-16 px-3 py-2.5 text-xs text-muted">
      <div className="flex items-center gap-2">
        <span aria-hidden>⚡</span>
        <span className="flex-1">
          Sveglia email: {data.configured ? <span className="text-fg">attiva</span> : "non configurata"}
        </span>
        {data.configured && (
          <button onClick={run} disabled={test === "busy"} className="font-medium text-fg underline-offset-2 hover:underline disabled:opacity-50">
            {test === "busy" ? "Provo…" : "Prova"}
          </button>
        )}
      </div>
      {data.configured && data.address && <div className="truncate font-mono text-[10px]">{data.address}</div>}
      {!data.configured && <div>Aggiungi su Netlify WAKE_EMAIL e le variabili SMTP (vedi README).</div>}
      {test && test !== "busy" && (
        <div className={test.ok ? "text-fg" : "text-[#ec8585]"}>{test.ok ? "✓ Server di posta raggiungibile e credenziali ok." : `✕ ${test.error}`}</div>
      )}
    </div>
  );
}
