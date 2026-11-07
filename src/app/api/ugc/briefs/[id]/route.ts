import type { NextRequest } from "next/server";
import { body, noStore, notFound, reply } from "@/lib/ugc-http";
import { briefPatch, deleteBrief, getBriefFull, updateBrief } from "@/lib/ugc-store";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/ugc/briefs/[id]">) {
  const full = await getBriefFull((await ctx.params).id);
  return full ? Response.json(full, { headers: noStore }) : notFound("Brief");
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/ugc/briefs/[id]">) {
  const b = await body(request, briefPatch);
  if ("error" in b) return b.error;
  return reply(await updateBrief((await ctx.params).id, b.data, "tu"), (brief) => ({ brief }));
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/ugc/briefs/[id]">) {
  return reply(await deleteBrief((await ctx.params).id, "tu"), () => ({ ok: true }));
}
