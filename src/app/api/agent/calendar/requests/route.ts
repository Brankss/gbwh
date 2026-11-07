import type { NextRequest } from "next/server";
import { z } from "zod";
import { agentAuthError, zodMessage } from "@/lib/agent-auth";
import { agentFrom, botName, needAgent, viewRequest } from "@/lib/calendar-agent";
import { createRequest, getSettings, listRequests, requestInput } from "@/lib/calendar-store";
import { wakeWithin } from "@/lib/wake";

// Richieste per il gestore del calendario.

export async function GET(request: NextRequest) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const sp = request.nextUrl.searchParams;
  const status = sp.get("status");
  const by = sp.get("by");
  const all = await listRequests(status === "pending" || status === "approved" || status === "rejected" ? status : undefined);
  const items = all.filter((r) => !by || r.by === by).slice(0, 100);
  const settings = await getSettings();
  return Response.json({ gestore: settings.manager, requests: items.map(viewRequest) });
}

export async function POST(request: NextRequest) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const raw = await request.json().catch(() => null);
  const agent = agentFrom(request, raw);
  if (!agent) return needAgent();
  const parsed = requestInput.extend({ agent: z.string().optional() }).safeParse(raw);
  if (!parsed.success) return Response.json({ error: zodMessage(parsed.error) }, { status: 400 });
  const { agent: _a, ...input } = parsed.data;
  void _a;
  if (!input.text && !input.payload && !input.target) return Response.json({ error: "Scrivi cosa serve in 'text' (o manda action/target/payload)." }, { status: 400 });

  const settings = await getSettings();
  const req = await createRequest(input, agent);
  let wake: string | undefined;
  if (settings.manager && settings.manager !== agent) {
    wake = await wakeWithin(settings.manager, { kind: "calendario", text: `${await botName(agent)} (${agent}) chiede: ${input.text ?? JSON.stringify(input.payload ?? {})}` });
  }
  return Response.json({
    ok: true,
    request: viewRequest(req),
    wake,
    message: settings.manager ? `Richiesta per ${await botName(settings.manager)}.` : "Non c'è ancora un gestore: la richiesta la vede Branko nel calendario.",
  });
}
