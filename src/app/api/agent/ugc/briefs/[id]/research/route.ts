import type { NextRequest } from "next/server";
import { agentAuthError } from "@/lib/agent-auth";
import { agentBody } from "@/lib/ugc-agent";
import { reply } from "@/lib/ugc-http";
import { addResearch, researchInput } from "@/lib/ugc-store";

// Una voce di ricerca per il brief: ad competitor, voce cliente, insight, trend.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/agent/ugc/briefs/[id]/research">) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const b = await agentBody(request, researchInput);
  if ("error" in b) return b.error;
  return reply(await addResearch((await ctx.params).id, b.data, b.agent), (research) => ({ ok: true, research }));
}
