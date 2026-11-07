import type { NextRequest } from "next/server";
import { z } from "zod";
import { agentAuthError, zodMessage } from "@/lib/agent-auth";
import { agentFrom, needAgent } from "@/lib/calendar-agent";
import { getSettings, logChange, saveSettings, settingsInput } from "@/lib/calendar-store";

// Preferenze, categorie e fascia utile: le cambia il gestore (o chiunque, finché un gestore non c'è).
// Il gestore stesso lo sceglie solo Branko dall'hub.
export async function PATCH(request: NextRequest) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const raw = await request.json().catch(() => null);
  const agent = agentFrom(request, raw);
  if (!agent) return needAgent();
  const current = await getSettings();
  if (current.manager && current.manager !== agent) {
    return Response.json({ error: `Le impostazioni le cambia il gestore ('${current.manager}'). Mandagli una richiesta: POST /api/agent/calendar/requests.` }, { status: 403 });
  }
  const parsed = settingsInput.omit({ manager: true }).extend({ agent: z.string().optional() }).safeParse(raw);
  if (!parsed.success) return Response.json({ error: zodMessage(parsed.error) }, { status: 400 });
  const { agent: _a, ...patch } = parsed.data;
  void _a;
  const settings = await saveSettings(patch);
  await logChange({ by: agent, action: "impostazioni", title: Object.keys(patch).join(", ") || "nessuna modifica" });
  return Response.json({ ok: true, settings });
}
