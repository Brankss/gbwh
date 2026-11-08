"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { send } from "@/lib/client";
import { VERDICTS, type UgcReview, type Verdict } from "@/lib/ugc";
import { REVIEW_RUBRIC } from "@/lib/ugc-library";
import { Block, Btn, Disclosure, EmptyRow, ErrorLine, F, Label, Panel, Row, Seg, TextArea, VERDICT_TONE, agoAt, fieldClass, useAction, type ConceptCtx } from "./concept-ui";

// Revisioni del critico: la storia dei giudizi e, nelle fasi giuste, il modulo per darne uno.

const VERDICT_LABEL: Record<Verdict, string> = { approvato: "Approvato", "da rifare": "Da rifare", scartato: "Scartato" };

/** Cosa succede alla catena dopo il verdetto. */
const EFFECT: Record<"gate" | "revisione", Record<Verdict, string>> = {
  gate: {
    approvato: "Passa a Script: il regista scrive le scene.",
    "da rifare": "Torna a Idea, con le tue correzioni per il regista.",
    scartato: "Il concept si ferma qui: niente soldi spesi per produrlo.",
  },
  revisione: {
    approvato: "Diventa Pronto: poi decidi tu se metterlo in test.",
    "da rifare": "Torna in Produzione, con le tue correzioni per il producer.",
    scartato: "Video e concept si fermano qui.",
  },
};

export function ConceptReviews({ ctx }: { ctx: ConceptCtx }) {
  const { reviews, videos, concept } = ctx.data;
  const sorted = [...reviews].sort((a, b) => b.createdAt - a.createdAt);
  const canReview = concept.stage === "gate" || concept.stage === "revisione";

  return (
    <Block id="revisioni" title={`Revisioni${reviews.length ? ` · ${reviews.length}` : ""}`}>
      {canReview && <ReviewForm ctx={ctx} stage={concept.stage as "gate" | "revisione"} />}
      <Panel>
        {sorted.length === 0 ? (
          <EmptyRow icon="check">
            {canReview ? "Ancora nessuna revisione: la prima la puoi dare tu qui sopra." : "Nessuna revisione. Il critico giudica il concept prima della produzione e poi il video montato."}
          </EmptyRow>
        ) : (
          <Row className="py-4">
            <ol>
              {sorted.map((r, i) => (
                <ReviewItem key={r.id} r={r} ctx={ctx} last={i === sorted.length - 1} version={videos.find((v) => v.id === r.videoId)?.version} />
              ))}
            </ol>
          </Row>
        )}
      </Panel>
    </Block>
  );
}

function ReviewItem({ r, ctx, last, version }: { r: UgcReview; ctx: ConceptCtx; last: boolean; version?: number }) {
  const tone = VERDICT_TONE[r.verdict];
  return (
    <li className={`relative flex gap-3.5 ${last ? "" : "pb-6"}`}>
      {!last && <span aria-hidden className="absolute top-6 bottom-0 left-[11px] w-px bg-white/[0.08]" />}
      <span className="relative mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border" style={{ borderColor: `${tone}66`, background: `${tone}1f` }}>
        <span className="size-2 rounded-full" style={{ background: tone }} />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[15px] font-semibold" style={{ color: tone }}>
              {VERDICT_LABEL[r.verdict]}
            </span>
            <span className="text-[15px] font-semibold tabular-nums">{r.score}/10</span>
            <span className="text-[13px] text-muted">· {r.stage === "gate" ? "Gate" : `Video${version ? ` v${version}` : ""}`}</span>
          </div>
          <div className="mt-0.5 text-xs text-muted">
            {ctx.who(r.by)}
            {ctx.now ? ` · ${agoAt(r.createdAt, ctx.now)}` : ""}
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-[13px]">
          <Icon name={r.scrollStop ? "check" : "close"} className={`size-3.5 ${r.scrollStop ? "text-[#4fc79b]" : "text-[#ec8585]"}`} />
          <span className={r.scrollStop ? "" : "text-muted"}>{r.scrollStop ? "Ferma lo scroll" : "Non ferma lo scroll"}</span>
        </p>
        {r.good && (
          <div>
            <Label className="mb-0.5">Cosa funziona</Label>
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{r.good}</p>
          </div>
        )}
        {r.fix.length > 0 && (
          <div>
            <Label className="mb-1">Correzioni</Label>
            <ul className="space-y-1">
              {r.fix.map((f, i) => (
                <li key={i} className="flex gap-2 text-[15px] leading-relaxed">
                  <span className="mt-[0.6em] size-1 shrink-0 rounded-full bg-white/40" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </li>
  );
}

function ReviewForm({ ctx, stage }: { ctx: ConceptCtx; stage: "gate" | "revisione" }) {
  const { videos } = ctx.data;
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [scrollStop, setScrollStop] = useState<"si" | "no" | null>(null);
  const [good, setGood] = useState("");
  const [fix, setFix] = useState<string[]>([""]);
  const [videoId, setVideoId] = useState(videos[0]?.id ?? "");
  const { busy, error, run, setError } = useAction();
  const rubric = REVIEW_RUBRIC.filter((q) => q.stage === stage || q.stage === "entrambi");

  const submit = async () => {
    if (!verdict || !score || !scrollStop) return setError("Scegli verdetto, voto e se ferma lo scroll.");
    const fixes = fix.map((f) => f.trim()).filter(Boolean);
    if (verdict === "da rifare" && !fixes.length) return setError("Se è da rifare, scrivi almeno una correzione.");
    const ok = await run(() =>
      ctx.act(() =>
        send("POST", `${ctx.key}/reviews`, { verdict, score, scrollStop: scrollStop === "si", good: good.trim() || undefined, fix: fixes, videoId: stage === "revisione" ? videoId || undefined : undefined }, ["/api/ugc"]),
      ),
    );
    if (ok) {
      setVerdict(null);
      setScore(null);
      setScrollStop(null);
      setGood("");
      setFix([""]);
    }
  };

  return (
    <Panel className="mb-3">
      <Row className="flex items-center gap-2 py-3">
        <Icon name="check" className="size-4 text-[#b4b4b4]" />
        <h3 className="flex-1 text-[13px] font-semibold">{stage === "gate" ? "Giudica il concept prima di produrlo" : "Giudica il video montato"}</h3>
      </Row>
      {rubric.length > 0 && (
        <Row className="py-2">
          <Disclosure label={`Griglia del critico · ${rubric.length} domande`}>
            <ol className="space-y-1.5 pb-1 text-[13px] leading-relaxed">
              {rubric.map((q, i) => (
                <li key={q.id} className="flex gap-2">
                  <span className="w-4 shrink-0 text-right text-muted tabular-nums">{i + 1}</span>
                  <span className="flex-1">{q.question}</span>
                  {q.weight > 0 && <span className="shrink-0 text-xs text-muted tabular-nums">×{q.weight}</span>}
                </li>
              ))}
            </ol>
          </Disclosure>
        </Row>
      )}
      <Row className="space-y-4">
        {stage === "revisione" && videos.length > 1 && (
          <F label="Video">
            <select value={videoId} onChange={(e) => setVideoId(e.target.value)} className={fieldClass}>
              {videos.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version} · {v.status}
                </option>
              ))}
            </select>
          </F>
        )}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-[#b4b4b4]">Verdetto</span>
          <Seg ariaLabel="Verdetto" value={verdict} onChange={setVerdict} options={VERDICTS.map((v) => ({ value: v, label: VERDICT_LABEL[v], tone: VERDICT_TONE[v] }))} />
          <p className="min-h-[1.25rem] text-xs text-muted">{verdict ? <>→ {EFFECT[stage][verdict]}</> : "Ogni verdetto sposta il concept nella catena."}</p>
        </div>
        <div className="space-y-1.5">
          <span className="flex items-baseline justify-between text-xs">
            <span className="font-medium text-[#b4b4b4]">Voto</span>
            <span className="text-muted tabular-nums">{score ? `${score}/10` : "1–10"}</span>
          </span>
          <div role="radiogroup" aria-label="Voto" className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={score === n}
                onClick={() => setScore(n)}
                className={`press h-9 rounded-xl text-sm font-semibold tabular-nums ${
                  score === n ? "bg-white text-black" : score && n < score ? "bg-white/[0.12] text-fg" : "border border-white/[0.08] text-muted hover:text-fg"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-[#b4b4b4]">Fermerebbe lo scroll?</span>
          <Seg
            ariaLabel="Fermerebbe lo scroll"
            value={scrollStop}
            onChange={setScrollStop}
            options={[
              { value: "si", label: "Sì" },
              { value: "no", label: "No" },
            ]}
          />
        </div>
        <F label="Cosa funziona">
          <TextArea value={good} onChange={setGood} placeholder="Il punto forte da non perdere" />
        </F>
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-[#b4b4b4]">Correzioni</span>
          <ul className="space-y-2">
            {fix.map((f, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <input
                  value={f}
                  onChange={(e) => setFix(fix.map((x, j) => (j === i ? e.target.value : x)))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (f.trim()) setFix([...fix.slice(0, i + 1), "", ...fix.slice(i + 1)]);
                    }
                  }}
                  placeholder={i === 0 ? "Una correzione per riga" : "Altra correzione"}
                  aria-label={`Correzione ${i + 1}`}
                  className={fieldClass}
                />
                {fix.length > 1 && <Btn variant="quiet" icon="close" label="Togli correzione" onClick={() => setFix(fix.filter((_, j) => j !== i))} />}
              </li>
            ))}
          </ul>
          <Btn variant="quiet" icon="plus" onClick={() => setFix([...fix, ""])} className="-ml-2">
            Aggiungi correzione
          </Btn>
        </div>
      </Row>
      <Row className="flex flex-wrap items-center justify-end gap-2 bg-white/[0.015]">
        {error && <ErrorLine className="mr-auto basis-full sm:basis-auto">{error}</ErrorLine>}
        <Btn variant="chrome" onClick={submit} disabled={busy}>
          {busy ? "Invio…" : "Invia revisione"}
        </Btn>
      </Row>
    </Panel>
  );
}
