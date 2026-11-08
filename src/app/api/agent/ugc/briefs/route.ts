import type { NextRequest } from "next/server";
import { agentAuthError } from "@/lib/agent-auth";
import { agentBody } from "@/lib/ugc-agent";
import { noStore, reply } from "@/lib/ugc-http";
import { briefInput, createBrief, listBriefs } from "@/lib/ugc-store";

// Brief della UGC Factory (agent). GET ?status=attivo|in pausa|chiuso
export async function GET(request: NextRequest) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const status = request.nextUrl.searchParams.get("status");
  const briefs = (await listBriefs()).filter((b) => !status || b.status === status).sort((a, b) => b.updatedAt - a.updatedAt);
  return Response.json({ briefs }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const b = await agentBody(request, briefInput);
  if ("error" in b) return b.error;
  return reply(await createBrief(b.data, b.agent), (brief) => ({
    ok: true,
    brief,
    prossimo_passo: `Ricerca: POST /api/agent/ugc/briefs/${brief.id}/research {agent, kind, text, url?, source?, why?}; poi 3–5 angoli con PATCH /api/agent/ugc/briefs/${brief.id} {agent, angles:[…]}.`,
  }));
}
