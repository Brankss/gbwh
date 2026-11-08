import type { NextRequest } from "next/server";
import { agentAuthError } from "@/lib/agent-auth";
import { STAGE_IDS, type StageId } from "@/lib/ugc";
import { agentBody, checkConcept, nextStep, normalizeOwner, refuse, viewConceptShort } from "@/lib/ugc-agent";
import { noStore, reply } from "@/lib/ugc-http";
import { conceptInput, createConcept, listConcepts } from "@/lib/ugc-store";

// Concept della UGC Factory (agent). GET ?briefId=&stage=&full=1
export async function GET(request: NextRequest) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const sp = request.nextUrl.searchParams;
  const stage = sp.get("stage") || undefined;
  if (stage && !(STAGE_IDS as string[]).includes(stage)) return refuse(400, `stage: "${stage}" non esiste. Usa uno di: ${STAGE_IDS.join(", ")}.`);
  const concepts = (await listConcepts({ briefId: sp.get("briefId") || undefined, stage: stage as StageId | undefined })).sort((a, b) => b.updatedAt - a.updatedAt);
  return Response.json({ concepts: sp.get("full") === "1" ? concepts : concepts.map(viewConceptShort) }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const b = await agentBody(request, conceptInput, normalizeOwner);
  if ("error" in b) return b.error;
  if (b.data.stage && b.data.stage !== "idea" && b.data.stage !== "gate") {
    return refuse(400, `stage: un concept nuovo parte da "idea" (o va dritto al "gate" se è già completo). Le fasi dopo si raggiungono passando dal critico.`);
  }
  return reply(await createConcept(b.data, b.agent), (concept) => ({
    ok: true,
    concept,
    avvisi: checkConcept(concept),
    prossimo_passo: nextStep(concept),
  }));
}
