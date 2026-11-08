"use client";

import { useState } from "react";
import { eur, send } from "@/lib/client";
import { summarize, type UgcResult, type UgcVideo } from "@/lib/ugc";
import { Block, Btn, EmptyRow, ErrorLine, F, Panel, Row, fieldClass, isoDay, parseNum, useAction, type ConceptCtx } from "./concept-ui";

// Numeri veri dei video in test: totali in alto, poi i giorni per ogni versione.

const nf = (max = 0) => new Intl.NumberFormat("it-IT", { maximumFractionDigits: max });
const num = (n?: number) => (n === undefined ? "—" : nf().format(n));
const pct = (n?: number) => (n === undefined ? "—" : `${nf(1).format(n)}%`);
const roas = (n?: number) => (n === undefined ? "—" : `${nf(2).format(n)}×`);
const day = (d: string) => new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

const PLATFORMS = ["TikTok", "Meta", "YouTube", "Snapchat", "Pinterest"];

export function ConceptResults({ ctx }: { ctx: ConceptCtx }) {
  const { videos, results } = ctx.data;
  const [adding, setAdding] = useState(false);
  const s = summarize(results);
  const withResults = videos.filter((v) => results.some((r) => r.videoId === v.id));

  const add = videos.length > 0 && !adding && (
    <Btn variant="quiet" icon="plus" onClick={() => setAdding(true)} className="-my-2 -mr-2">
      Aggiungi
    </Btn>
  );

  return (
    <Block id="numeri" title="Numeri" action={add}>
      {results.length > 0 && (
        <Panel className="mb-3">
          <div className="grid grid-cols-3 divide-white/[0.06] md:grid-cols-6 md:divide-x [&>*]:border-white/[0.06] max-md:[&>*:nth-child(-n+3)]:border-b max-md:[&>*:not(:nth-child(3n+1))]:border-l">
            <Kpi label="Spesa" value={eur(s.spend)} />
            <Kpi label="Ricavi" value={eur(s.revenue)} />
            <Kpi label="ROAS" value={roas(s.roas)} strong />
            <Kpi label="Acquisti" value={num(s.purchases)} />
            <Kpi label="Hook rate" value={pct(s.hookRate)} />
            <Kpi label="CTR" value={pct(s.ctr)} />
          </div>
          <Row className="py-2.5 text-xs text-muted">
            {s.days} {s.days === 1 ? "riga" : "righe"} · {num(s.impressions)} impression · hold rate {pct(s.holdRate)}
          </Row>
        </Panel>
      )}

      {adding && <AddResult ctx={ctx} onDone={() => setAdding(false)} />}

      {videos.length === 0 ? (
        <Panel>
          <EmptyRow icon="chart">I numeri arrivano quando c&apos;è un video online. Prima serve una versione approvata.</EmptyRow>
        </Panel>
      ) : withResults.length === 0 ? (
        !adding && (
          <Panel>
            <EmptyRow icon="chart" action={<Btn icon="plus" onClick={() => setAdding(true)}>Aggiungi</Btn>}>
              Ancora nessun numero. I primi numeri su un video pronto lo mettono in test.
            </EmptyRow>
          </Panel>
        )
      ) : (
        <div className="space-y-3">
          {withResults.map((v) => (
            <VideoResults key={v.id} v={v} rows={results.filter((r) => r.videoId === v.id)} ctx={ctx} />
          ))}
        </div>
      )}
    </Block>
  );
}

function Kpi({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0 px-3 py-3 md:px-4">
      <div className="truncate text-[11px] font-medium tracking-[0.06em] text-muted uppercase">{label}</div>
      <div className={`mt-1 truncate text-[17px] leading-tight font-semibold tabular-nums md:text-xl ${strong ? "chrome-text" : ""}`}>{value}</div>
    </div>
  );
}

const COLS: { key: keyof UgcResult; label: string; fmt: (r: UgcResult) => string }[] = [
  { key: "spend", label: "Spesa", fmt: (r) => eur(r.spend) },
  { key: "impressions", label: "Impr.", fmt: (r) => num(r.impressions) },
  { key: "hookRate", label: "Hook", fmt: (r) => pct(r.hookRate) },
  { key: "holdRate", label: "Hold", fmt: (r) => pct(r.holdRate) },
  { key: "ctr", label: "CTR", fmt: (r) => pct(r.ctr) },
  { key: "cpc", label: "CPC", fmt: (r) => eur(r.cpc) },
  { key: "purchases", label: "Acq.", fmt: (r) => num(r.purchases) },
  { key: "revenue", label: "Ricavi", fmt: (r) => eur(r.revenue) },
  { key: "roas", label: "ROAS", fmt: (r) => roas(r.roas) },
];

function VideoResults({ v, rows, ctx }: { v: UgcVideo; rows: UgcResult[]; ctx: ConceptCtx }) {
  const s = summarize(rows);
  const { error, run } = useAction();
  const del = (r: UgcResult) => {
    if (!confirm(`Eliminare i numeri ${r.platform} del ${day(r.date)}?`)) return;
    run(() => ctx.act(() => send("DELETE", `/api/ugc/results/${r.id}`), (d) => ({ ...d, results: d.results.filter((x) => x.id !== r.id) })));
  };

  return (
    <Panel>
      <Row className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
        <span className="text-[15px] font-semibold tabular-nums">v{v.version}</span>
        <span className="text-[13px] text-muted tabular-nums">
          {eur(s.spend)} spesi · ROAS {roas(s.roas)} · {rows.length} {rows.length === 1 ? "giorno" : "giorni"}
        </span>
      </Row>

      {/* telefono e tablet: righe impilate */}
      <ul className="divide-y divide-white/[0.06] lg:hidden">
        {rows.map((r) => (
          <li key={r.id} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold">{day(r.date)}</span>
              <span className="text-[13px] text-muted">{r.platform}</span>
              <span className="flex-1" />
              <span className="text-[13px] font-semibold tabular-nums">{roas(r.roas)}</span>
              <Btn variant="quiet" icon="trash" label="Elimina riga" onClick={() => del(r)} className="-my-1.5 -mr-2" />
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2">
              {COLS.filter((c) => c.key !== "roas").map((c) => (
                <div key={c.key} className="min-w-0">
                  <dt className="text-[10px] font-medium tracking-[0.06em] text-muted uppercase">{c.label}</dt>
                  <dd className="truncate text-[13px] tabular-nums">{c.fmt(r)}</dd>
                </div>
              ))}
            </dl>
            {r.notes && <p className="mt-2 text-xs leading-relaxed text-muted">{r.notes}</p>}
          </li>
        ))}
      </ul>

      {/* da lg in su: tabella */}
      <div className="hidden lg:block">
        <table className="w-full text-[13px] tabular-nums">
          <thead>
            <tr className="text-left text-[10px] tracking-[0.06em] text-muted uppercase">
              <th className="py-2 pl-5 font-medium">Giorno</th>
              {COLS.map((c) => (
                <th key={c.key} className="px-2 py-2 text-right font-medium">
                  {c.label}
                </th>
              ))}
              <th className="w-12 pr-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05] border-t border-white/[0.06]">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-white/[0.02]">
                <td className="py-1.5 pl-5">
                  <span className="font-medium">{day(r.date)}</span> <span className="text-muted">{r.platform}</span>
                </td>
                {COLS.map((c) => (
                  <td key={c.key} className={`px-2 py-1.5 text-right ${c.key === "roas" ? "font-semibold" : ""}`}>
                    {c.fmt(r)}
                  </td>
                ))}
                <td className="pr-3 text-right">
                  <Btn variant="quiet" icon="trash" label="Elimina riga" onClick={() => del(r)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && (
        <Row className="py-2.5">
          <ErrorLine>{error}</ErrorLine>
        </Row>
      )}
    </Panel>
  );
}

type Draft = Record<"date" | "platform" | "spend" | "impressions" | "hookRate" | "holdRate" | "ctr" | "cpc" | "purchases" | "revenue" | "roas" | "notes", string>;
const NUM_FIELDS: { key: keyof Draft; label: string; hint?: string; pct?: boolean }[] = [
  { key: "spend", label: "Spesa €" },
  { key: "impressions", label: "Impression" },
  { key: "hookRate", label: "Hook rate %", pct: true },
  { key: "holdRate", label: "Hold rate %", pct: true },
  { key: "ctr", label: "CTR %", pct: true },
  { key: "cpc", label: "CPC €" },
  { key: "purchases", label: "Acquisti" },
  { key: "revenue", label: "Ricavi €" },
  { key: "roas", label: "ROAS", hint: "auto" },
];

function AddResult({ ctx, onDone }: { ctx: ConceptCtx; onDone: () => void }) {
  const { videos } = ctx.data;
  const [videoId, setVideoId] = useState((videos.find((v) => v.status === "pubblicato" || v.status === "approvato") ?? videos[0]).id);
  const [d, setD] = useState<Draft>(() => ({
    date: isoDay(ctx.now || 0),
    platform: "TikTok",
    spend: "",
    impressions: "",
    hookRate: "",
    holdRate: "",
    ctr: "",
    cpc: "",
    purchases: "",
    revenue: "",
    roas: "",
    notes: "",
  }));
  const { busy, error, run, setError } = useAction();

  const submit = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return setError("Scegli il giorno.");
    if (!d.platform.trim()) return setError("Scrivi la piattaforma.");
    const body: Record<string, unknown> = { date: d.date, platform: d.platform.trim(), notes: d.notes.trim() || undefined };
    for (const f of NUM_FIELDS) {
      const n = parseNum(d[f.key]);
      if (Number.isNaN(n) || (n !== undefined && (n < 0 || (f.pct && n > 100)))) return setError(`${f.label}: numero non valido.`);
      body[f.key] = n;
    }
    const ok = await run(() => ctx.act(() => send("POST", `/api/ugc/videos/${videoId}/results`, body, ["/api/ugc"])));
    if (ok) onDone();
  };

  return (
    <Panel className="mb-3">
      <Row className="space-y-4">
        <h3 className="text-[13px] font-semibold">Nuovi numeri</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {videos.length > 1 && (
            <F label="Video" className="col-span-2 md:col-span-1">
              <select value={videoId} onChange={(e) => setVideoId(e.target.value)} className={fieldClass}>
                {videos.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version} · {v.status}
                  </option>
                ))}
              </select>
            </F>
          )}
          <F label="Giorno">
            <input type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} className={`${fieldClass} min-w-0`} />
          </F>
          <F label="Piattaforma">
            <input value={d.platform} onChange={(e) => setD({ ...d, platform: e.target.value })} list="ugc-platforms" className={fieldClass} />
            <datalist id="ugc-platforms">
              {PLATFORMS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </F>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {NUM_FIELDS.map((f) => (
            <F key={f.key} label={f.label} hint={f.hint}>
              <input value={d[f.key]} onChange={(e) => setD({ ...d, [f.key]: e.target.value })} inputMode="decimal" placeholder="—" className={`${fieldClass} tabular-nums`} />
            </F>
          ))}
        </div>
        <F label="Note" hint="facoltative">
          <input value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} className={fieldClass} placeholder="Es. pubblico freddo, budget 20 €/giorno" />
        </F>
        <p className="text-xs text-muted">Stesso video, piattaforma e giorno: i numeri vengono aggiornati, non duplicati.</p>
      </Row>
      <Row className="flex flex-wrap items-center justify-end gap-2 bg-white/[0.015]">
        {error && <ErrorLine className="mr-auto basis-full sm:basis-auto">{error}</ErrorLine>}
        <Btn onClick={onDone} disabled={busy}>
          Annulla
        </Btn>
        <Btn variant="chrome" onClick={submit} disabled={busy}>
          {busy ? "Salvo…" : "Salva numeri"}
        </Btn>
      </Row>
    </Panel>
  );
}
