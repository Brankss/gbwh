import type { NextRequest } from "next/server";
import { agentAuthError } from "@/lib/agent-auth";
import { createAlert } from "@/lib/hub";

// Annunci importanti dagli agent. Le regole anti-rumore stanno in createAlert (dedupe + limite giornaliero).
export async function POST(request: NextRequest) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const res = await createAlert(await request.json().catch(() => null));
  if (!res.ok) return Response.json({ error: res.error }, { status: res.status });
  return Response.json({ ok: true, id: res.alert.id, deduped: res.deduped });
}
