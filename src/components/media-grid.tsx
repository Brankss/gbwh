"use client";

import { useMemo, useRef, useState } from "react";
import { useApi } from "@/lib/client";
import type { MediaItem, MediaRef } from "@/lib/schemas";
import { Icon } from "./icons";
import { Button, Empty, Modal, Pills, Tabs } from "./kit";

type TypeFilter = "tutti" | "image" | "video";

/** Filtri condivisi: per fonte (bot / tu) e per tipo. */
export function useMediaFilters(items: MediaItem[]) {
  const [source, setSource] = useState("tutti");
  const [type, setType] = useState<TypeFilter>("tutti");
  const sources = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const m of items) map.set(m.source, { name: m.sourceName, count: (map.get(m.source)?.count ?? 0) + 1 });
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [items]);
  const shown = items.filter((m) => (source === "tutti" || m.source === source) && (type === "tutti" || m.type === type));

  const controls = (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 md:flex-1">
        <Pills
          label="Filtra per fonte"
          value={source}
          onChange={setSource}
          options={[{ value: "tutti", label: "Tutti", count: items.length }, ...sources.map(([id, s]) => ({ value: id, label: s.name, count: s.count }))]}
        />
      </div>
      <Tabs
        value={type}
        onChange={setType}
        options={[
          { value: "tutti", label: "Foto e video" },
          { value: "image", label: "Foto", count: items.filter((m) => m.type === "image").length },
          { value: "video", label: "Video", count: items.filter((m) => m.type === "video").length },
        ]}
      />
    </div>
  );
  return { shown, controls };
}

export function Thumb({ item, selected, onClick }: { item: MediaRef & { sourceName?: string }; selected?: boolean; onClick?: () => void }) {
  // Senza onClick è solo un'immagine: così si può mettere dentro card già cliccabili.
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`group relative block aspect-square w-full overflow-hidden rounded-xl bg-surface-2 transition-all after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.07)] ${selected ? "ring-2 ring-white ring-offset-2 ring-offset-[#0a0a0a]" : onClick ? "press hover:brightness-110" : ""}`}
    >
      {item.type === "video" ? (
        <video src={`${item.url}#t=0.1`} muted playsInline preload="metadata" className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
      )}
      {item.type === "video" && (
        <span className="absolute top-1.5 left-1.5 grid size-6 place-items-center rounded-full bg-black/60 text-[10px] backdrop-blur-sm">▶</span>
      )}
      {item.sourceName && (
        <span className="absolute right-1.5 bottom-1.5 max-w-[calc(100%-0.75rem)] truncate rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm">{item.sourceName}</span>
      )}
      {selected && (
        <span className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-white text-black">
          <Icon name="check" className="size-3.5" />
        </span>
      )}
    </Tag>
  );
}

/** Finestra per scegliere media dalla libreria (per prodotti e pubblicità). */
export function MediaPicker({ value, onChange, onClose }: { value: MediaRef[]; onChange: (v: MediaRef[]) => void; onClose: () => void }) {
  const { data } = useApi<{ items: MediaItem[] }>("/api/media");
  const items = data?.items ?? [];
  const { shown, controls } = useMediaFilters(items);
  const [picked, setPicked] = useState<MediaRef[]>(value);
  const toggle = (m: MediaItem) =>
    setPicked((p) => (p.some((x) => x.id === m.id) ? p.filter((x) => x.id !== m.id) : [...p, { id: m.id, url: m.url, type: m.type }]));

  return (
    <Modal
      title="Scegli dai media"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button
            onClick={() => {
              onChange(picked);
              onClose();
            }}
          >
            Usa {picked.length || ""}
          </Button>
        </>
      }
    >
      {controls}
      {!data ? (
        <div className="skeleton h-40 rounded-2xl" />
      ) : shown.length === 0 ? (
        <Empty icon="image" title="Nessun media">
          Quando un bot manda foto o video, li trovi qui.
        </Empty>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {shown.map((m) => (
            <Thumb key={m.id} item={m} selected={picked.some((p) => p.id === m.id)} onClick={() => toggle(m)} />
          ))}
        </div>
      )}
    </Modal>
  );
}

/** Pulsante "Carica" per i tuoi file. */
export function UploadButton({ onDone }: { onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    for (const f of Array.from(files)) form.append("file", f);
    const res = await fetch("/api/media", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "Upload fallito");
    setBusy(false);
    if (input.current) input.current.value = "";
    onDone();
  };

  return (
    <>
      <input ref={input} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => upload(e.target.files)} />
      <Button icon="upload" onClick={() => input.current?.click()} disabled={busy}>
        {busy ? "Carico…" : "Carica"}
      </Button>
      {error && <span className="max-w-[9rem] truncate text-xs text-danger" title={error}>{error}</span>}
    </>
  );
}
