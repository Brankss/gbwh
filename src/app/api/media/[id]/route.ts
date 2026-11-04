import type { NextRequest } from "next/server";
import { readMedia } from "@/lib/media";

const ID = /^[0-9a-f-]{36}$/i;

// Serve i file caricati dall'agent. Protetto dalla stessa password del sito (proxy.ts).
// Supporta le richieste Range: Safari su iPhone non riproduce i video senza.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/media/[id]">) {
  const { id } = await ctx.params;
  if (!ID.test(id)) return new Response("Not found", { status: 404 });

  const file = await readMedia(id);
  if (!file) return new Response("Not found", { status: 404 });

  const size = file.data.byteLength;
  const headers: Record<string, string> = {
    "Content-Type": file.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) {
      return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    }
    return new Response(file.data.slice(start, end + 1), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }

  return new Response(file.data, { headers: { ...headers, "Content-Length": String(size) } });
}
