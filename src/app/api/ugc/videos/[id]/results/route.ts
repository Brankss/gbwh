import type { NextRequest } from "next/server";
import { body, reply } from "@/lib/ugc-http";
import { addResult, resultInput } from "@/lib/ugc-store";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/ugc/videos/[id]/results">) {
  const b = await body(request, resultInput);
  if ("error" in b) return b.error;
  return reply(await addResult((await ctx.params).id, b.data, "tu"), (result) => ({ result }));
}
