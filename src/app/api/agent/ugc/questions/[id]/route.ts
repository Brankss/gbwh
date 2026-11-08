import type { NextRequest } from "next/server";
import { z } from "zod";
import { agentAuthError } from "@/lib/agent-auth";
import { agentBody } from "@/lib/ugc-agent";
import { reply } from "@/lib/ugc-http";
import { closeQuestion } from "@/lib/ugc-store";

/** Hai letto e applicato la risposta di Branko: chiudi la domanda ({agent, chiudi: true}). */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/agent/ugc/questions/[id]">) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const b = await agentBody(request, z.object({ chiudi: z.literal(true) }));
  if ("error" in b) return b.error;
  return reply(await closeQuestion((await ctx.params).id, b.agent), (question) => ({ ok: true, question }));
}
