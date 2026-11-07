import type { NextRequest } from "next/server";
import { body, reply } from "@/lib/ugc-http";
import { addResearch, researchInput } from "@/lib/ugc-store";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/ugc/briefs/[id]/research">) {
  const b = await body(request, researchInput);
  if ("error" in b) return b.error;
  return reply(await addResearch((await ctx.params).id, b.data, "tu"), (item) => ({ item }));
}
