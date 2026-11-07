import type { NextRequest } from "next/server";
import { z } from "zod";
import { agentAuthError, zodMessage } from "@/lib/agent-auth";
import { agentFrom, needAgent, routeToManager, viewBacklog } from "@/lib/calendar-agent";
import { deleteEvent, getEvent, getSettings, patchInput, updateEvent } from "@/lib/calendar-store";

// Modifica / elimina un evento (agent).

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/agent/calendar/[id]">) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  const raw = await request.json().catch(() => null);
  const agent = agentFrom(request, raw);
  if (!agent) return needAgent();
  const parsed = patchInput.extend({ agent: z.string().optional() }).safeParse(raw);
  if (!parsed.success) return Response.json({ error: zodMessage(parsed.error) }, { status: 400 });
  const { agent: _a, ...patch } = parsed.data;
  void _a;
  if (!(await getEvent(id))) return Response.json({ error: "Evento non trovato." }, { status: 404 });

  const settings = await getSettings();
  const { occurrence, ...payload } = patch;
  const routed = await routeToManager(agent, settings, { action: "update", target: id, occurrence, payload });
  if (routed) return routed;

  const r = await updateEvent(id, patch, agent);
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status ?? 400 });
  return Response.json({ ok: true, detached: r.value.detached, event: viewBacklog(r.value.event, settings), start: r.value.event.start, end: r.value.event.end, conflicts: r.value.conflicts.length ? r.value.conflicts : undefined });
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/agent/calendar/[id]">) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  const agent = agentFrom(request);
  if (!agent) return needAgent();
  const occurrence = request.nextUrl.searchParams.get("occurrence");
  if (!(await getEvent(id))) return Response.json({ error: "Evento non trovato." }, { status: 404 });

  const routed = await routeToManager(agent, await getSettings(), { action: "delete", target: id, occurrence: occurrence ?? undefined });
  if (routed) return routed;

  const r = await deleteEvent(id, agent, occurrence);
  return r.ok ? Response.json({ ok: true, ...r.value }) : Response.json({ error: r.error }, { status: r.status ?? 400 });
}
