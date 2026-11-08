import type { NextRequest } from "next/server";
import { agentAuthError } from "@/lib/agent-auth";
import { stageOf } from "@/lib/ugc";
import { agentBody, nextStep, refuse, releaseOwner, reviewGuard } from "@/lib/ugc-agent";
import { noStore, notFound, reply } from "@/lib/ugc-http";
import { addReview, getConceptFull, getSettings, reviewInput } from "@/lib/ugc-store";

/**
 * Revisione del critico (gate o revisione video). Sposta la fase da sola:
 * gate → script / idea / scartato; revisione → pronto / produzione / scartato.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/agent/ugc/concepts/[id]/reviews">) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  const b = await agentBody(request, reviewInput);
  if ("error" in b) return b.error;
  const full = await getConceptFull(id);
  if (!full) return notFound("Concept");
  const before = full.concept;

  const blocked = await reviewGuard(b.agent, before, await getSettings());
  if (blocked) return blocked;
  if (b.data.verdict === "da rifare" && !b.data.fix?.length) {
    return refuse(400, "fix: con 'da rifare' scrivi cosa correggere, una correzione concreta per voce (es. \"apri sul problema, il prodotto arriva dopo il secondo 3\").");
  }

  const r = await addReview(id, b.data, b.agent);
  if (!r.ok) return reply(r);
  const concept = await releaseOwner(before, r.value.concept, b.agent);
  return Response.json(
    {
      ok: true,
      review: r.value.review,
      concept,
      passaggio: `${stageOf(before.stage).label} → ${stageOf(concept.stage).label}`,
      prossimo_passo: nextStep(concept),
      playbook: "Se da questa revisione esce una lezione riutilizzabile, scrivila: POST /api/agent/ugc/learnings {agent, kind, text, strength:'ipotesi', conceptId}.",
    },
    { headers: noStore },
  );
}
