"use client";

import { whoText, type NodeInfo, type Who } from "./workflow-model";

// Un blocco dello schema. Due impaginazioni nello stesso pulsante, scelte con le container query:
// riga compatta su telefono (colonna con binario a sinistra), scheda verticale da 820px di contenitore in su.

/** Posto nella griglia a due righe: riga 1 da sinistra a destra, riga 2 da destra a sinistra (la catena "serpeggia"). */
const PLACE: Record<NodeInfo["id"], string> = {
  brief: "@min-[820px]:col-start-1 @min-[820px]:row-start-1",
  idea: "@min-[820px]:col-start-2 @min-[820px]:row-start-1",
  gate: "@min-[820px]:col-start-3 @min-[820px]:row-start-1",
  script: "@min-[820px]:col-start-4 @min-[820px]:row-start-1",
  produzione: "@min-[820px]:col-start-5 @min-[820px]:row-start-1",
  revisione: "@min-[820px]:col-start-5 @min-[820px]:row-start-2",
  pronto: "@min-[820px]:col-start-4 @min-[820px]:row-start-2",
  in_test: "@min-[820px]:col-start-3 @min-[820px]:row-start-2",
  vincente: "@min-[820px]:col-start-2 @min-[820px]:row-start-2",
  scartato: "mt-3 @min-[820px]:mt-0 @min-[820px]:col-start-1 @min-[820px]:row-start-2",
};

/** Nodo sul binario: cerchio per le fasi di lavoro, rombo per le decisioni del critico. */
function Glyph({ n }: { n: NodeInfo }) {
  const fill = n.yourTurn ? undefined : { background: n.tone };
  const dot = n.yourTurn ? "chrome border-0!" : "";
  if (n.decision) {
    return (
      <span className="grid size-[22px] shrink-0 place-items-center">
        <span className="grid size-[15px] rotate-45 place-items-center rounded-[4px] border border-white/20 bg-[#0b0b0b]">
          <span className={`size-[5px] rounded-[1.5px] ${dot}`} style={fill} />
        </span>
      </span>
    );
  }
  const hollow = n.id === "scartato";
  return (
    <span className={`grid size-[22px] shrink-0 place-items-center rounded-full border bg-[#0b0b0b] ${n.yourTurn ? "border-white/40" : "border-white/15"}`}>
      <span className={`size-[7px] rounded-full ${dot} ${hollow ? "border border-[#6a6a6a] bg-transparent!" : ""}`} style={hollow ? undefined : fill} />
    </span>
  );
}

/** Chi lavora nel blocco: goccia con l'iniziale, puntino bianco se il bot è online. */
function Avatar({ who, small }: { who: Who; small?: boolean }) {
  const size = small ? "size-4 text-[8.5px]" : "size-5 text-[9.5px]";
  if (who.kind === "none") return <span className={`${size} shrink-0 rounded-full border border-dashed border-white/20`} />;
  if (who.kind === "end") return null;
  const you = who.kind === "you";
  const initial = you ? "B" : who.name.trim()[0]?.toUpperCase() || "?";
  return (
    <span className={`relative grid shrink-0 place-items-center rounded-full font-bold ${size} ${you ? "chrome border-0!" : "orb"}`}>
      {initial}
      {who.kind === "bot" && who.online && (
        <span
          className={`absolute -right-[2px] -bottom-[2px] rounded-full ring-2 ring-[#0b0b0b] ${small ? "size-[7px]" : "size-2"} ${
            who.paused ? "bg-muted" : "bg-white shadow-[0_0_6px_rgb(255_255_255/0.85)]"
          }`}
        />
      )}
    </span>
  );
}

function Pulse({ label = true }: { label?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-soft">
      <span className="relative grid size-1.5 place-items-center">
        <span className="absolute size-1.5 animate-ping rounded-full bg-white/60" style={{ animationDuration: "2.4s" }} />
        <span className="size-1.5 rounded-full bg-white" />
      </span>
      {label && <span className="hidden @min-[960px]:inline">attivo</span>}
    </span>
  );
}

export function Block({
  n,
  selected,
  innerRef,
  onClick,
  onHover,
}: {
  n: NodeInfo;
  selected: boolean;
  innerRef: (el: HTMLElement | null) => void;
  onClick: () => void;
  onHover: (on: boolean) => void;
}) {
  const sink = n.id === "scartato";
  const name = whoText(n.who);
  const live = n.who.kind === "bot" && n.who.online;
  const aria = [
    `${n.label}.`,
    n.role && `${n.role}: ${name}${live ? " (online)" : ""}.`,
    `${n.count} ${n.unit}.`,
    n.yourTurn && "Tocca a te.",
    n.active && "Attivo.",
    n.todo,
  ]
    .filter(Boolean)
    .join(" ");

  const tone = selected
    ? "border-white/60 bg-[#141414] shadow-[0_0_0_4px_rgb(255_255_255/0.08),0_0_48px_-16px_rgb(255_255_255/0.3)]"
    : n.yourTurn
      ? "border-white/30 bg-[#0e0e0e] shadow-[0_0_44px_-14px_rgb(255_255_255/0.35)] hover:border-white/45"
      : sink
        ? "border-dashed border-white/12 bg-[#080808] hover:border-white/25"
        : "border-white/[0.09] bg-[#0b0b0b] hover:border-white/20 hover:bg-[#0f0f0f]";

  const count = (
    <span
      className={`leading-none font-semibold tracking-[-0.04em] tabular-nums ${n.yourTurn ? "chrome-text" : n.count ? "text-fg" : sink ? "text-[#3d3d3d]" : "text-[#4a4a4a]"}`}
    >
      {n.count}
    </span>
  );

  return (
    <button
      ref={innerRef}
      type="button"
      aria-pressed={selected}
      aria-label={aria}
      onClick={onClick}
      onPointerEnter={(e) => e.pointerType === "mouse" && onHover(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      className={`group press relative z-[1] flex w-full min-w-0 flex-col rounded-2xl border text-left focus-visible:outline-offset-4 ${tone} ${PLACE[n.id]} ${
        sink && !selected ? "opacity-80 hover:opacity-100" : ""
      }`}
    >
      {/* respiro "attivo": un alone che va e viene, lento */}
      {n.active && !selected && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-pulse rounded-2xl bg-[radial-gradient(120%_70%_at_50%_0%,rgb(255_255_255/0.07),transparent_70%)] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08),0_0_26px_-10px_rgb(255_255_255/0.3)]"
          style={{ animationDuration: "3.6s" }}
        />
      )}
      {/* segno della scelta: barretta d'argento, come la voce attiva del menu */}
      {selected && (
        <span
          aria-hidden
          className="chrome absolute top-[-1.5px] left-1/2 hidden h-[3px] w-8 -translate-x-1/2 rounded-full border-0! @min-[820px]:block"
        />
      )}

      {/* telefono: riga compatta */}
      <span className="relative flex w-full items-center gap-3 py-2.5 pr-4 pl-4 @min-[820px]:hidden">
        <Glyph n={n} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={`truncate text-[14.5px] font-semibold tracking-[-0.01em] ${sink ? "text-soft" : ""}`}>{n.label}</span>
            {n.active && !n.yourTurn && <Pulse label={false} />}
            {n.yourTurn && <span className="chrome shrink-0 rounded-full border-0! px-1.5 py-px text-[10px] font-semibold">tocca a te</span>}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-muted">
            {n.role && <span className="shrink-0">{n.role}</span>}
            {n.role && <span className="text-[#444]">·</span>}
            <Avatar who={n.who} small />
            <span className={`truncate ${live ? "text-soft" : ""}`}>{name}</span>
          </span>
        </span>
        <span className="shrink-0 text-[22px]">{count}</span>
      </span>
      {selected && <span className="relative block px-4 pb-3 pl-[50px] text-[12.5px] leading-relaxed text-soft @min-[820px]:hidden">{n.todo}</span>}

      {/* desktop: scheda */}
      <span className="relative hidden h-full w-full flex-col @min-[820px]:flex">
        <span className="flex items-center gap-2 px-3 pt-3 @min-[960px]:px-3.5">
          <Glyph n={n} />
          <span className="truncate text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">{n.role}</span>
          <span className="ml-auto hidden font-mono text-[10px] text-[#555] tabular-nums @min-[960px]:inline">{String(n.step).padStart(2, "0")}</span>
        </span>
        <span className={`truncate px-3 pt-2.5 text-[13px] font-semibold tracking-[-0.01em] @min-[960px]:px-3.5 @min-[960px]:text-[14px] ${sink ? "text-soft" : ""}`}>
          {n.label}
        </span>
        <span className="flex min-h-[40px] items-end justify-between gap-2 px-3 pt-1.5 pb-3 @min-[960px]:px-3.5">
          <span className="text-[28px] @min-[960px]:text-[32px]">{count}</span>
          {n.active && !n.yourTurn && (
            <span className="mb-1 shrink-0">
              <Pulse />
            </span>
          )}
          {n.yourTurn && <span className="chrome mb-1 shrink-0 rounded-full border-0! px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap">tocca a te</span>}
        </span>
        <span className="mt-auto flex min-w-0 items-center gap-2 border-t border-white/[0.06] px-3 py-2.5 @min-[960px]:px-3.5">
          <Avatar who={n.who} />
          <span className={`truncate text-[12px] ${n.who.kind === "none" || n.who.kind === "end" ? "text-muted" : "text-soft"}`}>{name}</span>
        </span>
      </span>
    </button>
  );
}
