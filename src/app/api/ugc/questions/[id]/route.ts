import type { NextRequest } from "next/server";
import { body, reply } from "@/lib/ugc-http";
import { answerInput, answerQuestion, deleteQuestion } from "@/lib/ugc-store";

/** Rispondi a una domanda di un bot: lui viene svegliato con la risposta. */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/ugc/questions/[id]">) {
  const b = await body(request, answerInput);
  if ("error" in b) return b.error;
  return reply(await answerQuestion((await ctx.params).id, b.data.answer, "tu"), (question) => ({ question }));
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/ugc/questions/[id]">) {
  return reply(await deleteQuestion((await ctx.params).id), () => ({ ok: true }));
}
