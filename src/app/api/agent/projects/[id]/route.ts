import type { NextRequest } from "next/server";
import { agentAuthError } from "@/lib/agent-auth";
import { getProjectFull } from "@/lib/hub";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/agent/projects/[id]">) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const full = await getProjectFull((await ctx.params).id);
  if (!full) return Response.json({ error: "Progetto inesistente" }, { status: 404 });
  const iso = (t: number) => new Date(t).toISOString();
  return Response.json(
    {
      project: full.project,
      checkpoints: full.checkpoints.slice(0, 50).map((c) => ({ ...c, at: iso(c.createdAt) })),
      knowledge: full.knowledge.map((k) => ({ kind: k.kind, text: k.text, author: k.author, at: iso(k.at) })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
