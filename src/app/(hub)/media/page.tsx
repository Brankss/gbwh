"use client";

import { useState } from "react";
import { Empty, Modal, PageBody, PageHeader } from "@/components/kit";
import { Thumb, UploadButton, useMediaFilters } from "@/components/media-grid";
import { ago, useApi } from "@/lib/client";
import type { MediaItem } from "@/lib/schemas";

export default function MediaPage() {
  const { data, mutate } = useApi<{ items: MediaItem[] }>("/api/media", { refreshInterval: 30_000 });
  const items = data?.items ?? [];
  const { shown, controls } = useMediaFilters(items);
  const [open, setOpen] = useState<MediaItem | null>(null);

  return (
    <>
      <PageHeader title="Media" subtitle="Tutto quello che mandano i bot, più i tuoi file" actions={<UploadButton onDone={() => mutate()} />} />
      <PageBody wide>
        {controls}
        {!data ? (
          <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-2xl bg-surface-2" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <Empty icon="image" title={items.length ? "Nessun media con questi filtri" : "Ancora nessun media"}>
            {!items.length && "Quando un bot risponde con foto o video, finiscono qui da soli."}
          </Empty>
        ) : (
          <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
            {shown.map((m) => (
              <Thumb key={m.id} item={m} onClick={() => setOpen(m)} />
            ))}
          </div>
        )}
      </PageBody>
      {open && (
        <Modal title={`${open.type === "video" ? "Video" : "Foto"} da ${open.sourceName}`} onClose={() => setOpen(null)}>
          {open.type === "video" ? (
            <video src={open.url} controls playsInline autoPlay className="max-h-[60dvh] w-full rounded-2xl bg-black" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={open.url} alt="" referrerPolicy="no-referrer" className="max-h-[60dvh] w-full rounded-2xl object-contain" />
          )}
          <div className="text-sm">
            <div className="text-xs text-muted">
              {open.sourceName} · {ago(open.createdAt)}
            </div>
            {open.caption && <p className="mt-1 whitespace-pre-wrap">{open.caption}</p>}
            <a href={open.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs underline underline-offset-2">
              Apri originale
            </a>
          </div>
        </Modal>
      )}
    </>
  );
}
