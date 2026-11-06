"use client";

import { useState } from "react";
import { send } from "@/lib/client";
import { PROJECT_STATUS, type Project } from "@/lib/schemas";
import { Button, Field, Modal, inputClass } from "./kit";

/** Crea o modifica un progetto. */
export function ProjectForm({ project, onClose, onSaved }: { project?: Project; onClose: () => void; onSaved?: (p: Project) => void }) {
  const [form, setForm] = useState({
    name: project?.name ?? "",
    emoji: project?.emoji ?? "",
    status: project?.status ?? "attivo",
    area: project?.area ?? "",
    description: project?.description ?? "",
    links: (project?.links ?? []).map((l) => `${l.label} ${l.url}`).join("\n"),
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setBusy(true);
    setError(null);
    // Link: una riga per link, "Etichetta https://…" oppure solo l'URL.
    const links = form.links
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const m = /^(.*?)\s*(https?:\/\/\S+)$/.exec(l);
        return m ? { label: m[1] || new URL(m[2]).hostname, url: m[2] } : { label: l, url: l };
      });
    try {
      const body = { ...form, links };
      const res = project
        ? await send<{ item: Project }>("PATCH", `/api/c/projects/${project.id}`, body, ["/api/c/projects", `/api/c/projects/${project.id}`])
        : await send<{ item: Project }>("POST", "/api/c/projects", body, ["/api/c/projects"]);
      onSaved?.(res.item);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={project ? "Modifica progetto" : "Nuovo progetto"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={save} disabled={!form.name.trim() || busy}>
            {busy ? "Salvo…" : "Salva"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[4.5rem_1fr] gap-3">
        <Field label="Emoji">
          <input className={`${inputClass} text-center`} value={form.emoji} onChange={set("emoji")} placeholder="🚀" maxLength={8} />
        </Field>
        <Field label="Nome">
          <input className={inputClass} value={form.name} onChange={set("name")} placeholder="Es. Store dropshipping" autoFocus />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Stato">
          <select className={inputClass} value={form.status} onChange={set("status")}>
            {PROJECT_STATUS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Area" hint="facoltativa">
          <input className={inputClass} value={form.area} onChange={set("area")} placeholder="dropshipping, codice, vita…" />
        </Field>
      </div>
      <Field label="Descrizione">
        <textarea className={`${inputClass} min-h-24 resize-y`} value={form.description} onChange={set("description")} placeholder="Di cosa si tratta, obiettivo…" />
      </Field>
      <Field label="Link" hint="uno per riga">
        <textarea className={`${inputClass} min-h-20 resize-y font-mono text-sm`} value={form.links} onChange={set("links")} placeholder={"Store https://…\nRepo https://github.com/…"} />
      </Field>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </Modal>
  );
}
