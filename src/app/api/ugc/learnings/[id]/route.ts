import type { NextRequest } from "next/server";
import { body, reply } from "@/lib/ugc-http";
import { deleteLearning, learningPatch, updateLearning } from "@/lib/ugc-store";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/ugc/learnings/[id]">) {
  const b = await body(request, learningPatch);
  if ("error" in b) return b.error;
  return reply(await updateLearning((await ctx.params).id, b.data, "tu"), (learning) => ({ learning }));
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/ugc/learnings/[id]">) {
  return reply(await deleteLearning((await ctx.params).id), () => ({ ok: true }));
}
