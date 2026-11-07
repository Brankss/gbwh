import type { NextRequest } from "next/server";
import { agentAuthError } from "@/lib/agent-auth";
import { addDays, dayLabel, dayOf, isDay } from "@/lib/calendar";
import { freeSlotsFor, getSettings, now, occurrencesBetween } from "@/lib/calendar-store";

// Spazi liberi: GET /api/agent/calendar/free?date=2026-11-09&minutes=60&from=09:00&to=13:00&days=3
const toMin = (v: string | null) => {
  const m = v ? /^(\d{1,2})(?:[:.](\d{2}))?$/.exec(v) : null;
  return m ? Math.min(1440, +m[1] * 60 + (m[2] ? +m[2] : 0)) : undefined;
};

export async function GET(request: NextRequest) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const sp = request.nextUrl.searchParams;
  const date = sp.get("date") ?? dayOf(now());
  if (!isDay(date)) return Response.json({ error: "date: 'AAAA-MM-GG'." }, { status: 400 });
  const minutes = Math.max(5, Math.min(1440, Number(sp.get("minutes") ?? 60) || 60));
  const days = Math.max(1, Math.min(14, Number(sp.get("days") ?? 1) || 1));
  const settings = await getSettings();
  const occs = await occurrencesBetween(date, addDays(date, days - 1));
  const result = Array.from({ length: days }, (_, i) => addDays(date, i))
    .filter((d) => d >= dayOf(now()))
    .map((d) => ({ date: d, giorno: dayLabel(d, true), slots: freeSlotsFor(occs, d, settings, minutes, toMin(sp.get("from")), toMin(sp.get("to"))) }));
  return Response.json({ minutes, fascia_utile: `${settings.dayStart}:00–${settings.dayEnd}:00`, days: result });
}
