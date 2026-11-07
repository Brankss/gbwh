import type { NextRequest } from "next/server";
import { body, reply } from "@/lib/ugc-http";
import { deleteVideo, updateVideo, videoPatch } from "@/lib/ugc-store";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/ugc/videos/[id]">) {
  const b = await body(request, videoPatch);
  if ("error" in b) return b.error;
  return reply(await updateVideo((await ctx.params).id, b.data, "tu"), (video) => ({ video }));
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/ugc/videos/[id]">) {
  return reply(await deleteVideo((await ctx.params).id, "tu"), () => ({ ok: true }));
}
