import type { NextRequest } from "next/server";
import { z } from "zod";
import { agentAuthError, zodMessage } from "@/lib/agent-auth";
import { agentFrom, needAgent, viewRequest } from "@/lib/calendar-agent";
import { decideRequest, getSettings } from "@/lib/calendar-store";

// Il gestore decide una richiesta.
const decision = z.object({
  agent: z.string().optional(),
  status: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(1000).optional(),
  apply: z.boolean().optional(),
  result: z.string().trim().max(80).optional(),
});

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/agent/calendar/requests/[id]">) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  const raw = await request.json().catch(() => null);
  const agent = agentFrom(request, raw);
  if (!agent) return needAgent();
  const settings = await getSettings();
  if (settings.manager && settings.manager !== agent) {
    return Response.json({ error: `Solo il gestore del calendario ('${settings.manager}') decide le richieste.` }, { status: 403 });
  }
  const parsed = decision.safeParse(raw);
  if (!parsed.success) return Response.json({ error: zodMessage(parsed.error) }, { status: 400 });
  const r = await decideRequest(id, parsed.data, agent);
  return r.ok ? Response.json({ ok: true, request: viewRequest(r.value) }) : Response.json({ error: r.error }, { status: r.status ?? 400 });
}
