"use client";

import { useState } from "react";
import { ago } from "@/lib/client";
import { MAX_CATEGORIES, PALETTE, type CalSettings, type Category } from "@/lib/calendar";
import { Icon } from "../icons";
import { Button, Field, Modal, inputClass } from "../kit";
import { saveSettings, type CalMeta, type Toast } from "./data";
import { Segmented } from "./editor";
import { Block, RequestCard } from "./side-panel";

type Tab = "agenti" | "categorie" | "richieste" | "registro";

export function CalendarSettings({ meta, onClose, onToast, initialTab = "agenti" }: { meta: CalMeta; onClose: () => void; onToast: (t: Toast) => void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const s = meta.settings;
  const byName = (id: string) => (id === "tu" ? "Tu" : (meta.bots.find((b) => b.id === id)?.name ?? id));
  const pending = meta.requests.filter((r) => r.status === "pending").length;

  return (
    <Modal title="Impostazioni calendario" onClose={onClose}>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "agenti", label: "Agenti" },
          { value: "categorie", label: "Categorie" },
          { value: "richieste", label: pending ? `Richieste (${pending})` : "Richieste" },
          { value: "registro", label: "Registro" },
        ]}
      />
      {tab === "agenti" && <AgentsTab key={JSON.stringify([s.manager, s.prefs, s.dayStart, s.dayEnd])} meta={meta} onToast={onToast} />}
      {tab === "categorie" && <CategoriesTab key={JSON.stringify(s.categories)} categories={s.categories} onToast={onToast} />}
      {tab === "richieste" && (
        <div className="space-y-2">
          {meta.requests.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              Nessuna richiesta. Quando scegli un gestore, le modifiche degli altri agent arrivano qui e a lui.
            </p>
          ) : (
            meta.requests.map((r) => <RequestCard key={r.id} r={r} byName={byName} onToast={onToast} />)
          )}
        </div>
      )}
      {tab === "registro" && (
        <div className="space-y-2">
          {meta.log.length === 0 && <p className="py-6 text-center text-sm text-muted">Ancora nessuna modifica.</p>}
          {meta.log.map((l, i) => (
            <div key={`${l.at}-${i}`} className="flex gap-2.5 text-[13px] leading-snug">
              <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${l.by === "tu" ? "bg-white/40" : "bg-white"}`} />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{byName(l.by)}</span> <span className="text-muted">{l.action}</span> «{l.title}»
                {l.when && <span className="text-muted"> · {l.when}</span>}
              </span>
              <span className="shrink-0 text-[11px] text-muted">{ago(l.at)}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function AgentsTab({ meta, onToast }: { meta: CalMeta; onToast: (t: Toast) => void }) {
  const s = meta.settings;
  const [manager, setManager] = useState(s.manager ?? "");
  const [prefs, setPrefs] = useState(s.prefs);
  const [dayStart, setDayStart] = useState(s.dayStart);
  const [dayEnd, setDayEnd] = useState(s.dayEnd);
  const [busy, setBusy] = useState(false);
  const dirty = manager !== (s.manager ?? "") || prefs !== s.prefs || dayStart !== s.dayStart || dayEnd !== s.dayEnd;

  const save = async () => {
    setBusy(true);
    try {
      await saveSettings({ manager: manager || null, prefs, dayStart, dayEnd });
      onToast({ text: "Impostazioni salvate" });
    } catch (e) {
      onToast({ text: e instanceof Error ? e.message : "Errore", error: true });
    }
    setBusy(false);
  };

  const site = typeof location === "undefined" ? "" : location.origin;
  const prompt = [
    `Hai accesso al calendario di Branko. Leggi le istruzioni con GET ${site}/api/agent/calendar (header Authorization: Bearer <token>).`,
    "Ogni modifica la mandi col tuo id nel campo 'agent'. Puoi scrivere frasi in italiano nel campo 'text' (es. \"palestra domani 18-19:30 #sport\").",
    manager ? `Il gestore del calendario è '${manager}': se non sei tu, le tue modifiche diventano richieste per lui (lo fa il sistema da solo).` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="space-y-5">
      <Field label="Gestore del calendario" hint="facoltativo">
        <select value={manager} onChange={(e) => setManager(e.target.value)} className={inputClass}>
          <option value="">Nessuno: ogni agent modifica direttamente</option>
          {meta.bots.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.id})
            </option>
          ))}
        </select>
      </Field>
      <p className="-mt-3 text-[12.5px] leading-relaxed text-muted">
        Con un gestore, le modifiche degli <em>altri</em> agent diventano richieste: il gestore viene svegliato via email e decide lui. Tu modifichi sempre
        direttamente. Il gestore compare in questa lista appena scrive in bacheca o manda un heartbeat.
      </p>

      <Field label="Cosa deve sapere chi organizza il tuo tempo" hint="lo leggono tutti gli agent">
        <textarea
          value={prefs}
          onChange={(e) => setPrefs(e.target.value)}
          rows={5}
          maxLength={4000}
          placeholder={"Es: mi sveglio verso le 9. Palestra meglio di sera. Niente call prima delle 11. Il venerdì sera è libero."}
          className={`${inputClass} resize-y`}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="La giornata inizia alle">
          <select value={dayStart} onChange={(e) => setDayStart(+e.target.value)} className={inputClass}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </Field>
        <Field label="e finisce alle">
          <select value={dayEnd} onChange={(e) => setDayEnd(+e.target.value)} className={inputClass}>
            {Array.from({ length: 24 }, (_, h) => h + 1)
              .filter((h) => h > dayStart)
              .map((h) => (
                <option key={h} value={h}>
                  {String(h % 24).padStart(2, "0")}:00
                </option>
              ))}
          </select>
        </Field>
      </div>
      <p className="-mt-3 text-[12.5px] text-muted">Dentro questa fascia si cercano gli spazi liberi (tuoi e degli agent).</p>

      <div className="flex justify-end">
        <Button icon="check" onClick={save} disabled={!dirty || busy}>
          Salva
        </Button>
      </div>

      <Block title="Da dare a un agent">
        <pre className="matte rounded-xl p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-[#c8c8c8]">{prompt}</pre>
        <Button
          small
          variant="ghost"
          icon="copy"
          onClick={async () => {
            await navigator.clipboard.writeText(prompt).catch(() => {});
            onToast({ text: "Istruzioni copiate" });
          }}
        >
          Copia
        </Button>
      </Block>
    </div>
  );
}

function CategoriesTab({ categories, onToast }: { categories: Category[]; onToast: (t: Toast) => void }) {
  const [list, setList] = useState<Category[]>(categories);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(list) !== JSON.stringify(categories);
  const edit = (i: number, patch: Partial<Category>) => setList((l) => l.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const save = async () => {
    setBusy(true);
    try {
      await saveSettings({ categories: list.filter((c) => c.name.trim()) } as Partial<CalSettings>);
      onToast({ text: "Categorie salvate" });
    } catch (e) {
      onToast({ text: e instanceof Error ? e.message : "Errore", error: true });
    }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] leading-relaxed text-muted">
        Le categorie colorano il calendario e dicono dove va il tuo tempo. Cambiale quando vuoi: la routine si costruisce strada facendo.
      </p>
      {list.map((c, i) => (
        <div key={c.id || i} className="matte flex items-center gap-2 rounded-xl p-2">
          <input value={c.name} onChange={(e) => edit(i, { name: e.target.value })} className="field h-9 min-w-0 flex-1 py-0 text-[14px]" maxLength={30} />
          <div className="flex gap-1">
            {PALETTE.map((col) => (
              <button
                key={col}
                type="button"
                aria-label={`Colore ${col}`}
                onClick={() => edit(i, { color: col })}
                className={`press size-5 rounded-full ${c.color === col ? "ring-2 ring-white ring-offset-2 ring-offset-black" : ""}`}
                style={{ background: col }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setList((l) => l.filter((_, j) => j !== i))}
            aria-label={`Elimina ${c.name}`}
            className="press grid size-8 place-items-center rounded-lg text-muted hover:bg-white/[0.06] hover:text-[#ec8585]"
          >
            <Icon name="trash" className="size-4" />
          </button>
        </div>
      ))}
      <div className="flex justify-between gap-2">
        <Button
          small
          variant="ghost"
          icon="plus"
          disabled={list.length >= MAX_CATEGORIES}
          onClick={() => setList((l) => [...l, { id: "", name: "", color: PALETTE[l.length % PALETTE.length] }])}
        >
          Nuova categoria
        </Button>
        <Button icon="check" onClick={save} disabled={!dirty || busy}>
          Salva
        </Button>
      </div>
    </div>
  );
}
