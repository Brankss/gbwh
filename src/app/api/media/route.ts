import { connection, type NextRequest } from "next/server";
import { put, stamp } from "@/lib/db";
import { listMedia } from "@/lib/hub";
import { MAX_UPLOAD, isAllowedMime, saveMedia } from "@/lib/media";
import type { Upload } from "@/lib/schemas";

// Libreria media (protetta dalla password): tutto quello che hanno mandato i bot + i tuoi upload.
export async function GET() {
  await connection();
  return Response.json({ items: await listMedia() }, { headers: { "Cache-Control": "no-store" } });
}

/** Carichi tu una foto o un video (multipart, campo "file", anche più di uno). */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const files = (form?.getAll("file") ?? []).filter((f): f is File => typeof f !== "string");
  if (!files.length) return Response.json({ error: "Nessun file" }, { status: 400 });

  const items: Upload[] = [];
  for (const f of files.slice(0, 10)) {
    const mime = f.type.toLowerCase();
    if (!isAllowedMime(mime)) return Response.json({ error: `Formato non supportato: ${f.name}` }, { status: 400 });
    if (f.size > MAX_UPLOAD) return Response.json({ error: `File troppo grande: ${f.name}` }, { status: 400 });
    const media = await saveMedia(await f.arrayBuffer(), mime);
    items.push(await put<Upload>("uploads", stamp({ url: media.url, type: media.type, name: f.name })));
  }
  return Response.json({ items });
}
