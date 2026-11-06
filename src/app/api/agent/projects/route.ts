import type { NextRequest } from "next/server";
import { agentAuthError } from "@/lib/agent-auth";
import { listProjects } from "@/lib/hub";

export async function GET(request: NextRequest) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const projects = (await listProjects()).map(({ latest, ...p }) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    area: p.area,
    description: p.description,
    checkpoints: p.checkpoints,
    latest: latest && { summary: latest.summary, progress: latest.progress, next: latest.next, author: latest.author, at: new Date(latest.createdAt).toISOString() },
  }));
  return Response.json({ projects }, { headers: { "Cache-Control": "no-store" } });
}
