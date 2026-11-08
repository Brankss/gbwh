import type { NextRequest } from "next/server";
import { agentAuthError } from "@/lib/agent-auth";
import { summarize } from "@/lib/ugc";
import { agentBody } from "@/lib/ugc-agent";
import { noStore, reply } from "@/lib/ugc-http";
import { addResult, getConceptFull, resultInput } from "@/lib/ugc-store";

/** Numeri di un video per piattaforma e giorno (stesso video + piattaforma + giorno = aggiorna). */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/agent/ugc/videos/[id]/results">) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const b = await agentBody(request, resultInput);
  if ("error" in b) return b.error;
  const r = await addResult((await ctx.params).id, b.data, b.agent);
  if (!r.ok) return reply(r);
  const full = await getConceptFull(r.value.conceptId);
  const videoResults = full?.results.filter((x) => x.videoId === r.value.videoId) ?? [];
  return Response.json(
    {
      ok: true,
      result: r.value,
      aggiornato: r.value.createdAt !== r.value.updatedAt,
      totale_video: summarize(videoResults),
      totale_concept: summarize(full?.results ?? []),
      fase_concept: full?.concept.stage,
      playbook:
        "Se i numeri dicono qualcosa (in meglio o in peggio), scrivilo: POST /api/agent/ugc/learnings {agent, kind, text, strength, evidence:'numeri', conceptId, videoId}. " +
        "Se confermano un'ipotesi già nel Playbook, aggiornala a 'provato' (PATCH /api/agent/ugc/learnings/<id>).",
    },
    { headers: noStore },
  );
}
