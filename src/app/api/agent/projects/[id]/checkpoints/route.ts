import type { NextRequest } from "next/server";
import { agentAuthError, zodMessage } from "@/lib/agent-auth";
import { get, put, stamp } from "@/lib/db";
import { checkpointInput, type Checkpoint } from "@/lib/schemas";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/agent/projects/[id]/checkpoints">) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const projectId = (await ctx.params).id;
  if (!(await get("projects", projectId))) return Response.json({ error: "Progetto inesistente" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.author !== "string" || !body.author.trim()) {
    return Response.json({ error: "author: obbligatorio (chi sei: es. 'syrup' o 'hermes')" }, { status: 400 });
  }
  const parsed = checkpointInput.safeParse({ ...body, projectId });
  if (!parsed.success) return Response.json({ error: zodMessage(parsed.error) }, { status: 400 });
  const checkpoint = await put<Checkpoint>("checkpoints", stamp(parsed.data));
  return Response.json({ ok: true, checkpoint });
}
