import type { NextRequest } from "next/server";
import { agentAuthError } from "@/lib/agent-auth";
import { getLog } from "@/lib/calendar-store";

// Registro delle modifiche al calendario: GET /api/agent/calendar/changes?since=<ms>
export async function GET(request: NextRequest) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const since = Number(request.nextUrl.searchParams.get("since") ?? 0) || 0;
  const changes = await getLog({ since, limit: 100 });
  return Response.json({ cursor: changes[0]?.at ?? since, changes: changes.map((c) => ({ ...c, at: new Date(c.at).toISOString(), ms: c.at })) });
}
