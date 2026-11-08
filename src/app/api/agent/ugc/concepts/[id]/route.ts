import type { NextRequest } from "next/server";
import { agentAuthError } from "@/lib/agent-auth";
import { agentBody, checkConcept, nextStep, normalizeOwner, refuse, releaseOwner, stageJumpError, viewLearning } from "@/lib/ugc-agent";
import { formatOf } from "@/lib/ugc-library";
import { noStore, notFound, reply } from "@/lib/ugc-http";
import { conceptPatch, getConceptFull, getLog, listLearnings, updateConcept } from "@/lib/ugc-store";

// Un concept completo (agent): tutto quello che serve per lavorarci senza altre richieste.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/agent/ugc/concepts/[id]">) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  const full = await getConceptFull(id);
  if (!full) return notFound("Concept");
  const [log, playbook] = await Promise.all([getLog({ conceptId: id, limit: 50 }), listLearnings()]);
  return Response.json(
    {
      ...full,
      log: log.map((e) => ({ ...e, quando: new Date(e.at).toISOString() })),
      formato: formatOf(full.concept.format) ?? null,
      prossimo_passo: nextStep(full.concept, full.videos[0]),
      avvisi: checkConcept(full.concept),
      playbook: playbook.filter((l) => l.pinned || l.strength === "provato").slice(0, 15).map(viewLearning),
    },
    { headers: noStore },
  );
}

/**
 * Modifica i campi e/o la fase: {agent, …campi} oppure {agent, stage, note?}.
 * {agent, owner:"<id>"} = prendi il lavoro; owner:null = lo liberi.
 */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/agent/ugc/concepts/[id]">) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  const b = await agentBody(request, conceptPatch, normalizeOwner);
  if ("error" in b) return b.error;
  const full = await getConceptFull(id);
  if (!full) return notFound("Concept");
  const before = full.concept;

  if (b.data.stage && b.data.stage !== before.stage) {
    const jump = stageJumpError(before.stage, b.data.stage);
    if (jump) return refuse(409, jump);
    if (b.data.stage === "revisione" && !full.videos.length) {
      return refuse(409, `Non c'è nessun video da revisionare: caricalo con POST /api/agent/ugc/concepts/${id}/videos (status "in revisione" lo manda in revisione da solo).`);
    }
  }
  const r = await updateConcept(id, b.data, b.agent);
  if (!r.ok) return reply(r);
  const concept = await releaseOwner(before, r.value, b.agent, "owner" in b.data);
  return Response.json(
    { ok: true, concept, avvisi: checkConcept(concept), prossimo_passo: nextStep(concept, full.videos[0]) },
    { headers: noStore },
  );
}
