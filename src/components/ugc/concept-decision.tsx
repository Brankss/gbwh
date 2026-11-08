"use client";

import { useState } from "react";
import { send } from "@/lib/client";
import type { StageId } from "@/lib/ugc";
import { ConceptMedia } from "./concept-media";
import { Btn, ErrorLine, TextArea, useAction, type ConceptCtx } from "./concept-ui";

// Fase "pronto": il critico ha approvato, tocca a Branko. È la cosa più importante della pagina.

export function ConceptDecision({ ctx }: { ctx: ConceptCtx }) {
  const { videos, concept, reviews } = ctx.data;
  const video = videos.find((v) => v.status === "approvato") ?? videos[0];
  const review = [...reviews].filter((r) => r.stage === "revisione" && r.verdict === "approvato").sort((a, b) => b.createdAt - a.createdAt)[0];
  const hook = video?.hookId ? concept.hooks.find((h) => h.id === video.hookId) : concept.hooks.find((h) => h.chosen);
  const [mode, setMode] = useState<"back" | null>(null);
  const [note, setNote] = useState("");
  const { busy, error, run } = useAction();

  const go = (stage: StageId, n?: string) => run(() => ctx.act(() => send("PATCH", ctx.key, { stage, note: n?.trim() || undefined }, ["/api/ugc"])));

  return (
    <section aria-label="Decidi" className="matte overflow-hidden rounded-[1.25rem]">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3 md:px-5">
        <span className="relative flex size-2">
          <span className="absolute inset-0 animate-ping rounded-full bg-white/50" />
          <span className="relative size-2 rounded-full bg-white" />
        </span>
        <h2 className="text-[13px] font-semibold">Tocca a te: guardalo e decidi</h2>
      </div>

      <div className="grid gap-0 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <div className="bg-black/60 md:border-r md:border-white/[0.06]">
          {video ? (
            <ConceptMedia media={video.media} className="mx-auto max-h-[52vh] md:max-h-[520px]" />
          ) : (
            <p className="px-4 py-10 text-center text-sm text-muted">Nessun video caricato.</p>
          )}
        </div>

        <div className="flex flex-col gap-4 p-4 md:p-5">
          <dl className="space-y-2.5 text-[13px]">
            {video && (
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-muted">Versione</dt>
                <dd className="font-medium">v{video.version}</dd>
              </div>
            )}
            {hook && (
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-muted">Hook</dt>
                <dd className="min-w-0">«{hook.text}»</dd>
              </div>
            )}
            {review && (
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-muted">Critico</dt>
                <dd className="min-w-0">
                  <span className="font-medium tabular-nums">{review.score}/10</span>
                  <span className="text-muted"> · {review.scrollStop ? "ferma lo scroll" : "non ferma lo scroll"} · {ctx.who(review.by)}</span>
                  {review.good && <span className="mt-1 block text-muted">{review.good}</span>}
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-auto space-y-2">
            {mode === "back" ? (
              <div className="space-y-2">
                <TextArea value={note} onChange={setNote} placeholder="Cosa va cambiato? Lo legge il producer." ariaLabel="Nota per la produzione" />
                <div className="flex flex-wrap justify-end gap-2">
                  <Btn onClick={() => setMode(null)} disabled={busy}>
                    Annulla
                  </Btn>
                  <Btn variant="chrome" onClick={() => go("produzione", note)} disabled={busy || !note.trim()}>
                    Rimanda in produzione
                  </Btn>
                </div>
              </div>
            ) : (
              <>
                <Btn variant="chrome" icon="play" onClick={() => go("in_test")} disabled={busy} className="h-11 w-full text-sm">
                  Metti in test
                </Btn>
                <div className="grid grid-cols-2 gap-2">
                  <Btn onClick={() => setMode("back")} disabled={busy}>
                    Rimanda
                  </Btn>
                  <Btn variant="danger" onClick={() => confirm("Scartare questo concept?") && go("scartato", "scartato da Branko")} disabled={busy}>
                    Scarta
                  </Btn>
                </div>
                <p className="text-center text-xs text-muted">Rimanda: torna al producer con la tua nota.</p>
              </>
            )}
            {error && <ErrorLine>{error}</ErrorLine>}
          </div>
        </div>
      </div>
    </section>
  );
}
