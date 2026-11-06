import type { NextRequest } from "next/server";
import { agentAuthError, zodMessage } from "@/lib/agent-auth";
import { beat, heartbeatInput, ONLINE_WINDOW } from "@/lib/presence";

// Segnale di vita di un agent: chi sei, come stai, cosa stai facendo.
export async function POST(request: NextRequest) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const parsed = heartbeatInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: zodMessage(parsed.error) }, { status: 400 });
  await beat(parsed.data);
  return Response.json({ ok: true, nextWithinMinutes: Math.floor(ONLINE_WINDOW / 60000) });
}
