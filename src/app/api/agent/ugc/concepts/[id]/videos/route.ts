import type { NextRequest } from "next/server";
import { agentAuthError, zodMessage } from "@/lib/agent-auth";
import { toBotId, type Media } from "@/lib/bots";
import { MediaInputError, storeFile, toMedia } from "@/lib/media";
import { stageOf } from "@/lib/ugc";
import { nextStep, refuse, releaseOwner } from "@/lib/ugc-agent";
import { noStore, notFound, reply } from "@/lib/ugc-http";
import { addVideo, getConceptFull, videoInput } from "@/lib/ugc-store";

/**
 * Carica una versione del video finito (generato e montato FUORI dall'hub).
 * Il media come in bacheca: link, {url, type}, {data: base64, mime}, "data:…;base64,…",
 * oppure multipart/form-data con il file in "file" (+ agent, hookId, notes, status, durationSec, qa JSON).
 * Con status "in revisione" (default) il concept passa dal critico.
 */

const fields = videoInput.omit({ media: true });
const MEDIA_KEYS = ["media", "video", "file", "image"] as const;
const one = (v: unknown) => {
  if (!Array.isArray(v)) return v;
  if (v.length > 1) throw new MediaInputError("Un video per volta: ogni caricamento è una versione (v1, v2…).");
  return v[0];
};

type Parsed = { agent: string | null; media: () => Promise<Media>; rest: Record<string, unknown> };

async function parse(request: NextRequest): Promise<Parsed> {
  const qsAgent = request.nextUrl.searchParams.get("agent");
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    if (!form) throw new MediaInputError("multipart/form-data non leggibile.");
    const str = (k: string) => {
      const v = form.get(k);
      return typeof v === "string" && v.trim() ? v.trim() : undefined;
    };
    const files = MEDIA_KEYS.flatMap((k) => form.getAll(k));
    if (!files.length) throw new MediaInputError("Nessun file: mettilo nel campo 'file' (oppure manda un link in 'media').");
    const f = one(files) as FormDataEntryValue;
    const rest: Record<string, unknown> = { hookId: str("hookId"), notes: str("notes"), status: str("status"), adId: str("adId") };
    const dur = str("durationSec");
    if (dur) rest.durationSec = Number(dur);
    const qa = str("qa");
    if (qa) {
      try {
        rest.qa = JSON.parse(qa);
      } catch {
        throw new MediaInputError('qa: manda un JSON, es. {"mani":true,"labiale":false}.');
      }
    }
    return {
      agent: toBotId(str("agent") ?? qsAgent),
      media: async () => (typeof f === "string" ? toMedia(f) : storeFile(await f.arrayBuffer(), f.type.toLowerCase())),
      rest,
    };
  }

  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new MediaInputError("Body: serve un oggetto JSON {agent, media, …} oppure multipart/form-data con 'file'.");
  }
  const o = { ...(raw as Record<string, unknown>) };
  const agent = toBotId(o.agent ?? qsAgent);
  let item: unknown = MEDIA_KEYS.map((k) => o[k]).find((v) => v != null);
  if (item == null && typeof o.url === "string") item = { url: o.url, type: o.type };
  if (item == null && typeof o.data === "string") item = { data: o.data, mime: o.mime };
  for (const k of ["agent", ...MEDIA_KEYS, "url", "type", "data", "mime"]) delete o[k];
  if (item == null) throw new MediaInputError("Manca il video: 'media' con un link, {url, type}, {data: base64, mime} (o multipart con 'file').");
  const single = one(item);
  return { agent, media: () => toMedia(single), rest: o };
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/agent/ugc/concepts/[id]/videos">) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  try {
    const p = await parse(request);
    if (!p.agent) return refuse(400, "Manca 'agent': il tuo id (lo stesso della bacheca), nel body o come ?agent=.");
    const parsed = fields.safeParse(p.rest);
    if (!parsed.success) return refuse(400, zodMessage(parsed.error));
    const full = await getConceptFull(id);
    if (!full) return notFound("Concept");
    const media = await p.media(); // salvato solo dopo i controlli: niente file orfani
    const r = await addVideo(id, { ...parsed.data, media: { url: media.url, type: media.type } }, p.agent);
    if (!r.ok) return reply(r);
    const concept = await releaseOwner(full.concept, r.value.concept, p.agent);
    const moved = concept.stage !== full.concept.stage;
    return Response.json(
      {
        ok: true,
        video: r.value.video,
        concept,
        ...(moved && { passaggio: `${stageOf(full.concept.stage).label} → ${stageOf(concept.stage).label}` }),
        nota: moved
          ? "Il concept è passato in revisione: il critico viene avvisato da solo."
          : r.value.video.status === "in revisione"
            ? `Video caricato. Il concept è in "${stageOf(concept.stage).label}": passa in revisione da solo solo se era in script o produzione.`
            : `Video caricato come "${r.value.video.status}". Quando è pronto, caricane una versione con status "in revisione".`,
        prossimo_passo: nextStep(concept, r.value.video),
      },
      { headers: noStore },
    );
  } catch (err) {
    if (err instanceof MediaInputError) return refuse(400, err.message);
    throw err;
  }
}
