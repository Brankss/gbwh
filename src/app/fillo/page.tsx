"use client";

import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/actions";
import { Icon } from "@/components/icons";
import { useAutosize } from "@/components/ui";
import { send, useApi } from "@/lib/client";

// La chat a parte con fillobot: una pagina sola, niente del resto dell'hub.

type Msg = { id: string; from: "user" | "bot"; text: string; ts: number };
type Data = { messages: Msg[]; readAt: number; wokeAt: number; wake: boolean };

const KEY = "/api/fillo";
const time = (ts: number) => new Date(ts).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

export default function FilloPage() {
  const { data, mutate } = useApi<Data>(KEY, { refreshInterval: 4000 });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  useAutosize(box, text, 160);

  const messages = data?.messages ?? [];
  const last = messages[messages.length - 1];
  // In fondo a ogni messaggio nuovo.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const submit = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      await send("POST", KEY, { text: value });
      setText("");
      await mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Non inviato, riprova");
    }
    setBusy(false);
    box.current?.focus();
  };

  // Sotto l'ultimo tuo messaggio: a che punto è fillobot.
  const status =
    last?.from === "user" && data
      ? data.readAt > last.ts
        ? "Letto · sta rispondendo"
        : data.wokeAt >= last.ts - 1000 || data.wokeAt > data.readAt
          ? "Inviato · fillobot è stato svegliato"
          : "Inviato"
      : null;

  return (
    <main className="mx-auto flex h-dvh w-full max-w-2xl flex-col">
      <header className="glass flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
        <span className="orb grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold">F</span>
        <div className="min-w-0 flex-1">
          <h1 className="chrome-text truncate text-lg leading-tight font-bold tracking-tight">fillobot</h1>
          <p className="truncate text-xs text-muted">La tua chat privata</p>
        </div>
        <form action={logout}>
          <button aria-label="Esci" title="Esci" className="press grid size-9 place-items-center rounded-full text-muted hover:bg-white/[0.07] hover:text-fg">
            <Icon name="logout" className="size-[18px]" />
          </button>
        </form>
      </header>

      <div className="scroll-thin flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-4">
        {!data ? (
          <div className="skeleton h-24 rounded-2xl" />
        ) : messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center">
            <div className="space-y-2">
              <span className="orb blob mx-auto grid size-16 place-items-center text-xl font-bold">F</span>
              <p className="font-semibold">Scrivi a fillobot</p>
              <p className="mx-auto max-w-xs text-sm text-muted">Quando mandi un messaggio viene avvisato e ti risponde qui. Può volerci qualche minuto.</p>
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed break-words whitespace-pre-wrap ${
                  m.from === "user" ? "rounded-br-md bg-white/[0.12]" : "rounded-bl-md border border-white/[0.08] bg-white/[0.03]"
                }`}
              >
                {m.text}
                <span className="mt-0.5 block text-right text-[10px] text-muted tabular-nums">{time(m.ts)}</span>
              </div>
            </div>
          ))
        )}
        {status && <p className="pr-1 text-right text-[11px] text-muted">{status}</p>}
        <div ref={end} />
      </div>

      <div className="composer-dock px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {error && <p className="px-2 pb-1.5 text-sm text-danger">{error}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex items-end gap-2 rounded-3xl border border-white/10 bg-white/[0.04] py-1.5 pr-1.5 pl-4"
        >
          <textarea
            ref={box}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Invio manda (su computer); Maiusc+Invio va a capo.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
                e.preventDefault();
                void submit();
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder="Scrivi a fillobot…"
            aria-label="Messaggio"
            className="max-h-40 min-h-9 flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-[#6a6a6a]"
          />
          <button type="submit" disabled={!text.trim() || busy} aria-label="Invia" className="press chrome grid size-9 shrink-0 place-items-center rounded-full disabled:opacity-40">
            <Icon name="forward" className="size-4" />
          </button>
        </form>
      </div>
    </main>
  );
}
