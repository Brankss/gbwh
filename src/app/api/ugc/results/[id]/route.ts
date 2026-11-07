import type { NextRequest } from "next/server";
import { reply } from "@/lib/ugc-http";
import { deleteResult } from "@/lib/ugc-store";

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/ugc/results/[id]">) {
  return reply(await deleteResult((await ctx.params).id), () => ({ ok: true }));
}
