import type { NextRequest } from "next/server";
import { z } from "zod";
import { agentAuthError, zodMessage } from "@/lib/agent-auth";
import { addDays, dayOf, diffDays, isDay, wallNow } from "@/lib/calendar";
import { agentFrom, botName, needAgent, protocol, routeToManager, viewBacklog, viewOccurrence } from "@/lib/calendar-agent";
import { createEvent, eventInput, eventsBetween, getSettings, listRequests, now, occurrencesBetween, tz } from "@/lib/calendar-store";

// Calendario per gli agent. GET senza parametri = istruzioni + situazione; con from/to = eventi.

export async function GET(request: NextRequest) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const settings = await getSettings();
  const sp = request.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to") ?? from;

  if (from) {
    if (!isDay(from) || !isDay(to) || to! < from) return Response.json({ error: "from/to: giorni 'AAAA-MM-GG', to non prima di from." }, { status: 400 });
    if (diffDays(from, to!) > 92) return Response.json({ error: "Massimo 92 giorni per richiesta." }, { status: 400 });
    const occs = await occurrencesBetween(from, to!);
    return Response.json({ from, to, adesso: now(), events: occs.map((o) => viewOccurrence(o, settings)) });
  }

  const today = dayOf(now());
  const [occs, { backlog }, pending] = await Promise.all([occurrencesBetween(today, addDays(today, 7)), eventsBetween(today, today), listRequests("pending")]);
  const manager = settings.manager ? await botName(settings.manager) : null;
  const longNow = new Intl.DateTimeFormat("it-IT", { timeZone: tz(), dateStyle: "full", timeStyle: "short" }).format(new Date());
  return Response.json({
    adesso: { quando: wallNow(tz()), in_parole: `${longNow} (${tz()})` },
    oggi: occs.filter((o) => dayOf(o.start) <= today && dayOf(o.end) >= today).map((o) => viewOccurrence(o, settings)),
    prossimi_7_giorni: occs.filter((o) => dayOf(o.start) > today).map((o) => viewOccurrence(o, settings)),
    da_pianificare: backlog.map((e) => viewBacklog(e, settings)),
    preferenze_di_branko: settings.prefs || "(nessuna ancora: il gestore può scriverle con PATCH /api/agent/calendar/settings)",
    categorie: settings.categories.map((c) => c.name),
    gestore: settings.manager ? { id: settings.manager, name: manager } : null,
    richieste_in_attesa: pending.length,
    protocollo: protocol(settings, manager),
  });
}

const body = eventInput.extend({ agent: z.string().optional(), events: z.array(eventInput).min(1).max(50).optional() });

export async function POST(request: NextRequest) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const raw = await request.json().catch(() => null);
  const agent = agentFrom(request, raw);
  if (!agent) return needAgent();
  const parsed = body.safeParse(raw);
  if (!parsed.success) return Response.json({ error: zodMessage(parsed.error) }, { status: 400 });
  const { agent: _a, events, ...single } = parsed.data;
  void _a;
  const items = events ?? [single];

  const settings = await getSettings();
  const routed = await routeToManager(agent, settings, {
    action: "create",
    text: items.length === 1 && items[0].text && !items[0].title ? items[0].text : undefined,
    payload: items.length === 1 ? (items[0].text && !items[0].title ? undefined : items[0]) : { events: items },
  });
  if (routed) return routed;

  const results = [];
  for (const item of items) {
    const r = await createEvent(item, agent);
    if (!r.ok) {
      results.push({ ok: false, error: r.error, input: item.title ?? item.text });
      continue;
    }
    const occ = (await occurrencesBetween(dayOf(r.value.event.start ?? now()), dayOf(r.value.event.start ?? now()))).find((o) => o.id === r.value.event.id);
    results.push({
      ok: true,
      updated: r.value.updated || undefined,
      event: occ ? viewOccurrence(occ, await getSettings()) : viewBacklog(r.value.event, await getSettings()),
      understood: r.value.understood,
      conflicts: r.value.conflicts.length ? r.value.conflicts : undefined,
    });
  }
  if (!events) {
    const [r] = results;
    return r.ok ? Response.json(r) : Response.json({ error: r.error }, { status: 400 });
  }
  return Response.json({ ok: results.every((r) => r.ok), results });
}
