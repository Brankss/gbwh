"use client";

import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { logout } from "@/app/actions";
import { BOTS, MAX_TEXT, isBotId, type BotId, type Inbox, type Message } from "@/lib/bots";

type LocalMessage = Message & { pending?: boolean; local?: boolean };

const POLL_MS = 2000;
const WAIT_REPLY_MS = 90_000;
const GROUP_MS = 3 * 60_000;

const botById = (id: BotId) => BOTS.find((b) => b.id === id)!;

// Mini store su localStorage (preferenze per dispositivo), letto con useSyncExternalStore.
const storageListeners = new Set<() => void>();
function subscribeStorage(cb: () => void) {
  storageListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    storageListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
  storageListeners.forEach((cb) => cb());
}
function useStored(key: string) {
  return useSyncExternalStore(subscribeStorage, () => readStorage(key), () => null);
}
function parseSeen(raw: string | null): Partial<Record<BotId, number>> {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function Chat() {
  const router = useRouter();
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [pending, setPending] = useState<LocalMessage[]>([]);
  const [loadedAt, setLoadedAt] = useState(0);
  const rev = useRef(-1);

  const storedActive = useStored("chat:active");
  const active: BotId = isBotId(storedActive) ? storedActive : BOTS[0].id;
  const seenRaw = useStored("chat:seen");
  const lastSeen = useMemo(() => parseSeen(seenRaw), [seenRaw]);

  const toLogin = useCallback(() => router.replace("/login"), [router]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages?rev=${rev.current}`, { cache: "no-store" });
      if (res.status === 401) return toLogin();
      if (!res.ok) return;
      const data: { rev: number; inbox?: Inbox } = await res.json();
      rev.current = data.rev;
      if (data.inbox) {
        setLoadedAt((t) => t || Date.now());
        setInbox(data.inbox);
      }
    } catch {
      // Rete ballerina: riproviamo al prossimo giro.
    }
  }, [toLogin]);

  // Polling solo quando la tab è visibile; appena torni sulla tab aggiorna subito.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const loop = async () => {
      if (document.visibilityState === "visible") await refresh();
      if (!stopped) timer = setTimeout(loop, POLL_MS);
    };
    const onVisible = () => document.visibilityState === "visible" && refresh();
    loop();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const messages = useMemo(() => {
    const list: LocalMessage[] = [...(inbox?.[active] ?? []), ...pending.filter((m) => m.bot === active)];
    return list.sort((a, b) => a.ts - b.ts);
  }, [inbox, pending, active]);

  // Segna come letta la chat aperta.
  const newest = messages.at(-1)?.ts ?? 0;
  useEffect(() => {
    if (!inbox || (lastSeen[active] ?? 0) >= newest) return;
    writeStorage("chat:seen", JSON.stringify({ ...lastSeen, [active]: newest }));
  }, [active, newest, inbox, lastSeen]);

  const unread = useMemo(() => {
    const out = {} as Record<BotId, number>;
    for (const b of BOTS) {
      const seen = lastSeen[b.id] ?? 0;
      out[b.id] = b.id === active ? 0 : (inbox?.[b.id] ?? []).filter((m) => m.from === "bot" && m.ts > seen).length;
    }
    return out;
  }, [inbox, lastSeen, active]);

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);
  useEffect(() => {
    document.title = totalUnread ? `(${totalUnread}) Chat` : "Chat";
  }, [totalUnread]);

  const selectBot = (id: BotId) => writeStorage("chat:active", id);

  const send = useCallback(
    async (bot: BotId, text: string) => {
      const temp: LocalMessage = { id: `tmp-${crypto.randomUUID()}`, bot, from: "me", text, ts: Date.now(), pending: true, local: true };
      setPending((p) => [...p, temp]);
      try {
        const res = await fetch("/api/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bot, text }),
        });
        if (res.status === 401) return toLogin();
        const data: { message?: Message } = await res.json();
        const saved = data.message;
        if (!saved) throw new Error("risposta non valida");
        // Il messaggio ora è salvato sul server: lo mettiamo subito in lista senza aspettare il polling.
        setInbox((prev) =>
          prev && !prev[bot].some((m) => m.id === saved.id) ? { ...prev, [bot]: [...prev[bot], saved] } : prev,
        );
        setPending((p) => p.filter((m) => m.id !== temp.id));
      } catch {
        setPending((p) => p.map((m) => (m.id === temp.id ? { ...m, pending: false, failed: true } : m)));
      }
    },
    [toLogin],
  );

  const retry = useCallback(
    (msg: LocalMessage) => {
      if (msg.local) setPending((p) => p.filter((m) => m.id !== msg.id));
      send(msg.bot, msg.text);
    },
    [send],
  );

  const bot = botById(active);
  const last = messages.at(-1);
  const waiting = !!last && last.from === "me" && !last.failed && !last.pending;

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Sidebar desktop */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex items-center justify-between px-5 pt-6 pb-4">
          <h1 className="text-lg font-semibold tracking-tight">Chat</h1>
          <LogoutButton />
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {BOTS.map((b) => {
            const lastMsg = inbox?.[b.id]?.at(-1);
            const selected = b.id === active;
            return (
              <button
                key={b.id}
                onClick={() => selectBot(b.id)}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                  selected ? "gloss" : "border border-transparent hover:bg-surface-2"
                }`}
              >
                <Avatar name={b.name} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{b.name}</span>
                    {lastMsg && <span className="text-[11px] text-muted">{formatShort(lastMsg.ts)}</span>}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm text-muted">
                      {lastMsg ? `${lastMsg.from === "me" ? "Tu: " : ""}${lastMsg.text}` : "Nessun messaggio"}
                    </p>
                    {unread[b.id] > 0 && <Badge count={unread[b.id]} />}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="border-b border-line bg-bg/80 backdrop-blur-xl">
          <div className="flex items-center gap-2 p-2 md:hidden">
            <div className="matte flex flex-1 gap-1 rounded-2xl p-1">
              {BOTS.map((b) => (
                <button
                  key={b.id}
                  onClick={() => selectBot(b.id)}
                  className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-1.5 text-sm font-medium transition-all ${
                    b.id === active ? "gloss" : "border border-transparent text-muted"
                  }`}
                >
                  <Avatar name={b.name} size={20} />
                  {b.name}
                  {unread[b.id] > 0 && (
                    <span className="absolute top-1 right-1.5 size-2 rounded-full bg-white shadow-[0_0_6px_rgb(255_255_255/0.6)]" />
                  )}
                </button>
              ))}
            </div>
            <LogoutButton />
          </div>
          <div className="hidden items-center gap-3 px-6 py-3.5 md:flex">
            <Avatar name={bot.name} size={36} />
            <div>
              <div className="font-medium leading-tight">{bot.name}</div>
              <div className="text-xs text-muted">{waiting ? "sta rispondendo…" : "bot"}</div>
            </div>
          </div>
        </header>

        <MessageList
          key={active}
          messages={messages}
          botName={bot.name}
          loading={!inbox}
          animateAfter={loadedAt}
          waitingSince={waiting ? last!.ts : 0}
          onRetry={retry}
        />

        <Composer key={`c-${active}`} name={bot.name} onSend={(t) => send(active, t)} />
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const MessageList = memo(function MessageList({
  messages,
  botName,
  loading,
  animateAfter,
  waitingSince,
  onRetry,
}: {
  messages: LocalMessage[];
  botName: string;
  loading: boolean;
  animateAfter: number;
  waitingSince: number;
  onRetry: (m: LocalMessage) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const stick = useRef(true);

  // Resta incollato in fondo se ci sei già; al primo render salta giù senza animazione.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || loading) return;
    const mine = messages.at(-1)?.from === "me";
    if (first.current || stick.current || mine) {
      el.scrollTo({ top: el.scrollHeight, behavior: first.current ? "instant" : "smooth" });
    }
    first.current = false;
  }, [messages, loading, waitingSince]);

  const onScroll = () => {
    const el = ref.current!;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  return (
    <div ref={ref} onScroll={onScroll} className="scroll-thin flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-end px-4 py-6 md:px-6">
        {loading ? (
          <Skeleton />
        ) : messages.length === 0 ? (
          <div className="m-auto flex flex-col items-center gap-3 text-center animate-pop">
            <Avatar name={botName} size={64} />
            <p className="text-muted">Scrivi qualcosa a {botName} ✨</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const newDay = !prev || !sameDay(prev.ts, m.ts);
            const groupedWithPrev = !newDay && prev?.from === m.from && m.ts - prev.ts < GROUP_MS;
            const groupedWithNext = !!next && next.from === m.from && next.ts - m.ts < GROUP_MS && sameDay(next.ts, m.ts);
            return (
              <div key={m.id}>
                {newDay && <DaySeparator ts={m.ts} />}
                <Bubble
                  message={m}
                  animate={m.ts > animateAfter}
                  tight={groupedWithPrev}
                  showTime={!groupedWithNext}
                  onRetry={onRetry}
                />
              </div>
            );
          })
        )}
        {waitingSince > 0 && <Typing key={waitingSince} since={waitingSince} />}
      </div>
    </div>
  );
});

function Bubble({
  message: m,
  animate,
  tight,
  showTime,
  onRetry,
}: {
  message: LocalMessage;
  animate: boolean;
  tight: boolean;
  showTime: boolean;
  onRetry: (m: LocalMessage) => void;
}) {
  const mine = m.from === "me";
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"} ${tight ? "mt-0.5" : "mt-3"} ${animate ? "animate-pop" : ""}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap break-words px-3.5 py-2 text-[15px] leading-relaxed md:max-w-[70%] ${
          mine ? "gloss rounded-[1.25rem] rounded-br-md" : "matte rounded-[1.25rem] rounded-bl-md"
        } ${m.pending ? "opacity-60" : ""} ${m.failed ? "opacity-70 ring-1 ring-red-500/60" : ""} transition-opacity`}
      >
        {m.text}
      </div>
      {m.failed ? (
        <button onClick={() => onRetry(m)} className="mt-1 text-xs text-red-500 hover:underline">
          Non consegnato · Riprova
        </button>
      ) : (
        showTime && <span className="mt-1 px-1 text-[11px] text-muted">{m.pending ? "Invio…" : formatTime(m.ts)}</span>
      )}
    </div>
  );
}

function Typing({ since }: { since: number }) {
  // Il genitore lo rimonta (key) a ogni nuovo messaggio, quindi basta il valore iniziale.
  const [visible, setVisible] = useState(() => Date.now() - since < WAIT_REPLY_MS);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), WAIT_REPLY_MS - (Date.now() - since));
    return () => clearTimeout(t);
  }, [since]);
  if (!visible) return null;
  return (
    <div className="mt-3 flex animate-pop">
      <div className="matte flex gap-1 rounded-[1.25rem] rounded-bl-md px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1.5 rounded-full bg-muted animate-dot" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

function Composer({ name, onSend }: { name: string; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Textarea che cresce col testo (fino a un massimo, poi scrolla).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  useEffect(() => {
    // Su desktop metti subito il focus; su mobile no, sennò ti apre la tastiera a caso.
    if (matchMedia("(pointer: fine)").matches) ref.current?.focus();
  }, []);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
    ref.current?.focus();
  };

  return (
    <div className="px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6 md:pb-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="gloss mx-auto flex max-w-3xl items-end gap-2 rounded-[1.5rem] p-1.5 pl-4 transition-[border-color] focus-within:border-[#3a3a3a]"
      >
        <textarea
          ref={ref}
          rows={1}
          value={text}
          maxLength={MAX_TEXT}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && matchMedia("(pointer: fine)").matches) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={`Scrivi a ${name}…`}
          aria-label={`Messaggio per ${name}`}
          className="scroll-thin max-h-[200px] flex-1 resize-none bg-transparent py-2 text-[15px] leading-relaxed outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Invia"
          className="orb grid size-9 shrink-0 place-items-center rounded-full transition-all enabled:hover:brightness-150 enabled:active:scale-90 disabled:scale-90 disabled:opacity-30"
        >
          <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Avatar({ name, size }: { name: string; size: number }) {
  return (
    <span
      aria-hidden
      className="orb grid shrink-0 place-items-center rounded-full font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name[0]}
    </span>
  );
}

function Badge({ count }: { count: number }) {
  return (
    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white px-1.5 text-[11px] font-semibold text-black animate-pop">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function LogoutButton() {
  return (
    <form action={logout}>
      <button
        aria-label="Esci"
        title="Esci"
        className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
        </svg>
      </button>
    </form>
  );
}

function DaySeparator({ ts }: { ts: number }) {
  return (
    <div className="my-4 flex justify-center">
      <span className="matte rounded-full px-3 py-1 text-[11px] font-medium text-muted">{formatDay(ts)}</span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3">
      {["w-48", "ml-auto w-36", "w-64", "ml-auto w-52"].map((w, i) => (
        <div key={i} className={`h-10 animate-pulse rounded-[1.25rem] bg-surface-2 ${w}`} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
const timeFmt = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });
const longDateFmt = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" });

const formatTime = (ts: number) => timeFmt.format(ts);

function formatShort(ts: number) {
  return sameDay(ts, Date.now()) ? timeFmt.format(ts) : dateFmt.format(ts);
}

function formatDay(ts: number) {
  if (sameDay(ts, Date.now())) return "Oggi";
  if (sameDay(ts, Date.now() - 86_400_000)) return "Ieri";
  return longDateFmt.format(ts);
}
