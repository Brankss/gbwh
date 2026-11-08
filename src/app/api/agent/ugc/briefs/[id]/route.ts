import type { NextRequest } from "next/server";
import { agentAuthError } from "@/lib/agent-auth";
import { agentBody, viewConceptShort } from "@/lib/ugc-agent";
import { noStore, notFound, reply } from "@/lib/ugc-http";
import { briefPatch, getBriefFull, updateBrief } from "@/lib/ugc-store";

// Un brief con la sua ricerca e i suoi concept (agent).
export async function GET(request: NextRequest, ctx: RouteContext<"/api/agent/ugc/briefs/[id]">) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const full = await getBriefFull((await ctx.params).id);
  if (!full) return notFound("Brief");
  const concepts = full.concepts.map((c) => ({ ...c, fase: viewConceptShort(c).fase }));
  return Response.json({ brief: full.brief, research: full.research, concepts }, { headers: noStore });
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/agent/ugc/briefs/[id]">) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const b = await agentBody(request, briefPatch);
  if ("error" in b) return b.error;
  return reply(await updateBrief((await ctx.params).id, b.data, b.agent), (brief) => ({ ok: true, brief }));
}
