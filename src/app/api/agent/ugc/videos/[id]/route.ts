import type { NextRequest } from "next/server";
import { agentAuthError } from "@/lib/agent-auth";
import { agentBody } from "@/lib/ugc-agent";
import { reply } from "@/lib/ugc-http";
import { updateVideo, videoPatch } from "@/lib/ugc-store";

// Modifica un video (agent): hookId, durationSec, status, qa, notes, adId. Il file non si cambia: carica una nuova versione.
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/agent/ugc/videos/[id]">) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const b = await agentBody(request, videoPatch);
  if ("error" in b) return b.error;
  return reply(await updateVideo((await ctx.params).id, b.data, b.agent), (video) => ({ ok: true, video }));
}
