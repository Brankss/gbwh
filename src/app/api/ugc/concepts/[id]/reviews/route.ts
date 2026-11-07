import type { NextRequest } from "next/server";
import { body, reply } from "@/lib/ugc-http";
import { addReview, reviewInput } from "@/lib/ugc-store";

/** Anche tu puoi fare da critico (gate o revisione video). */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/ugc/concepts/[id]/reviews">) {
  const b = await body(request, reviewInput);
  if ("error" in b) return b.error;
  return reply(await addReview((await ctx.params).id, b.data, "tu"));
}
