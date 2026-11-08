"use client";

import type { UgcVideo } from "@/lib/ugc";

// Video (o immagine) di una versione: verticale, intero, sul nero.

export function ConceptMedia({ media, className = "" }: { media: UgcVideo["media"]; className?: string }) {
  if (media.type === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={media.url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className={`block h-auto w-full object-contain ${className}`} />;
  }
  return <video src={`${media.url}#t=0.1`} controls playsInline preload="metadata" className={`block w-full bg-black object-contain ${className}`} />;
}
