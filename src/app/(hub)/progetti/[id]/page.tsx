"use client";

import { useParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { Icon } from "@/components/icons";
import { Button, Empty, Field, IconButton, List, PageBody, PageHeader, Pills, Progress, Section, inputClass } from "@/components/kit";
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
    <Suspense fallback={<div className="skeleton m-6 h-40 rounded-2xl" />}>
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
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<"tutte" | LearningKind>("tutte");

  const back = <IconButton href="/progetti" icon="back" label="Progetti" />;

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
          <div className="skeleton h-40 rounded-2xl" />
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
        {(project.description || project.links.length > 0) && (
          <div className="space-y-4">
            {project.description && <p className="max-w-2xl text-[15px] leading-relaxed whitespace-pre-wrap text-soft">{project.description}</p>}
            {project.links.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {project.links.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="press chip">
                    <Icon name="link" className="size-3.5" /> {l.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        <Section
          title="Stato attuale"
          action={
            !adding && (
              <Button small variant="ghost" icon="plus" onClick={() => setAdding(true)}>
                Nuovo checkpoint
              </Button>
            )
          }
        >
          {adding && <NewCheckpoint projectId={project.id} lastProgress={latest?.progress} onClose={() => setAdding(false)} />}
          {latest ? (
            <div className="panel overflow-hidden rounded-2xl">
              <div className="space-y-3 p-4 md:p-5">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="font-medium text-soft">{latest.author}</span>
                  <span>· {ago(latest.createdAt)}</span>
                  {latest.progress !== undefined && <span className="ml-auto text-sm font-semibold text-fg tabular-nums">{latest.progress}%</span>}
                </div>
                {latest.progress !== undefined && <Progress value={latest.progress} />}
                <p className="leading-relaxed whitespace-pre-wrap">{latest.summary}</p>
              </div>
              {latest.next.length > 0 && (
                <div className="border-t border-line px-4 py-3.5 md:px-5">
                  <div className="eyebrow mb-2">Prossimi passi</div>
                  <ul className="space-y-1.5 text-sm">
                    {latest.next.map((n, i) => (
                      <li key={i} className="flex gap-2.5">
                        <span className="text-muted">→</span>
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            !adding && <p className="panel rounded-2xl px-4 py-3.5 text-sm text-muted">Ancora nessun checkpoint. Scrivi il primo, o lascia che lo faccia un agent.</p>
          )}
        </Section>

        <Section title={`Conoscenze · ${knowledge.length}`}>
          {knowledge.length > 0 && (
            <Pills
              label="Filtra le conoscenze"
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
            <List>
              {shownKnowledge.map((k, i) => (
                <div key={`${k.checkpointId}-${i}`} className="px-4 py-3.5">
                  <div className="mb-1 text-xs text-muted">
                    <span className="font-medium text-soft">{KIND_LABEL[k.kind]}</span> · {k.author} · {ago(k.at)}
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{k.text}</p>
                </div>
              ))}
            </List>
          )}
        </Section>

        {checkpoints.length > 1 && (
          <Section title="Cronologia">
            <ol className="relative ml-1 space-y-5 border-l border-line pl-5">
              {checkpoints.slice(1).map((c) => (
                <li key={c.id} className="relative">
                  <span className="absolute top-1.5 -left-[25px] size-2 rounded-full bg-[#5a5a5a] ring-4 ring-bg" />
                  <div className="text-xs text-muted">
                    {c.author} · {ago(c.createdAt)}
                    {c.progress !== undefined && ` · ${c.progress}%`}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-soft">{c.summary}</p>
                </li>
              ))}
            </ol>
          </Section>
        )}

        <div className="border-t border-line pt-6">
          <Button variant="danger" small icon="trash" onClick={del}>
            Elimina progetto
          </Button>
        </div>
      </PageBody>
      {editing && <ProjectForm project={project} onClose={() => setEditing(false)} />}
    </>
  );
}

function NewCheckpoint({ projectId, lastProgress, onClose }: { projectId: string; lastProgress?: number; onClose: () => void }) {
  const [summary, setSummary] = useState("");
  const [progress, setProgress] = useState<number | "">(lastProgress ?? "");
  const [next, setNext] = useState("");
  const [learnings, setLearnings] = useState<{ kind: LearningKind; text: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel animate-rise overflow-hidden rounded-2xl border-white/[0.14]!">
      <div className="space-y-5 p-4 md:p-5">
        <Field label="A che punto siamo">
          <textarea className={`${inputClass} min-h-24 resize-y`} value={summary} onChange={(e) => setSummary(e.target.value)} autoFocus placeholder="Cosa è fatto, cosa no, cosa blocca…" />
        </Field>
        <Field label="Avanzamento" hint={progress === "" ? "facoltativo" : `${progress}%`}>
          <input type="range" min={0} max={100} step={5} value={progress === "" ? 0 : progress} onChange={(e) => setProgress(Number(e.target.value))} className="h-9 w-full accent-white" />
        </Field>
        <Field label="Prossimi passi" hint="uno per riga">
          <textarea className={`${inputClass} min-h-20 resize-y`} value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <div className="space-y-2">
          <div className="text-xs font-medium text-soft">Cose imparate da non dimenticare</div>
          {learnings.map((l, i) => (
            <div key={i} className="flex flex-col gap-2 sm:flex-row">
              <select
                className="field shrink-0 text-sm sm:w-40"
                value={l.kind}
                onChange={(e) => setLearnings((ls) => ls.map((x, j) => (j === i ? { ...x, kind: e.target.value as LearningKind } : x)))}
              >
                {LEARNING_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <div className="flex min-w-0 flex-1 gap-1">
                <input
                  className={inputClass}
                  value={l.text}
                  placeholder="Es. i video sotto i 15s convertono meglio"
                  onChange={(e) => setLearnings((ls) => ls.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                />
                <IconButton icon="close" label="Togli" onClick={() => setLearnings((ls) => ls.filter((_, j) => j !== i))} className="mt-1" />
              </div>
            </div>
          ))}
          <Button small variant="ghost" icon="plus" onClick={() => setLearnings((ls) => [...ls, { kind: "esperienza", text: "" }])}>
            Aggiungi
          </Button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-4 py-3 md:px-5">
        <Button variant="ghost" onClick={onClose}>
          Annulla
        </Button>
        <Button onClick={save} disabled={!summary.trim() || busy}>
          {busy ? "Salvo…" : "Salva checkpoint"}
        </Button>
      </div>
    </div>
  );
}
