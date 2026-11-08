"use client";

import { useCallback, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { CHAIN } from "./workflow-model";
import type { WorkflowNode } from "./workflow";

// Collegamenti dello schema: misuro dove stanno i blocchi (ResizeObserver) e disegno in SVG
// frecce, ritorni "da rifare" e scarti. Due forme: "snake" (due righe, desktop) e "stack" (colonna, telefono).

type Rect = { x: number; y: number; w: number; h: number };
type Pt = [number, number];
export type Geo = { mode: "snake" | "stack"; w: number; h: number; r: Record<WorkflowNode, Rect> };

type Edge = { key: string; from: WorkflowNode; to: WorkflowNode; kind: "flow" | "loop" | "drop"; d: string; len: number; arrow: boolean; up?: boolean };
type Tag = { key: string; x: number; y: number; align: "center" | "end"; from: WorkflowNode; to: WorkflowNode };

/* ------------------------------------------------------------------ */
/* Misure                                                              */
/* ------------------------------------------------------------------ */

const same = (a: Geo | null, b: Geo) =>
  !!a && a.mode === b.mode && a.w === b.w && a.h === b.h && CHAIN.every((k) => {
    const p = a.r[k], q = b.r[k];
    return p.x === q.x && p.y === q.y && p.w === q.w && p.h === q.h;
  });

/** Posizioni dei blocchi rispetto al contenitore (che deve essere `relative`). */
export function useGeometry() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<WorkflowNode, HTMLElement>());
  const [geo, setGeo] = useState<Geo | null>(null);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const r = {} as Record<WorkflowNode, Rect>;
      for (const id of CHAIN) {
        const el = nodes.current.get(id);
        if (!el) return;
        r[id] = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
      }
      // Brief e Idea sulla stessa riga: forma a due righe; altrimenti colonna.
      const mode = Math.abs(r.brief.y - r.idea.y) < 4 ? "snake" : "stack";
      const next: Geo = { mode, w: wrap.offsetWidth, h: wrap.offsetHeight, r };
      setGeo((prev) => (same(prev, next) ? prev : next));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    nodes.current.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, []);

  const setNode = useCallback(
    (id: WorkflowNode) => (el: HTMLElement | null) => {
      if (el) nodes.current.set(id, el);
      else nodes.current.delete(id);
    },
    [],
  );

  return { wrapRef, setNode, geo };
}

const REDUCED = "(prefers-reduced-motion: reduce)";
/** Movimento ridotto chiesto dal sistema: niente luce che scorre. */
export function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(REDUCED);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => matchMedia(REDUCED).matches,
    () => true,
  );
}

/** Ora corrente arrotondata (si aggiorna ogni 30 s): basta per lo stato "attivo". */
export function useNow(step = 30_000) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const t = setInterval(cb, step);
      return () => clearInterval(t);
    },
    [step],
  );
  return useSyncExternalStore(subscribe, () => Math.floor(Date.now() / step) * step, () => 0);
}

/* ------------------------------------------------------------------ */
/* Geometria                                                           */
/* ------------------------------------------------------------------ */

const right = (r: Rect) => r.x + r.w;
const bottom = (r: Rect) => r.y + r.h;
const midX = (r: Rect) => r.x + r.w / 2;
const midY = (r: Rect) => r.y + r.h / 2;
const f = (n: number) => Math.round(n * 10) / 10;

/** Spezzata ortogonale con angoli arrotondati. */
function rounded(pts: Pt[], radius: number) {
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    const d1 = Math.hypot(x - px, y - py) || 1;
    const d2 = Math.hypot(nx - x, ny - y) || 1;
    const rr = Math.min(radius, d1 / 2, d2 / 2);
    d += ` L${f(x + ((px - x) / d1) * rr)},${f(y + ((py - y) / d1) * rr)} Q${f(x)},${f(y)} ${f(x + ((nx - x) / d2) * rr)},${f(y + ((ny - y) / d2) * rr)}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  return `${d} L${f(lx)},${f(ly)}`;
}
const polyLen = (pts: Pt[]) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

function line(key: string, from: WorkflowNode, to: WorkflowNode, kind: Edge["kind"], pts: Pt[], radius = 10, arrow = true): Edge {
  return { key, from, to, kind, d: rounded(pts, radius), len: polyLen(pts), arrow };
}

const pairs = (ids: WorkflowNode[]) => ids.slice(1).map((b, i) => [ids[i], b] as const);

function snake(r: Geo["r"]) {
  const edges: Edge[] = [];
  const tags: Tag[] = [];
  // Riga 1, da sinistra a destra.
  for (const [a, b] of pairs(["brief", "idea", "gate", "script", "produzione"])) {
    edges.push(line(`${a}-${b}`, a, b, "flow", [[right(r[a]) + 3, midY(r[a])], [r[b].x - 4, midY(r[b])]]));
  }
  // Curva a U sul lato destro: Produzione → Revisione.
  const P = r.produzione, V = r.revisione;
  const xr = Math.max(right(P), right(V)) + 22;
  edges.push(line("produzione-revisione", "produzione", "revisione", "flow", [[right(P) + 3, midY(P)], [xr, midY(P)], [xr, midY(V)], [right(V) + 4, midY(V)]], 16));
  // Riga 2, da destra a sinistra.
  for (const [a, b] of pairs(["revisione", "pronto", "in_test", "vincente"])) {
    edges.push(line(`${a}-${b}`, a, b, "flow", [[r[a].x - 3, midY(r[a])], [right(r[b]) + 4, midY(r[b])]]));
  }

  // Ritorno dal gate all'idea: arco sopra la riga.
  const G = r.gate, I = r.idea;
  const gx = G.x + G.w * 0.38, ix = I.x + I.w * 0.62, top = Math.min(G.y, I.y), h = 34;
  edges.push({
    key: "gate-idea",
    from: "gate",
    to: "idea",
    kind: "loop",
    d: `M${f(gx)},${f(top - 3)} C${f(gx)},${f(top - h)} ${f(ix)},${f(top - h)} ${f(ix)},${f(top - 5)}`,
    len: gx - ix + h * 2,
    arrow: true,
  });
  tags.push({ key: "gate-idea", x: (gx + ix) / 2, y: top - 1 - 0.75 * h, align: "center", from: "gate", to: "idea" });

  // Ritorno dalla revisione alla produzione: arco nello spazio tra le righe.
  const x = midX(V), y0 = V.y - 3, y1 = bottom(P) + 5, b = 64, k = 15;
  edges.push({
    key: "revisione-produzione",
    from: "revisione",
    to: "produzione",
    kind: "loop",
    d: `M${f(x)},${f(y0)} C${f(x - b * 0.4)},${f(y0 - k)} ${f(x - b * 0.4)},${f(y1 + k)} ${f(x)},${f(y1)}`,
    len: y0 - y1 + b,
    arrow: true,
    up: true,
  });
  tags.push({ key: "revisione-produzione", x: x - 0.3 * b, y: (y0 + y1) / 2, align: "center", from: "revisione", to: "produzione" });

  // Scarti verso Scartato (in basso a sinistra): dal gate lungo lo spazio tra le righe, da revisione e test sotto la riga 2.
  const S = r.scartato;
  const lane = (bottom(G) + Math.min(V.y, S.y)) / 2 + 6;
  edges.push(line("gate-scartato", "gate", "scartato", "drop", [[midX(G) + 14, bottom(G) + 3], [midX(G) + 14, lane], [midX(S), lane], [midX(S), S.y - 4]], 12));
  const T = r.in_test;
  const laneB = Math.max(bottom(V), bottom(T), bottom(S)) + 18;
  edges.push(line("revisione-scartato", "revisione", "scartato", "drop", [[midX(V), bottom(V) + 3], [midX(V), laneB], [midX(S), laneB], [midX(S), bottom(S) + 4]], 12));
  edges.push(line("in_test-scartato", "in_test", "scartato", "drop", [[midX(T), bottom(T) + 3], [midX(T), laneB], [midX(T) - 14, laneB]], 12, false));
  return { edges, tags };
}

function stack(r: Geo["r"]) {
  const edges: Edge[] = [];
  const tags: Tag[] = [];
  const rail = r.brief.x + 27;
  for (const [a, b] of pairs(CHAIN.slice(0, -1))) {
    edges.push(line(`${a}-${b}`, a, b, "flow", [[rail, bottom(r[a]) + 2], [rail, r[b].y - 3]]));
  }
  // Ritorni: staffa sul lato destro, etichetta nello spazio tra i due blocchi.
  for (const [from, to] of [["gate", "idea"], ["revisione", "produzione"]] as const) {
    const A = r[from], B = r[to];
    const xr = right(A) + 10;
    edges.push(line(`${from}-${to}`, from, to, "loop", [[right(A) + 2, midY(A)], [xr, midY(A)], [xr, midY(B)], [right(B) + 4, midY(B)]], 6));
    tags.push({ key: `${from}-${to}`, x: right(B) - 10, y: (bottom(B) + A.y) / 2, align: "end", from, to });
  }
  // Scarti: un condotto sottile sul lato sinistro che scende fino a Scartato.
  const S = r.scartato, G = r.gate;
  const lx = G.x - 8;
  edges.push(line("gate-scartato", "gate", "scartato", "drop", [[G.x - 2, midY(G)], [lx, midY(G)], [lx, midY(S)], [S.x - 4, midY(S)]], 6));
  for (const id of ["revisione", "in_test"] as const) {
    const A = r[id];
    edges.push(line(`${id}-scartato`, id, "scartato", "drop", [[A.x - 2, midY(A)], [lx, midY(A)], [lx, midY(A) + 12]], 6, false));
  }
  return { edges, tags };
}

/* ------------------------------------------------------------------ */
/* Disegno                                                             */
/* ------------------------------------------------------------------ */

const SPEED = 110; // px al secondo, per la luce che scorre
const HOP = 0.32; // pausa "dentro" il blocco prima del collegamento dopo

export function Wires({ geo, focus, still }: { geo: Geo; focus: WorkflowNode | null; still: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { edges } = geo.mode === "snake" ? snake(geo.r) : stack(geo.r);
  const touches = (e: Edge) => !!focus && (e.from === focus || e.to === focus);

  // La "staffetta": una luce attraversa la catena collegamento dopo collegamento, poi riparte.
  const flow = edges.filter((e) => e.kind === "flow");
  const durs = flow.map((e) => Math.max(0.45, e.len / SPEED));
  const lead = 0.8;
  const total = lead + durs.reduce((s, d) => s + d + HOP, 0) + 2.2;
  let t = lead;
  const windows = durs.map((d) => {
    const w = [t / total, (t + d) / total] as const;
    t += d + HOP;
    return w;
  });

  const mk = (name: string) => `url(#${uid}-${name})`;
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`}>
      <defs>
        {(
          [
            ["flow", 0.42, "auto"],
            ["hot", 0.8, "auto"],
            ["loop", 0.45, "auto"],
            ["drop", 0.2, "auto"],
            // il ritorno nello spazio tra le righe entra dal basso: punta sempre in su
            ["loop-up", 0.45, "270"],
            ["hot-up", 0.8, "270"],
          ] as const
        ).map(([name, o, orient]) => (
          <marker key={name} id={`${uid}-${name}`} viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient={orient}>
            <path d="M1.5,1.2 L6.5,4 L1.5,6.8" fill="none" stroke={`rgb(255 255 255 / ${o})`} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        ))}
        <filter id={`${uid}-glow`} filterUnits="userSpaceOnUse" x={-20} y={-20} width={geo.w + 40} height={geo.h + 40}>
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* scarti: appena accennati */}
      {edges
        .filter((e) => e.kind === "drop")
        .map((e) => (
          <path
            key={e.key}
            d={e.d}
            fill="none"
            stroke={`rgb(255 255 255 / ${touches(e) ? 0.3 : 0.11})`}
            strokeWidth="1"
            strokeDasharray="2 4"
            markerEnd={e.arrow ? mk("drop") : undefined}
            style={{ transition: "stroke 0.3s" }}
          />
        ))}

      {/* ritorni "da rifare": tratteggio curvo, scorre piano all'indietro */}
      {edges
        .filter((e) => e.kind === "loop")
        .map((e) => (
          <path
            key={e.key}
            d={e.d}
            fill="none"
            stroke={`rgb(255 255 255 / ${touches(e) ? 0.62 : 0.32})`}
            strokeWidth="1.1"
            strokeDasharray="3 4"
            strokeLinecap="round"
            markerEnd={mk(`${touches(e) ? "hot" : "loop"}${e.up ? "-up" : ""}`)}
            style={{ transition: "stroke 0.3s" }}
          >
            {!still && <animate attributeName="stroke-dashoffset" values="14;0" dur="2.4s" repeatCount="indefinite" />}
          </path>
        ))}

      {/* catena principale: filo sottile */}
      {flow.map((e) => (
        <path
          key={e.key}
          d={e.d}
          fill="none"
          stroke={`rgb(255 255 255 / ${touches(e) ? 0.55 : 0.22})`}
          strokeWidth="1"
          markerEnd={mk(touches(e) ? "hot" : "flow")}
          style={{ transition: "stroke 0.3s" }}
        />
      ))}

      {/* staffetta di luce: due impulsi, a mezzo giro l'uno dall'altro */}
      {!still &&
        [0, 0.5].map((phase) =>
          flow.map((e, i) => {
            const dash = Math.min(85, (26 / Math.max(1, e.len)) * 100);
            const [a, b] = windows[i];
            const from = dash + 1;
            return (
              <path
                key={`lux-${phase}-${e.key}`}
                d={e.d}
                pathLength={100}
                fill="none"
                stroke="#fff"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeDasharray={`${dash} 400`}
                strokeDashoffset={from}
                filter={mk("glow")}
              >
                <animate
                  attributeName="stroke-dashoffset"
                  values={`${from};${from};-101;-101`}
                  keyTimes={`0;${a.toFixed(4)};${b.toFixed(4)};1`}
                  dur={`${total.toFixed(2)}s`}
                  begin={`${(-phase * total).toFixed(2)}s`}
                  repeatCount="indefinite"
                />
              </path>
            );
          }),
        )}
    </svg>
  );
}

/** Etichette "da rifare" sui ritorni (HTML sopra l'SVG, così il testo è nitido). */
export function LoopTags({ geo, focus }: { geo: Geo; focus: WorkflowNode | null }) {
  const { tags } = geo.mode === "snake" ? snake(geo.r) : stack(geo.r);
  return (
    <>
      {tags.map((t) => {
        const hot = !!focus && (focus === t.from || focus === t.to);
        return (
          <span
            key={t.key}
            aria-hidden
            className={`pointer-events-none absolute z-[2] inline-flex items-center gap-1 rounded-full border bg-bg px-1.5 py-[1px] text-[10px] leading-[14px] font-medium tracking-wide whitespace-nowrap transition-colors duration-300 ${
              hot ? "border-white/30 text-fg" : "border-white/10 text-muted"
            }`}
            style={{ left: t.x, top: t.y, transform: `translate(${t.align === "end" ? "-100%" : "-50%"}, -50%)` }}
          >
            <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 4.5h4.2a2.6 2.6 0 0 1 0 5.2H5.5M5 2.4 2.9 4.5 5 6.6" />
            </svg>
            da rifare
          </span>
        );
      })}
    </>
  );
}
