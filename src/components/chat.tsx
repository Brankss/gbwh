"use client";

import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { DEFAULT_BOTS, MAX_TEXT, type Bot, type BotId, type Inbox, type Media, type Message, type Note, type ReadAt } from "@/lib/bots";
import { Notes } from "./notes";
import { MenuButton } from "./shell";
import { Avatar, PinIcon, useAutosize } from "./ui";
import { WakeButton, WakeLine, WakeSettings } from "./wake-controls";

type LocalMessage = Message & { pending?: boolean; local?: boolean; failed?: boolean };

const POLL_MS = 2000;
const WAIT_REPLY_MS = 90_000;
const GROUP_MS = 3 * 60_000;


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
const DESKTOP_MQ = "(min-width: 768px)";
function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = matchMedia(DESKTOP_MQ);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => matchMedia(DESKTOP_MQ).matches,
    () => true,
  );
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
  const [bots, setBots] = useState<Bot[]>(DEFAULT_BOTS);
  // Su mobile: false = lista chat, true = chat aperta. Su desktop si vedono entrambe.
  const [mobileDetail, setMobileDetail] = useState(false);
  const isDesktop = useIsDesktop();
  const rev = useRef(-1);

  // Vista aperta: la chat di un bot oppure la bacheca annunci.
  const storedActive = useStored("chat:active");
  const onNotes = storedActive === "notes";
  const active: BotId = storedActive && bots.some((b) => b.id === storedActive) ? storedActive : bots[0].id;
  // La chat conta come "aperta" (messaggi letti) solo se la stai guardando davvero.
  const chatOpen = !onNotes && (isDesktop || mobileDetail);
  const seenRaw = useStored("chat:seen");
  const lastSeen = useMemo(() => parseSeen(seenRaw), [seenRaw]);

  const toLogin = useCallback(() => router.replace("/login"), [router]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages?rev=${rev.current}`, { cache: "no-store" });
      if (res.status === 401) return toLogin();
      if (!res.ok) return;
      const data: { rev: number; bots?: Bot[]; inbox?: Inbox; read?: ReadAt; notes?: Note[] } = await res.json();
      rev.current = data.rev;
      if (data.inbox) {
        setLoadedAt((t) => t || Date.now());
        setBots(data.bots?.length ? data.bots : DEFAULT_BOTS);
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
    if (!inbox || !chatOpen || (lastSeen[active] ?? 0) >= newest) return;
    writeStorage("chat:seen", JSON.stringify({ ...lastSeen, [active]: newest }));
  }, [active, newest, inbox, lastSeen, chatOpen]);

  const unread = useMemo(() => {
    const out = {} as Record<BotId, number>;
    for (const b of bots) {
      const seen = lastSeen[b.id] ?? 0;
      out[b.id] = b.id === active && chatOpen ? 0 : (inbox?.[b.id] ?? []).filter((m) => m.from === "bot" && m.ts > seen).length;
    }
    return out;
  }, [inbox, lastSeen, active, chatOpen, bots]);

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);
  useEffect(() => {
    document.title = totalUnread ? `(${totalUnread}) Chat` : "Chat";
  }, [totalUnread]);

  const selectBot = (id: BotId | "notes") => writeStorage("chat:active", id);

  // Apri una chat. Su mobile aggiunge un passo alla cronologia: il tasto indietro torna alla lista.
  const open = (id: BotId | "notes") => {
    selectBot(id);
    if (!isDesktop && !mobileDetail) {
      history.pushState({ chatDetail: true }, "");
      setMobileDetail(true);
    }
  };
  const back = () => {
    if (history.state?.chatDetail) history.back();
    else setMobileDetail(false);
  };
  useEffect(() => {
    const onPop = () => setMobileDetail(!!history.state?.chatDetail);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

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
          prev && !(prev[bot] ?? []).some((m) => m.id === saved.id) ? { ...prev, [bot]: [...(prev[bot] ?? []), saved] } : prev,
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

  const bot = bots.find((b) => b.id === active) ?? { id: active, name: active };
  const last = messages.at(-1);
  // L'agent passa ogni tanto: "letto" = ha scaricato la bacheca dopo il tuo ultimo messaggio.
  const readAt = read[active] ?? 0;
  const lastMine = messages.findLast((m) => m.from === "me" && !m.pending && !m.failed);
  const awaitingReply = !!last && last === lastMine;
  const agentRead = awaitingReply && readAt >= last.ts;
  const status = agentRead ? "ha letto, sta rispondendo…" : awaitingReply ? "in attesa che passi a leggere" : "agent";

  // Bot ordinati per ultima attività (come le chat su WhatsApp); senza messaggi restano in fondo, in ordine.
  const sortedBots = [...bots].sort((a, b) => (inbox?.[b.id]?.at(-1)?.ts ?? 0) - (inbox?.[a.id]?.at(-1)?.ts ?? 0));

  const title = onNotes ? (
    <>
      <Avatar name="Note" size={36}>
        <PinIcon />
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate leading-tight font-semibold">Note per i bot</div>
        <div className="truncate text-xs text-muted">per ogni nota scegli quali bot possono leggerla</div>
      </div>
    </>
  ) : (
    <>
      <Avatar name={bot.name} size={36} />
      <div className="min-w-0 flex-1">
        <div className="truncate leading-tight font-semibold">{bot.name}</div>
        <div className="truncate text-xs text-muted">{status}</div>
        <WakeLine botId={bot.id} />
      </div>
      <WakeButton botId={bot.id} name={bot.name} />
    </>
  );

  // Riga della lista (note o bot): stessa misura e stesso stato "scelto" per tutte.
  const rowCls = (selected: boolean) =>
    `press flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left ${selected ? "bg-white/[0.07]" : "hover:bg-white/[0.035] active:bg-white/[0.05]"}`;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Lista chat: sidebar su desktop, home su mobile */}
      <aside className={`${mobileDetail ? "hidden" : "flex"} w-full flex-col md:flex md:w-80 md:shrink-0 md:border-r md:border-line md:bg-black/30`}>
        <div className="glass flex items-center gap-2 border-b border-line py-3 pr-3 pl-2 md:h-[76px] md:bg-transparent md:px-5 md:py-0 md:backdrop-blur-none">
          <MenuButton />
          <h1 className="chrome-text text-[1.375rem] leading-tight font-bold tracking-[-0.02em] md:text-[1.75rem]">Agenti</h1>
        </div>
        <nav className="scroll-thin flex flex-1 flex-col overflow-y-auto px-2 pt-3 pb-24 md:px-3 md:pb-6">
          <button onClick={() => open("notes")} className={rowCls(onNotes && isDesktop)}>
            <Avatar name="Note" size={44}>
              <PinIcon />
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="font-medium">Note per i bot</div>
              <p className="truncate text-[13px] text-muted">
                {notes?.length ? `${notes.length} ${notes.length === 1 ? "nota" : "note"} in bacheca` : "Bacheca per i bot"}
              </p>
            </div>
          </button>

          <div className="eyebrow mt-6 mb-2 flex items-center justify-between px-2.5">
            <span>Bot</span>
            <span className="tabular-nums">{bots.length}</span>
          </div>

          <div className="flex flex-col gap-0.5">
            {sortedBots.map((b) => {
              const lastMsg = inbox?.[b.id]?.at(-1);
              const selected = b.id === active && !onNotes && isDesktop;
              return (
                <button key={b.id} onClick={() => open(b.id)} className={rowCls(selected)}>
                  <Avatar name={b.name} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium">{b.name}</span>
                      {lastMsg && <span className={`shrink-0 text-xs ${unread[b.id] > 0 ? "text-fg" : "text-muted"}`}>{formatShort(lastMsg.ts)}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`truncate text-[13px] ${unread[b.id] > 0 ? "text-soft" : "text-muted"}`}>
                        {lastMsg ? `${lastMsg.from === "me" ? "Tu: " : ""}${preview(lastMsg)}` : "Nessun messaggio"}
                      </p>
                      {unread[b.id] > 0 && <Badge count={unread[b.id]} />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>
        <WakeSettings />
      </aside>

      <main className={`${mobileDetail ? "flex" : "hidden"} min-w-0 flex-1 flex-col md:flex`}>
        <header className="glass border-b border-line">
          {/* Mobile: indietro alla lista */}
          <div className="flex min-h-[60px] items-center gap-2 py-2 pr-3 pl-1.5 md:hidden">
            <button
              onClick={back}
              aria-label="Indietro"
              className="press flex h-9 shrink-0 items-center gap-0.5 rounded-full pr-1.5 pl-1 text-soft hover:bg-white/[0.07] hover:text-fg"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              {totalUnread > 0 && <Badge count={totalUnread} />}
            </button>
            {title}
          </div>
          <div className="hidden h-[76px] items-center gap-3 px-6 md:flex">{title}</div>
        </header>

        {onNotes ? (
          <Notes notes={notes} bots={bots} onChanged={forceRefresh} />
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
            mine ? "rounded-[20px] rounded-br-md bg-[#262626]/95 text-[#f5f5f5]" : "rounded-[20px] rounded-bl-md border border-line bg-[#0f0f0f]/90"
          } ${m.media?.length ? "mt-1" : ""} ${m.pending ? "opacity-60" : ""} ${m.failed ? "opacity-70 ring-1 ring-red-500/60" : ""} transition-opacity`}
        >
          {m.text}
        </div>
      )}
      {m.failed ? (
        <button onClick={() => onRetry(m)} className="hit mt-1 px-1 text-xs text-danger hover:underline">
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
  const frame = `mt-1 overflow-hidden rounded-[20px] border border-line bg-[#0f0f0f]/90 ${mine ? "rounded-br-md" : "rounded-bl-md"}`;

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
      <img src={src} alt="" referrerPolicy="no-referrer" className="max-h-[92dvh] max-w-full rounded-xl object-contain" />
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute top-4 right-4 flex h-9 items-center rounded-full bg-black/60 px-4 text-sm font-medium shadow-[inset_0_0_0_1px_rgb(255_255_255/0.15)] backdrop-blur-md hover:bg-black/80"
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
      <div className="flex gap-1 rounded-[20px] rounded-bl-md border border-line bg-[#0f0f0f]/90 px-4 py-3.5">
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
    <div className="composer-dock px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6 md:pb-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mx-auto flex max-w-3xl items-end gap-2 rounded-[22px] border border-white/10 bg-[#0d0d0d]/90 p-1.5 pl-4 backdrop-blur-xl transition-[border-color,box-shadow] focus-within:border-white/25 focus-within:shadow-[0_0_0_3px_var(--ring)]"
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
          className="scroll-thin max-h-[200px] min-h-10 flex-1 resize-none bg-transparent py-2 text-[15px] leading-relaxed outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Invia"
          className="chrome grid size-9 shrink-0 place-items-center rounded-full transition-all enabled:active:scale-90 disabled:scale-90 disabled:opacity-25"
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
    <span className="chrome grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full px-1 text-[10.5px] font-bold tabular-nums animate-pop">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function DaySeparator({ ts }: { ts: number }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
      <span className="text-[11px] font-medium text-muted">{formatDay(ts)}</span>
      <span aria-hidden className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3">
      {["w-48", "ml-auto w-36", "w-64", "ml-auto w-52"].map((w, i) => (
        <div key={i} className={`skeleton h-10 rounded-[20px] ${w}`} />
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
