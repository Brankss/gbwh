import type { NextRequest } from "next/server";
import { body, noStore, notFound, reply } from "@/lib/ugc-http";
import { conceptPatch, deleteConcept, getConceptFull, getLog, updateConcept } from "@/lib/ugc-store";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/ugc/concepts/[id]">) {
  const { id } = await ctx.params;
  const full = await getConceptFull(id);
  if (!full) return notFound("Concept");
  return Response.json({ ...full, log: await getLog({ conceptId: id, limit: 50 }) }, { headers: noStore });
}

/** Modifica i campi o la fase (stage) del concept. */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/ugc/concepts/[id]">) {
  const b = await body(request, conceptPatch);
  if ("error" in b) return b.error;
  return reply(await updateConcept((await ctx.params).id, b.data, "tu"), (concept) => ({ concept }));
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/ugc/concepts/[id]">) {
  return reply(await deleteConcept((await ctx.params).id, "tu"), () => ({ ok: true }));
}
