import type { NextRequest } from "next/server";
import { z } from "zod";
import { zodMessage } from "@/lib/agent-auth";
import { decideRequest } from "@/lib/calendar-store";

// Approvi o rifiuti tu una richiesta (con "apply" la applico dal payload o dalla frase).
const decision = z.object({ status: z.enum(["approved", "rejected"]), note: z.string().trim().max(1000).optional(), apply: z.boolean().optional() });

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/calendar/requests/[id]">) {
  const { id } = await ctx.params;
  const parsed = decision.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: zodMessage(parsed.error) }, { status: 400 });
  const r = await decideRequest(id, parsed.data, "tu");
  return r.ok ? Response.json({ request: r.value }) : Response.json({ error: r.error }, { status: r.status ?? 400 });
}
