"use client";

import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { logout } from "@/app/actions";
import { BOTS, MAX_TEXT, isBotId, type BotId, type Inbox, type Media, type Message, type Note, type ReadAt } from "@/lib/bots";
import { Notes } from "./notes";
import { Avatar, PinIcon, useAutosize } from "./ui";

type LocalMessage = Message & { pending?: boolean; local?: boolean; failed?: boolean };

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
  const [read, setRead] = useState<ReadAt>({});
  const [viewer, setViewer] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const rev = useRef(-1);

  // Vista aperta: la chat di un bot oppure la bacheca annunci.
  const storedActive = useStored("chat:active");
  const onNotes = storedActive === "notes";
  const active: BotId = isBotId(storedActive) ? storedActive : BOTS[0].id;
  const seenRaw = useStored("chat:seen");
  const lastSeen = useMemo(() => parseSeen(seenRaw), [seenRaw]);

  const toLogin = useCallback(() => router.replace("/login"), [router]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages?rev=${rev.current}`, { cache: "no-store" });
      if (res.status === 401) return toLogin();
      if (!res.ok) return;
      const data: { rev: number; inbox?: Inbox; read?: ReadAt; notes?: Note[] } = await res.json();
      rev.current = data.rev;
      if (data.inbox) {
        setLoadedAt((t) => t || Date.now());
        setInbox(data.inbox);
        setRead(data.read ?? {});
        setNotes(data.notes ?? []);
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
    if (!inbox || onNotes || (lastSeen[active] ?? 0) >= newest) return;
    writeStorage("chat:seen", JSON.stringify({ ...lastSeen, [active]: newest }));
  }, [active, newest, inbox, lastSeen, onNotes]);

  const unread = useMemo(() => {
    const out = {} as Record<BotId, number>;
    for (const b of BOTS) {
      const seen = lastSeen[b.id] ?? 0;
      out[b.id] = b.id === active && !onNotes ? 0 : (inbox?.[b.id] ?? []).filter((m) => m.from === "bot" && m.ts > seen).length;
    }
    return out;
  }, [inbox, lastSeen, active, onNotes]);

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);
  useEffect(() => {
    document.title = totalUnread ? `(${totalUnread}) Chat` : "Chat";
  }, [totalUnread]);

  const selectBot = (id: BotId | "notes") => writeStorage("chat:active", id);
  const forceRefresh = useCallback(() => {
    rev.current = -1;
    refresh();
  }, [refresh]);

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
  // L'agent passa ogni tanto: "letto" = ha scaricato la bacheca dopo il tuo ultimo messaggio.
  const readAt = read[active] ?? 0;
  const lastMine = messages.findLast((m) => m.from === "me" && !m.pending && !m.failed);
  const awaitingReply = !!last && last === lastMine;
  const agentRead = awaitingReply && readAt >= last.ts;
  const status = agentRead ? "ha letto, sta rispondendo…" : awaitingReply ? "in attesa che passi a leggere" : "agent";

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Sidebar desktop */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex items-center justify-between px-5 pt-6 pb-4">
          <h1 className="text-lg font-semibold tracking-tight">Chat</h1>
          <LogoutButton />
        </div>
        <nav className="flex flex-col gap-1 px-3">
          <button
            onClick={() => selectBot("notes")}
            className={`mb-2 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
              onNotes ? "gloss" : "border border-transparent hover:bg-surface-2"
            }`}
          >
            <Avatar name="Annunci" size={40}>
              <PinIcon />
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="font-medium">Annunci</div>
              <p className="truncate text-sm text-muted">
                {notes?.length ? `${notes.length} ${notes.length === 1 ? "nota" : "note"} in bacheca` : "Bacheca per i bot"}
              </p>
            </div>
          </button>
          {BOTS.map((b) => {
            const lastMsg = inbox?.[b.id]?.at(-1);
            const selected = b.id === active && !onNotes;
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
                      {lastMsg ? `${lastMsg.from === "me" ? "Tu: " : ""}${preview(lastMsg)}` : "Nessun messaggio"}
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
                    b.id === active && !onNotes ? "gloss" : "border border-transparent text-muted"
                  }`}
                >
                  <span className="max-[380px]:hidden">
                    <Avatar name={b.name} size={20} />
                  </span>
                  {b.name}
                  {unread[b.id] > 0 && (
                    <span className="absolute top-1 right-1.5 size-2 rounded-full bg-white shadow-[0_0_6px_rgb(255_255_255/0.6)]" />
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => selectBot("notes")}
              aria-label="Annunci"
              title="Annunci"
              className={`grid size-9 shrink-0 place-items-center rounded-full transition-colors ${
                onNotes ? "gloss" : "text-muted hover:bg-surface-2 hover:text-fg"
              }`}
            >
              <PinIcon className="size-4.5" />
            </button>
            <LogoutButton />
          </div>
          <div className="hidden items-center gap-3 px-6 py-3.5 md:flex">
            {onNotes ? (
              <>
                <Avatar name="Annunci" size={36}>
                  <PinIcon />
                </Avatar>
                <div>
                  <div className="font-medium leading-tight">Annunci</div>
                  <div className="text-xs text-muted">per ogni nota scegli quali bot possono leggerla</div>
                </div>
              </>
            ) : (
              <>
                <Avatar name={bot.name} size={36} />
                <div>
                  <div className="font-medium leading-tight">{bot.name}</div>
                  <div className="text-xs text-muted">{status}</div>
                </div>
              </>
            )}
          </div>
        </header>

        {onNotes ? (
          <Notes notes={notes} onChanged={forceRefresh} />
        ) : (
          <>

        <MessageList
          key={active}
          messages={messages}
          botName={bot.name}
          loading={!inbox}
          animateAfter={loadedAt}
          lastMineId={lastMine?.id}
          lastMineRead={!!lastMine && readAt >= lastMine.ts}
          typingSince={agentRead ? readAt : 0}
          onRetry={retry}
          onOpenImage={setViewer}
        />

        <Composer key={`c-${active}`} name={bot.name} onSend={(t) => send(active, t)} />
          </>
        )}
      </main>

      {viewer && <Lightbox src={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const MessageList = memo(function MessageList({
  messages,
  botName,
  loading,
  animateAfter,
  lastMineId,
  lastMineRead,
  typingSince,
  onRetry,
  onOpenImage,
}: {
  messages: LocalMessage[];
  botName: string;
  loading: boolean;
  animateAfter: number;
  lastMineId?: string;
  lastMineRead: boolean;
  typingSince: number;
  onRetry: (m: LocalMessage) => void;
  onOpenImage: (src: string) => void;
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
  }, [messages, loading, typingSince]);

  // Foto e video cambiano altezza quando caricano: se eri in fondo, ci resti.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMediaLoad = () => stick.current && el.scrollTo({ top: el.scrollHeight });
    el.addEventListener("load", onMediaLoad, true);
    el.addEventListener("loadedmetadata", onMediaLoad, true);
    return () => {
      el.removeEventListener("load", onMediaLoad, true);
      el.removeEventListener("loadedmetadata", onMediaLoad, true);
    };
  }, []);

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
                  showTime={!groupedWithNext || m.id === lastMineId}
                  receipt={m.id === lastMineId ? (lastMineRead ? "Letto" : "Inviato") : undefined}
                  onRetry={onRetry}
                  onOpenImage={onOpenImage}
                />
              </div>
            );
          })
        )}
        {typingSince > 0 && <Typing key={typingSince} since={typingSince} />}
      </div>
    </div>
  );
});

function Bubble({
  message: m,
  animate,
  tight,
  showTime,
  receipt,
  onRetry,
  onOpenImage,
}: {
  message: LocalMessage;
  animate: boolean;
  tight: boolean;
  showTime: boolean;
  receipt?: "Inviato" | "Letto";
  onRetry: (m: LocalMessage) => void;
  onOpenImage: (src: string) => void;
}) {
  const mine = m.from === "me";
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"} ${tight ? "mt-0.5" : "mt-3"} ${animate ? "animate-pop" : ""}`}>
      {m.media?.map((item, i) => (
        <MediaItem key={i} media={item} mine={mine} onOpenImage={onOpenImage} />
      ))}
      {m.text && (
        <div
          className={`max-w-[85%] whitespace-pre-wrap break-words px-3.5 py-2 text-[15px] leading-relaxed md:max-w-[70%] ${
            mine ? "gloss rounded-[1.25rem] rounded-br-md" : "matte rounded-[1.25rem] rounded-bl-md"
          } ${m.media?.length ? "mt-1" : ""} ${m.pending ? "opacity-60" : ""} ${m.failed ? "opacity-70 ring-1 ring-red-500/60" : ""} transition-opacity`}
        >
          {m.text}
        </div>
      )}
      {m.failed ? (
        <button onClick={() => onRetry(m)} className="mt-1 text-xs text-red-500 hover:underline">
          Non consegnato · Riprova
        </button>
      ) : (
        showTime && (
          <span className="mt-1 px-1 text-[11px] text-muted">
            {m.pending ? "Invio…" : formatTime(m.ts)}
            {receipt && <span className={receipt === "Letto" ? "text-fg" : ""}> · {receipt === "Letto" ? "Letto ✓✓" : "Inviato ✓"}</span>}
          </span>
        )
      )}
    </div>
  );
}

function MediaItem({ media, mine, onOpenImage }: { media: Media; mine: boolean; onOpenImage: (src: string) => void }) {
  const [broken, setBroken] = useState(false);
  const frame = `matte mt-1 overflow-hidden rounded-[1.25rem] ${mine ? "rounded-br-md" : "rounded-bl-md"}`;

  if (broken) {
    return (
      <a href={media.url} target="_blank" rel="noreferrer" className={`${frame} px-3.5 py-2 text-sm text-muted underline`}>
        {media.type === "video" ? "🎬 Video non disponibile" : "📷 Foto non disponibile"} · apri link
      </a>
    );
  }

  if (media.type === "video") {
    return (
      <div className={`${frame} max-w-[min(85%,22rem)]`}>
        <video
          src={media.url}
          controls
          playsInline
          preload="metadata"
          onError={() => setBroken(true)}
          className="block max-h-[60dvh] w-auto max-w-full bg-black"
        />
      </div>
    );
  }

  return (
    <button type="button" onClick={() => onOpenImage(media.url)} className={`${frame} block max-w-[min(85%,22rem)] cursor-zoom-in`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- link esterni arbitrari, next/image non serve qui */}
      <img
        src={media.url}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="block max-h-[60dvh] min-h-24 w-auto min-w-24 object-cover transition-opacity hover:opacity-90"
      />
    </button>
  );
}

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal
      onClick={onClose}
      className="fixed inset-0 z-40 grid cursor-zoom-out place-items-center bg-black/90 p-4 backdrop-blur-md animate-pop"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" referrerPolicy="no-referrer" className="max-h-[92dvh] max-w-full rounded-2xl object-contain" />
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="gloss absolute top-4 right-4 rounded-full px-3.5 py-1.5 text-sm"
      >
        Apri originale
      </a>
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

  useAutosize(ref, text);

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

function preview(m: Message) {
  if (m.text) return m.text;
  const videos = m.media?.filter((x) => x.type === "video").length ?? 0;
  const photos = (m.media?.length ?? 0) - videos;
  if (videos && !photos) return videos > 1 ? `🎬 ${videos} video` : "🎬 Video";
  if (photos && !videos) return photos > 1 ? `📷 ${photos} foto` : "📷 Foto";
  return "📎 Allegati";
}

function formatShort(ts: number) {
  return sameDay(ts, Date.now()) ? timeFmt.format(ts) : dateFmt.format(ts);
}

function formatDay(ts: number) {
  if (sameDay(ts, Date.now())) return "Oggi";
  if (sameDay(ts, Date.now() - 86_400_000)) return "Ieri";
  return longDateFmt.format(ts);
}
