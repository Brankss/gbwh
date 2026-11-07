import type { NextRequest } from "next/server";
import { MAX_UPLOAD, isAllowedMime, saveMedia } from "@/lib/media";
import { body, reply } from "@/lib/ugc-http";
import { addVideo, videoInput } from "@/lib/ugc-store";

/**
 * Carichi tu una versione del video: multipart (campo "file", più eventuali "notes", "hookId")
 * oppure JSON { media: { url, type }, … }.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/ugc/concepts/[id]/videos">) {
  const { id } = await ctx.params;
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || typeof file === "string") return Response.json({ error: "Nessun file" }, { status: 400 });
    const mime = file.type.toLowerCase();
    if (!isAllowedMime(mime)) return Response.json({ error: `Formato non supportato: ${file.name}` }, { status: 400 });
    if (file.size > MAX_UPLOAD) return Response.json({ error: "File troppo grande" }, { status: 400 });
    const media = await saveMedia(await file.arrayBuffer(), mime);
    const notes = form?.get("notes");
    const hookId = form?.get("hookId");
    return reply(
      await addVideo(id, { media: { url: media.url, type: media.type }, notes: typeof notes === "string" && notes ? notes : undefined, hookId: typeof hookId === "string" && hookId ? hookId : undefined }, "tu"),
    );
  }
  const b = await body(request, videoInput);
  if ("error" in b) return b.error;
  return reply(await addVideo(id, b.data, "tu"));
}
