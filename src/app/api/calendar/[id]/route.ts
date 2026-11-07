import type { NextRequest } from "next/server";
import { zodMessage } from "@/lib/agent-auth";
import { deleteEvent, patchInput, updateEvent } from "@/lib/calendar-store";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/calendar/[id]">) {
  const { id } = await ctx.params;
  const parsed = patchInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: zodMessage(parsed.error) }, { status: 400 });
  const r = await updateEvent(id, parsed.data, "tu");
  return r.ok ? Response.json(r.value) : Response.json({ error: r.error }, { status: r.status ?? 400 });
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/calendar/[id]">) {
  const { id } = await ctx.params;
  const r = await deleteEvent(id, "tu", request.nextUrl.searchParams.get("occurrence"));
  return r.ok ? Response.json(r.value) : Response.json({ error: r.error }, { status: r.status ?? 400 });
}
