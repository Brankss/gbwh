"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { Icon } from "@/components/icons";
import { Button, Card, Empty, Field, PageBody, PageHeader, Pills, Progress, Section, inputClass } from "@/components/kit";
import { ProjectForm } from "@/components/project-form";
import { ago, send, useApi } from "@/lib/client";
import type { Knowledge } from "@/lib/hub";
import { LEARNING_KINDS, type Checkpoint, type LearningKind, type Project } from "@/lib/schemas";

type Full = { project: Project; checkpoints: Checkpoint[]; knowledge: Knowledge[] };

const KIND_LABEL: Record<LearningKind, string> = {
  errore: "Dagli errori",
  esperienza: "Esperienza",
  ricerca: "Ricerche",
  correzione: "Correzioni",
};

export default function ProjectPageShell() {
  // L'id del progetto arriva dall'URL solo a runtime: la pagina vera sta dentro <Suspense>.
  return (
    <Suspense fallback={<div className="m-6 h-40 skeleton rounded-[1.25rem]" />}>
      <ProjectPage />
    </Suspense>
  );
}

function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const key = `/api/c/projects/${id}`;
  const { data, error } = useApi<Full>(key, { refreshInterval: 30_000 });
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<"tutte" | LearningKind>("tutte");

  const back = (
    <Link href="/progetti" aria-label="Progetti" className="grid size-9 shrink-0 place-items-center press rounded-full text-[#b4b4b4] hover:bg-white/[0.07] hover:text-fg">
      <Icon name="back" />
    </Link>
  );

  if (error) {
    return (
      <>
        <PageHeader title="Progetto" back={back} />
        <PageBody>
          <Empty icon="folder" title="Progetto non trovato" />
        </PageBody>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <PageHeader title="…" back={back} />
        <PageBody>
          <div className="h-40 skeleton rounded-[1.25rem]" />
        </PageBody>
      </>
    );
  }

  const { project, checkpoints, knowledge } = data;
  const latest = checkpoints[0];
  const shownKnowledge = kind === "tutte" ? knowledge : knowledge.filter((k) => k.kind === kind);

  const del = async () => {
    if (!confirm(`Eliminare "${project.name}" e tutti i suoi checkpoint?`)) return;
    await send("DELETE", key, undefined, ["/api/c/projects"]);
    router.push("/progetti");
  };

  return (
    <>
      <PageHeader
        title={`${project.emoji ? `${project.emoji} ` : ""}${project.name}`}
        subtitle={`${project.status}${project.area ? ` · ${project.area}` : ""}`}
        back={back}
        actions={
          <Button small variant="ghost" onClick={() => setEditing(true)}>
            Modifica
          </Button>
        }
      />
      <PageBody>
        {project.description && <p className="text-[15px] whitespace-pre-wrap text-muted">{project.description}</p>}
        {project.links.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {project.links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="matte inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm hover:text-fg">
                <Icon name="link" className="size-3.5" /> {l.label}
              </a>
            ))}
          </div>
        )}

        <Section title="Stato attuale">
          {latest ? (
            <Card className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="font-medium text-fg">{latest.author}</span>
                <span>· {ago(latest.createdAt)}</span>
                {latest.progress !== undefined && <span className="ml-auto font-medium text-fg tabular-nums">{latest.progress}%</span>}
              </div>
              {latest.progress !== undefined && <Progress value={latest.progress} />}
              <p className="whitespace-pre-wrap">{latest.summary}</p>
              {latest.next.length > 0 && (
                <div>
                  <div className="mb-1 text-xs text-muted">Prossimi passi</div>
                  <ul className="space-y-1 text-sm">
                    {latest.next.map((n, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-muted">→</span>
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          ) : (
            <p className="text-sm text-muted">Ancora nessun checkpoint. Scrivi il primo qui sotto, o lascia che lo faccia un agent.</p>
          )}
        </Section>

        <NewCheckpoint projectId={project.id} lastProgress={latest?.progress} />

        <Section title={`Conoscenze · ${knowledge.length}`}>
          {knowledge.length > 0 && (
            <Pills
              value={kind}
              onChange={setKind}
              options={[
                { value: "tutte", label: "Tutte", count: knowledge.length },
                ...LEARNING_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k], count: knowledge.filter((x) => x.kind === k).length })),
              ]}
            />
          )}
          {shownKnowledge.length === 0 ? (
            <p className="text-sm text-muted">Le cose imparate (errori, esperienza, ricerche, correzioni) si accumulano qui da tutti i checkpoint.</p>
          ) : (
            <ul className="space-y-2">
              {shownKnowledge.map((k, i) => (
                <li key={`${k.checkpointId}-${i}`} className="matte rounded-2xl px-4 py-3">
                  <div className="mb-1 text-[11px] text-muted">
                    <span className="font-medium text-fg">{KIND_LABEL[k.kind]}</span> · {k.author} · {ago(k.at)}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{k.text}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {checkpoints.length > 1 && (
          <Section title="Cronologia">
            <ol className="relative space-y-4 border-l border-line pl-5">
              {checkpoints.slice(1).map((c) => (
                <li key={c.id} className="relative">
                  <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border border-line bg-surface-2" />
                  <div className="text-[11px] text-muted">
                    {c.author} · {ago(c.createdAt)}
                    {c.progress !== undefined && ` · ${c.progress}%`}
                  </div>
                  <p className="mt-0.5 text-sm whitespace-pre-wrap">{c.summary}</p>
                </li>
              ))}
            </ol>
          </Section>
        )}

        <div className="pt-4">
          <Button variant="danger" small icon="trash" onClick={del}>
            Elimina progetto
          </Button>
        </div>
      </PageBody>
      {editing && <ProjectForm project={project} onClose={() => setEditing(false)} />}
    </>
  );
}

function NewCheckpoint({ projectId, lastProgress }: { projectId: string; lastProgress?: number }) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [progress, setProgress] = useState<number | "">(lastProgress ?? "");
  const [next, setNext] = useState("");
  const [learnings, setLearnings] = useState<{ kind: LearningKind; text: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <Button icon="plus" variant="ghost" onClick={() => setOpen(true)}>
        Nuovo checkpoint
      </Button>
    );
  }

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await send(
        "POST",
        "/api/c/checkpoints",
        {
          projectId,
          summary,
          progress: progress === "" ? undefined : progress,
          next: next.split("\n").map((s) => s.trim()).filter(Boolean),
          learnings: learnings.filter((l) => l.text.trim()),
        },
        [`/api/c/projects/${projectId}`, "/api/c/projects"],
      );
      setSummary("");
      setNext("");
      setLearnings([]);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gloss space-y-4 rounded-[1.5rem] p-4">
      <Field label="A che punto siamo">
        <textarea className={`${inputClass} min-h-24 resize-y`} value={summary} onChange={(e) => setSummary(e.target.value)} autoFocus placeholder="Cosa è fatto, cosa no, cosa blocca…" />
      </Field>
      <Field label="Avanzamento" hint={progress === "" ? "facoltativo" : `${progress}%`}>
        <input type="range" min={0} max={100} step={5} value={progress === "" ? 0 : progress} onChange={(e) => setProgress(Number(e.target.value))} className="w-full accent-white" />
      </Field>
      <Field label="Prossimi passi" hint="uno per riga">
        <textarea className={`${inputClass} min-h-20 resize-y`} value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      <div className="space-y-2">
        <div className="text-xs text-muted">Cose imparate da non dimenticare</div>
        {learnings.map((l, i) => (
          <div key={i} className="flex gap-2">
            <select
              className="field w-36 shrink-0 text-sm"
              value={l.kind}
              onChange={(e) => setLearnings((ls) => ls.map((x, j) => (j === i ? { ...x, kind: e.target.value as LearningKind } : x)))}
            >
              {LEARNING_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
            <input
              className={inputClass}
              value={l.text}
              placeholder="Es. i video sotto i 15s convertono meglio"
              onChange={(e) => setLearnings((ls) => ls.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
            />
            <button aria-label="Togli" onClick={() => setLearnings((ls) => ls.filter((_, j) => j !== i))} className="shrink-0 px-2 text-muted hover:text-fg">
              <Icon name="close" className="size-4" />
            </button>
          </div>
        ))}
        <Button small variant="ghost" icon="plus" onClick={() => setLearnings((ls) => [...ls, { kind: "esperienza", text: "" }])}>
          Aggiungi
        </Button>
      </div>
      {error && <p className="text-sm text-[#ec8585]">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Annulla
        </Button>
        <Button onClick={save} disabled={!summary.trim() || busy}>
          {busy ? "Salvo…" : "Salva checkpoint"}
        </Button>
      </div>
    </div>
  );
}
