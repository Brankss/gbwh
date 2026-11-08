import type { NextRequest } from "next/server";
import { agentAuthError } from "@/lib/agent-auth";
import { agentBody } from "@/lib/ugc-agent";
import { reply } from "@/lib/ugc-http";
import { learningPatch, updateLearning } from "@/lib/ugc-store";

// Aggiorna una voce del Playbook (es. da "ipotesi" a "provato" con evidence).
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/agent/ugc/learnings/[id]">) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const b = await agentBody(request, learningPatch);
  if ("error" in b) return b.error;
  return reply(await updateLearning((await ctx.params).id, b.data, b.agent), (learning) => ({ ok: true, learning }));
}
