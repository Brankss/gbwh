import type { NextRequest } from "next/server";
import { z } from "zod";
import { zodMessage } from "@/lib/agent-auth";
import { diffDays, isDay } from "@/lib/calendar";
import { copyWeek, createEvent, eventInput, eventsBetween, now, restoreEvent } from "@/lib/calendar-store";

// Calendario per te (pagina): eventi di una finestra di giorni + cose da pianificare.

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  if (!isDay(from) || !isDay(to) || to < from || diffDays(from, to) > 200) return Response.json({ error: "from/to non validi" }, { status: 400 });
  const data = await eventsBetween(from, to);
  return Response.json({ ...data, now: now() }, { headers: { "Cache-Control": "no-store" } });
}

const restoreInput = z.object({ id: z.string().min(1), title: z.string().min(1), by: z.string().min(1), createdAt: z.number(), updatedAt: z.number() }).passthrough();
const body = z.union([
  z.object({ restore: restoreInput }),
  z.object({ copyWeek: z.object({ from: z.string(), to: z.string() }) }),
  z.object({ events: z.array(eventInput).min(1).max(100) }),
  eventInput,
]);

export async function POST(request: NextRequest) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: zodMessage(parsed.error) }, { status: 400 });
  const data = parsed.data;

  if ("restore" in data) {
    // Annulla: rimette l'evento com'era prima (stesso id).
    return Response.json({ event: await restoreEvent(data.restore as never, "tu") });
  }
  if ("copyWeek" in data) {
    const { from, to } = data.copyWeek;
    if (!isDay(from) || !isDay(to)) return Response.json({ error: "Settimane non valide" }, { status: 400 });
    const events = await copyWeek(from, to, "tu");
    return Response.json({ events });
  }
  if ("events" in data) {
    const created = [];
    for (const e of data.events) {
      const r = await createEvent(e, "tu");
      if (r.ok) created.push(r.value.event);
    }
    return Response.json({ events: created });
  }
  const r = await createEvent(data, "tu");
  return r.ok ? Response.json(r.value) : Response.json({ error: r.error }, { status: r.status ?? 400 });
}
