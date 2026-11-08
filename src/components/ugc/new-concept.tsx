"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { Button, Field, Modal, inputClass } from "@/components/kit";
import { send } from "@/lib/client";
import type { UgcBrief, UgcConcept } from "@/lib/ugc";
import { FORMATS, formatOf } from "@/lib/ugc-library";
import type { BriefSummary } from "@/lib/ugc-store";
import { FormError, UGC_KEY, briefKey, useSave } from "./common";

// Nuovo concept: brief, titolo, angolo, format, perché ferma lo scroll. Poi si apre il concept.

const FREE = "__libero__";
const ANGLE_HINT = "Da che lato prendi il prodotto, in una frase";

export function NewConcept({
  briefs,
  briefId: initialBrief,
  onClose,
  onNewBrief,
}: {
  briefs: (BriefSummary | UgcBrief)[];
  briefId?: string;
  onClose: () => void;
  /** Se non ci sono brief: apre la creazione di un brief. */
  onNewBrief?: () => void;
}) {
  const router = useRouter();
  const usable = briefs.filter((b) => b.status !== "chiuso" || b.id === initialBrief);
  const [briefId, setBriefId] = useState(initialBrief ?? (usable.length === 1 ? usable[0].id : ""));
  const [title, setTitle] = useState("");
  const [anglePick, setAnglePick] = useState("");
  const [angleText, setAngleText] = useState("");
  const [format, setFormat] = useState("");
  const [why, setWhy] = useState("");
  const { error, busy, run } = useSave();

  const brief = usable.find((b) => b.id === briefId);
  const angles = brief?.angles ?? [];
  const free = !angles.length || anglePick === FREE;
  const angle = free ? angleText : (angles.find((a) => a.id === anglePick)?.text ?? "");
  const pickedWhy = free ? undefined : angles.find((a) => a.id === anglePick)?.why;
  const fmt = formatOf(format);
  const ready = briefId && title.trim() && angle.trim() && format;

  const create = () =>
    run(async () => {
      const res = await send<{ concept: UgcConcept }>("POST", "/api/ugc/concepts", { briefId, title, angle, format, why: why || undefined }, [UGC_KEY, briefKey(briefId)]);
      router.push(`/ugc/${res.concept.id}`);
    });

  if (!usable.length) {
    return (
      <Modal title="Nuovo concept" onClose={onClose}>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="orb grid size-12 place-items-center rounded-full">
            <Icon name="folder" className="size-5" />
          </span>
          <p className="font-semibold">Prima serve un brief</p>
          <p className="max-w-xs text-sm text-muted">Il concept parte da un prodotto, un target e un problema. Crea il brief, poi torna qui.</p>
          {onNewBrief && (
            <Button icon="plus" onClick={onNewBrief}>
              Crea un brief
            </Button>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Nuovo concept"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button disabled={!ready || busy} onClick={create}>
            Crea e apri
          </Button>
        </>
      }
    >
      <Field label="Brief">
        <select
          className={inputClass}
          value={briefId}
          onChange={(e) => {
            setBriefId(e.target.value);
            setAnglePick("");
          }}
        >
          <option value="" disabled>
            Scegli il brief…
          </option>
          {usable.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title} · {b.productName}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Titolo">
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Es. La mattina che odiavi l'estate" />
      </Field>

      <Field label="Angolo" hint={brief && !angles.length ? "il brief non ha angoli: scrivilo tu" : undefined}>
        {angles.length > 0 ? (
          <select className={inputClass} value={anglePick} onChange={(e) => setAnglePick(e.target.value)}>
            <option value="" disabled>
              Scegli un angolo del brief…
            </option>
            {angles.map((a) => (
              <option key={a.id} value={a.id}>
                {a.text}
              </option>
            ))}
            <option value={FREE}>Scrivo io un angolo nuovo</option>
          </select>
        ) : (
          <textarea className={`${inputClass} min-h-16 resize-y`} value={angleText} onChange={(e) => setAngleText(e.target.value)} placeholder={ANGLE_HINT} />
        )}
      </Field>
      {angles.length > 0 && free && (
        <textarea
          className={`${inputClass} -mt-2 min-h-16 resize-y`}
          value={angleText}
          onChange={(e) => setAngleText(e.target.value)}
          placeholder={ANGLE_HINT}
          aria-label="Angolo nuovo"
          autoFocus
        />
      )}
      {pickedWhy && <p className="-mt-2 text-xs leading-relaxed text-muted">{pickedWhy}</p>}

      <Field label="Format">
        <select className={inputClass} value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="" disabled>
            Scegli dalla libreria…
          </option>
          {FORMATS.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </Field>
      {fmt?.when && <p className="-mt-2 text-xs leading-relaxed text-muted">Quando: {fmt.when}</p>}

      <Field label="Perché ferma lo scroll" hint="la tesi">
        <textarea className={`${inputClass} min-h-20 resize-y`} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Cosa vede chi scrolla nei primi 2 secondi, e perché si ferma" />
      </Field>
      <FormError>{error}</FormError>
    </Modal>
  );
}
