"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Button, Field, Modal, inputClass } from "@/components/kit";
import { send, useApi } from "@/lib/client";
import type { Product } from "@/lib/schemas";
import type { Angle, UgcBrief } from "@/lib/ugc";
import { FormError, UGC_KEY, briefKey, useSave } from "./common";

// Crea o modifica un brief: tutti i campi di briefInput, angoli compresi.

const STATUS: UgcBrief["status"][] = ["attivo", "in pausa", "chiuso"];

type Draft = Omit<UgcBrief, "id" | "createdAt" | "updatedAt" | "by" | "angles"> & { angles: (Omit<Angle, "id"> & { id?: string; key: string })[] };

const blank = (): Draft => ({
  title: "",
  productId: "",
  productName: "",
  productUrl: "",
  target: "",
  problem: "",
  promise: "",
  proof: "",
  offer: "",
  objections: "",
  notes: "",
  angles: [],
  status: "attivo",
});

let keySeq = 0;
const newKey = () => `a${++keySeq}`;

export function BriefForm({ brief, onClose, onSaved }: { brief?: UgcBrief; onClose: () => void; onSaved?: (b: UgcBrief) => void }) {
  const [f, setF] = useState<Draft>(() => {
    if (!brief) return blank();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, createdAt, updatedAt, by, angles, ...fields } = brief;
    return { ...blank(), ...fields, angles: angles.map((a) => ({ ...a, key: newKey() })) };
  });
  const products = useApi<{ items: Product[] }>("/api/c/products");
  const { error, busy, run } = useSave();
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const pickProduct = (id: string) => {
    const p = products.data?.items.find((x) => x.id === id);
    setF((x) => ({ ...x, productId: id, productName: x.productName.trim() || !p ? x.productName : p.name, productUrl: x.productUrl || p?.storeUrl || "" }));
  };

  const setAngle = (key: string, patch: Partial<Draft["angles"][number]>) => setF((x) => ({ ...x, angles: x.angles.map((a) => (a.key === key ? { ...a, ...patch } : a)) }));
  const addAngle = () => setF((x) => ({ ...x, angles: [...x.angles, { key: newKey(), text: "", why: "" }] }));
  const dropAngle = (key: string) => setF((x) => ({ ...x, angles: x.angles.filter((a) => a.key !== key) }));

  const ready = f.title.trim() && f.productName.trim() && f.target.trim() && f.problem.trim();

  const save = () =>
    run(async () => {
      const body = {
        ...f,
        productId: f.productId || undefined,
        angles: f.angles.filter((a) => a.text.trim()).map(({ id, text, why }) => ({ id, text, why })),
      };
      const res = brief
        ? await send<{ brief: UgcBrief }>("PATCH", briefKey(brief.id), body, [UGC_KEY, briefKey(brief.id)])
        : await send<{ brief: UgcBrief }>("POST", "/api/ugc/briefs", body, [UGC_KEY]);
      onSaved?.(res.brief);
      onClose();
    });

  const area = `${inputClass} min-h-20 resize-y`;
  const productList = products.data?.items ?? [];

  return (
    <Modal
      title={brief ? "Modifica brief" : "Nuovo brief"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button disabled={!ready || busy} onClick={save}>
            {brief ? "Salva" : "Crea brief"}
          </Button>
        </>
      }
    >
      <Field label="Titolo" hint="obbligatorio">
        <input className={inputClass} value={f.title} onChange={set("title")} autoFocus={!brief} placeholder="Es. Succo di mango, estate" />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Prodotto" hint="obbligatorio">
          <input className={inputClass} value={f.productName} onChange={set("productName")} placeholder="Nome del prodotto" />
        </Field>
        <Field label="Stato">
          <select className={inputClass} value={f.status} onChange={set("status")}>
            {STATUS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      </div>
      {productList.length > 0 && (
        <Field label="Collega a Dropshipping" hint="facoltativo">
          <select className={inputClass} value={f.productId ?? ""} onChange={(e) => pickProduct(e.target.value)}>
            <option value="">— nessun prodotto —</option>
            {productList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Link al prodotto">
        <input className={inputClass} value={f.productUrl} onChange={set("productUrl")} placeholder="https://…" inputMode="url" />
      </Field>

      <Field label="Target" hint="chi compra">
        <textarea className={area} value={f.target} onChange={set("target")} placeholder="Età, situazione, cosa desidera" />
      </Field>
      <Field label="Problema o desiderio" hint="da qui parte tutto">
        <textarea className={area} value={f.problem} onChange={set("problem")} />
      </Field>
      <Field label="Promessa" hint="cosa ottiene chi compra">
        <textarea className={area} value={f.promise} onChange={set("promise")} />
      </Field>
      <Field label="Prove" hint="numeri, recensioni, demo">
        <textarea className={area} value={f.proof} onChange={set("proof")} />
      </Field>
      <Field label="Offerta">
        <input className={inputClass} value={f.offer} onChange={set("offer")} placeholder="Es. -20% e spedizione gratis" />
      </Field>
      <Field label="Obiezioni" hint="i dubbi di chi non compra">
        <textarea className={area} value={f.objections} onChange={set("objections")} />
      </Field>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-medium text-[#b4b4b4]">Angoli di vendita</span>
          <span className="text-muted">{f.angles.length ? `${f.angles.length}` : "3–5 diversi è l'ideale"}</span>
        </div>
        {f.angles.length > 0 && (
          <ol className="divide-y divide-line overflow-hidden rounded-[0.875rem] border border-line">
            {f.angles.map((a, i) => (
              <li key={a.key} className="flex gap-2 p-2.5">
                <span className="w-5 shrink-0 pt-2.5 text-center text-xs text-muted tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <input
                    className={`${inputClass} py-2!`}
                    value={a.text}
                    onChange={(e) => setAngle(a.key, { text: e.target.value })}
                    placeholder="L'angolo, in una frase"
                    aria-label={`Angolo ${i + 1}`}
                  />
                  <input
                    className={`${inputClass} py-2! text-sm!`}
                    value={a.why ?? ""}
                    onChange={(e) => setAngle(a.key, { why: e.target.value })}
                    placeholder="Perché può funzionare (facoltativo)"
                    aria-label={`Perché l'angolo ${i + 1}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => dropAngle(a.key)}
                  aria-label={`Togli l'angolo ${i + 1}`}
                  className="press grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-white/[0.06] hover:text-[#ec8585]"
                >
                  <Icon name="close" className="size-4" />
                </button>
              </li>
            ))}
          </ol>
        )}
        <Button variant="ghost" icon="plus" onClick={addAngle}>
          Aggiungi angolo
        </Button>
      </div>

      <Field label="Note">
        <textarea className={area} value={f.notes} onChange={set("notes")} />
      </Field>
      <FormError>{error}</FormError>
    </Modal>
  );
}
