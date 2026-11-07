import type { NextRequest } from "next/server";
import { reply } from "@/lib/ugc-http";
import { deleteResearch } from "@/lib/ugc-store";

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/ugc/research/[id]">) {
  return reply(await deleteResearch((await ctx.params).id), () => ({ ok: true }));
}
