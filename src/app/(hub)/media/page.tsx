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
      <PageHeader wide title="Media" subtitle="Tutto quello che mandano i bot, più i tuoi file" actions={<UploadButton onDone={() => mutate()} />} />
      <PageBody wide>
        <div className="space-y-4">
          {controls}
          {!data ? (
            <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className="skeleton aspect-square rounded-xl" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <Empty icon="image" title={items.length ? "Nessun media con questi filtri" : "Ancora nessun media"}>
              {!items.length && "Quando un bot risponde con foto o video, finiscono qui da soli."}
            </Empty>
          ) : (
            <div className="stagger grid grid-cols-3 gap-2 md:grid-cols-5">
              {shown.map((m) => (
                <Thumb key={m.id} item={m} onClick={() => setOpen(m)} />
              ))}
            </div>
          )}
        </div>
      </PageBody>
      {open && (
        <Modal title={`${open.type === "video" ? "Video" : "Foto"} da ${open.sourceName}`} onClose={() => setOpen(null)}>
          {open.type === "video" ? (
            <video src={open.url} controls playsInline autoPlay className="max-h-[60dvh] w-full rounded-xl bg-black" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={open.url} alt="" referrerPolicy="no-referrer" className="max-h-[60dvh] w-full rounded-xl object-contain" />
          )}
          <div className="space-y-2 text-sm">
            <div className="text-xs text-muted">
              {open.sourceName} · {ago(open.createdAt)}
            </div>
            {open.caption && <p className="leading-relaxed whitespace-pre-wrap">{open.caption}</p>}
            <a href={open.url} target="_blank" rel="noreferrer" className="hit inline-flex items-center gap-1.5 text-[13px] font-medium underline decoration-white/30 underline-offset-4 hover:decoration-white">
              Apri originale
            </a>
          </div>
        </Modal>
      )}
    </>
  );
}
