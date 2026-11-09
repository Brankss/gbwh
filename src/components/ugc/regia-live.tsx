"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { send } from "@/lib/client";
import type { UgcLogEntry, UgcQuestion } from "@/lib/ugc";
import { FormError, UGC_KEY, briefTitle, chosenHook, nameOf, type UgcOverview } from "./common";
import { EventIcon, LiveDot, describe, rolesBeside, rolesOf, rolesText, since, visible } from "./regia-events";

// Regia, prima cosa che si vede: l'ultimo aggiornamento in grande, le (rare) domande dei bot
// come un aggiornamento qualsiasi, i video pronti da guardare e due righe di "poco fa".

const hrefOf = (e: { conceptId?: string; briefId?: string }) => (e.conceptId ? `/ugc/${e.conceptId}` : e.briefId ? `/ugc/brief/${e.briefId}` : null);

export function Live({ data, now, freshSince, onNewBrief, onNewConcept }: { data: UgcOverview; now: number; freshSince: number; onNewBrief: () => void; onNewConcept: () => void }) {
  // Domande e risposte hanno la loro riga (con le risposte rapide): nel flusso non si ripetono.
  const stream = visible(data.log).filter((e) => e.action !== "domanda" && e.action !== "risposta");
  const hero = stream[0];
  const earlier = stream.slice(1, 4);
  const open = data.questions.filter((q) => q.status === "aperta").sort((a, b) => b.createdAt - a.createdAt);
  const answered = data.questions
    .filter((q) => q.status !== "aperta" && q.answeredAt && now && now - q.answeredAt < 86_400_000)
    .sort((a, b) => (b.answeredAt ?? 0) - (a.answeredAt ?? 0))
    .slice(0, 2);
  const empty = !hero && !open.length && !data.concepts.length;

  return (
    <section className="space-y-3" aria-label="Aggiornamenti live">
      <div className="flex min-h-8 items-center gap-2">
        <LiveDot />
        <h2 className="eyebrow">Live</h2>
        {hero && <span className="ml-auto text-xs text-muted tabular-nums">ultimo evento {since(hero.at, now)}</span>}
      </div>

      {empty ? (
        <Welcome hasBriefs={data.briefList.length > 0} onNewBrief={onNewBrief} onNewConcept={onNewConcept} />
      ) : (
        <div className="panel rows overflow-hidden rounded-[1.25rem]">
          {hero ? <Hero key={hero.at} e={hero} data={data} now={now} fresh={hero.at > freshSince} /> : <Quiet />}
          {open.map((q) => (
            <Question key={q.id} q={q} data={data} now={now} />
          ))}
          {answered.map((q) => (
            <Answered key={q.id} q={q} data={data} />
          ))}
          {earlier.length > 0 && (
            <div className="py-1.5">
              {earlier.map((e) => (
                <Tick key={`${e.at}-${e.action}`} e={e} now={now} fresh={e.at > freshSince} />
              ))}
            </div>
          )}
        </div>
      )}

      <Ready data={data} now={now} />
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Hero({ e, data, now, fresh }: { e: UgcLogEntry; data: UgcOverview; now: number; fresh: boolean }) {
  const v = describe(e);
  const href = hrefOf(e);
  const roles = rolesBeside(data, e.by);
  const concept = e.conceptId ? data.concepts.find((c) => c.id === e.conceptId) : undefined;
  const sub = concept ? briefTitle(data.briefList, concept.briefId) : e.briefId ? "Brief" : null;
  const body = (
    <>
      <EventIcon view={v} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[13px]">
          <span className="font-medium" style={{ color: v.big ? "#f2f2f2" : undefined }}>
            {v.label}
          </span>
          {fresh && <span className="chrome rounded-full px-1.5 py-px text-[10px] font-bold tracking-wide uppercase">Nuovo</span>}
        </p>
        <p className="mt-1 line-clamp-2 text-xl leading-snug font-semibold tracking-[-0.015em] text-fg sm:text-[1.625rem]">{e.title}</p>
        {v.detail && <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-soft">{v.detail}</p>}
        <p className="mt-3 truncate text-xs text-muted">
          <span className="font-medium text-soft">{nameOf(data, e.by)}</span>
          <span className="tabular-nums"> · {since(e.at, now)}</span>
          {roles && ` · ${roles}`}
          {sub && ` · ${sub}`}
        </p>
      </div>
      {href && <Icon name="forward" className="mt-1 size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />}
    </>
  );
  const cls = `group flex gap-4 px-4 py-5 sm:px-6 sm:py-6 ${fresh ? "animate-pop" : ""}`;
  return href ? (
    <Link href={href} className={`${cls} row-link`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Tick({ e, now, fresh }: { e: UgcLogEntry; now: number; fresh: boolean }) {
  const v = describe(e);
  const href = hrefOf(e);
  const body = (
    <>
      <EventIcon view={v} size="sm" />
      <span className="min-w-0 flex-1 truncate text-[13px]">
        <span className="text-soft">{v.label}</span>
        <span className="text-muted"> · {e.title}</span>
      </span>
      <span className="shrink-0 text-[11px] text-muted tabular-nums">{since(e.at, now)}</span>
    </>
  );
  const cls = `flex min-h-10 items-center gap-3 px-4 py-1.5 sm:px-6 ${fresh ? "animate-rise" : ""}`;
  return href ? (
    <Link href={href} className={`${cls} row-link`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Quiet() {
  return (
    <div className="flex items-center gap-4 px-4 py-6 sm:px-6">
      <span className="orb blob grid size-12 shrink-0 place-items-center">
        <Icon name="clock" className="size-5" />
      </span>
      <div>
        <p className="font-semibold">Tutto tranquillo</p>
        <p className="text-sm text-muted">Appena un bot finisce qualcosa, lo vedi qui.</p>
      </div>
    </div>
  );
}

/** Fabbrica vuota: cosa fa la factory e da dove si parte. */
function Welcome({ hasBriefs, onNewBrief, onNewConcept }: { hasBriefs: boolean; onNewBrief: () => void; onNewConcept: () => void }) {
  const steps = [
    { n: "1", t: "Tu dai il brief", d: "Prodotto, chi compra, il problema." },
    { n: "2", t: "I bot lavorano", d: "Idea, gate del critico, script, produzione, revisione." },
    { n: "3", t: "Ti arriva il video", d: "Lo guardi e decidi se testarlo." },
  ];
  return (
    <div className="panel overflow-hidden rounded-[1.25rem]">
      <div className="flex items-center gap-4 px-4 pt-5 sm:px-6 sm:pt-6">
        <span className="orb blob grid size-12 shrink-0 place-items-center">
          <Icon name="film" className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-semibold tracking-tight">La factory è accesa, ma ferma</p>
          <p className="text-sm text-muted">Qui vedrai in diretta cosa fanno i bot.</p>
        </div>
      </div>
      <ol className="grid gap-px px-4 pt-5 sm:grid-cols-3 sm:px-6">
        {steps.map((s) => (
          <li key={s.n} className="flex gap-3 py-2 sm:flex-col sm:gap-2 sm:pr-4">
            <span className="grid size-6 shrink-0 place-items-center rounded-full border border-white/15 text-[11px] font-semibold text-soft tabular-nums">{s.n}</span>
            <span>
              <span className="block text-sm font-medium">{s.t}</span>
              <span className="block text-[13px] leading-snug text-muted">{s.d}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2 px-4 pt-3 pb-5 sm:px-6 sm:pb-6">
        <button onClick={hasBriefs ? onNewConcept : onNewBrief} className="press hit inline-flex h-10 items-center gap-1.5 rounded-full bg-white/[0.08] px-4 text-sm font-medium shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)] hover:bg-white/[0.12]">
          <Icon name="plus" className="size-4" />
          {hasBriefs ? "Primo concept" : "Primo brief"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Domande dei bot (rare): un aggiornamento come gli altri             */
/* ------------------------------------------------------------------ */

function asker(data: UgcOverview, q: UgcQuestion) {
  const roles = rolesText(rolesOf(data.settings, q.by));
  const name = nameOf(data, q.by);
  return { lead: roles || name, name: roles && roles.toLowerCase() !== name.toLowerCase() ? name : null };
}

function Question({ q, data, now }: { q: UgcQuestion; data: UgcOverview; now: number }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const who = asker(data, q);
  const concept = q.conceptId ? data.concepts.find((c) => c.id === q.conceptId) : undefined;

  const answer = async (value: string) => {
    const v = value.trim();
    if (!v || busy) return;
    setBusy(v);
    setError(null);
    try {
      await send("PATCH", `/api/ugc/questions/${q.id}`, { answer: v }, [UGC_KEY]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
      setBusy(null);
    }
  };
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    answer(text);
  };

  return (
    <div className="flex gap-4 px-4 py-4 sm:px-6 sm:py-5">
      <EventIcon view={{ icon: "chat", label: "", tone: "#c4c4c4" }} size="md" />
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
            <span className="font-medium text-soft">{who.lead} chiede</span>
            {who.name && <span>· {who.name}</span>}
            <span className="tabular-nums">· {since(q.createdAt, now)}</span>
          </p>
          <p className="mt-1 text-[15px] leading-snug text-fg">{q.text}</p>
          {concept && (
            <Link href={`/ugc/${concept.id}`} className="mt-1 inline-flex max-w-full items-center gap-1 text-xs text-muted hover:text-fg">
              <span className="truncate">{concept.title}</span>
              <Icon name="forward" className="size-3 shrink-0" />
            </Link>
          )}
        </div>
        {!!q.options?.length && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Risposte rapide">
            {q.options.map((o) => (
              <button key={o} disabled={!!busy} onClick={() => answer(o)} aria-pressed={busy === o} className="press chip h-10! max-w-full disabled:opacity-50">
                <span className="truncate">{o}</span>
              </button>
            ))}
          </div>
        )}
        <form onSubmit={submit} className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={q.options?.length ? "Oppure scrivi tu…" : "Rispondi…"}
            aria-label="Risposta"
            className="field h-10 min-w-0 flex-1 py-0! text-sm"
          />
          <button
            type="submit"
            disabled={!text.trim() || !!busy}
            aria-label="Invia risposta"
            className="press grid size-10 shrink-0 place-items-center rounded-full bg-white/[0.08] text-fg shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)] hover:bg-white/[0.12] disabled:opacity-35"
          >
            <Icon name="forward" className="size-4" />
          </button>
        </form>
        <FormError>{error}</FormError>
      </div>
    </div>
  );
}

function Answered({ q, data }: { q: UgcQuestion; data: UgcOverview }) {
  const who = asker(data, q);
  return (
    <div className="flex items-start gap-3 px-4 py-3 text-xs leading-relaxed text-muted sm:px-6">
      <Icon name="check" className="mt-0.5 size-3.5 shrink-0" />
      <p className="min-w-0">
        <span className="text-soft">{who.lead}</span> chiedeva «{q.text.length > 90 ? `${q.text.slice(0, 90)}…` : q.text}» · hai risposto <span className="text-soft">«{q.answer}»</span>
        {q.status === "chiusa" ? " · letta" : " · riparte da solo"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Video pronti: l'unico momento in cui tocca a Branko                 */
/* ------------------------------------------------------------------ */

function Ready({ data, now }: { data: UgcOverview; now: number }) {
  const ready = data.concepts.filter((c) => c.stage === "pronto").sort((a, b) => b.updatedAt - a.updatedAt);
  if (!ready.length) return null;
  return (
    <div className="gloss overflow-hidden rounded-[1.25rem]" aria-label="Video pronti">
      <p className="flex items-center gap-2 px-4 pt-3.5 text-xs font-medium text-soft sm:px-5">
        <span className="chrome grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10.5px] font-bold tabular-nums">{ready.length}</span>
        {ready.length === 1 ? "Video pronto da guardare" : "Video pronti da guardare"}
      </p>
      <div className="divide-y divide-white/[0.07]">
        {ready.slice(0, 3).map((c) => {
          const hook = chosenHook(c);
          return (
            <Link key={c.id} href={`/ugc/${c.id}`} className="group flex min-h-16 items-center gap-3.5 px-4 py-3 transition-colors hover:bg-white/[0.04] sm:px-5">
              <span className="chrome grid size-11 shrink-0 place-items-center rounded-full">
                <Icon name="play" className="size-4 translate-x-px" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{c.title}</span>
                <span className="block truncate text-xs text-muted">
                  {hook?.text ? `“${hook.text}”` : briefTitle(data.briefList, c.briefId)}
                </span>
              </span>
              <span className="hidden shrink-0 text-xs text-muted tabular-nums sm:inline">{since(c.updatedAt, now)}</span>
              <span className="hidden shrink-0 items-center gap-1 text-[13px] font-medium text-fg sm:inline-flex">
                Guarda <Icon name="forward" className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
              <Icon name="forward" className="size-4 shrink-0 text-muted sm:hidden" />
            </Link>
          );
        })}
        {ready.length > 3 && <p className="px-4 py-2.5 text-xs text-muted sm:px-5">e altri {ready.length - 3}: aprili dal blocco Pronto qui sotto.</p>}
      </div>
    </div>
  );
}
