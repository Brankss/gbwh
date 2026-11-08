import type { NextRequest } from "next/server";
import { agentAuthError } from "@/lib/agent-auth";
import { noStore } from "@/lib/ugc-http";
import { getLog } from "@/lib/ugc-store";

// Registro della UGC Factory: GET /api/agent/ugc/changes?since=<ms>&conceptId=
export async function GET(request: NextRequest) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const sp = request.nextUrl.searchParams;
  const since = Number(sp.get("since") ?? 0) || 0;
  const changes = await getLog({ since, limit: 100, conceptId: sp.get("conceptId") || undefined });
  return Response.json(
    { cursor: changes[0]?.at ?? since, changes: changes.map((c) => ({ ...c, at: new Date(c.at).toISOString(), ms: c.at })) },
    { headers: noStore },
  );
}
