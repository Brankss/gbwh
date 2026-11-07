import type { NextRequest } from "next/server";
import { connection } from "next/server";
import { zodMessage } from "@/lib/agent-auth";
import { getLog, getSettings, listRequests, logChange, saveSettings, settingsInput } from "@/lib/calendar-store";
import { getBots } from "@/lib/store";

// Impostazioni del calendario, richieste per il gestore e registro delle modifiche.

export async function GET() {
  await connection();
  const [settings, requests, log, bots] = await Promise.all([getSettings(), listRequests(), getLog({ limit: 60 }), getBots()]);
  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending").slice(0, 20);
  return Response.json({ settings, requests: [...pending, ...decided], log, bots }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  const parsed = settingsInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: zodMessage(parsed.error) }, { status: 400 });
  const settings = await saveSettings(parsed.data);
  if (parsed.data.manager !== undefined) {
    await logChange({ by: "tu", action: "gestore", title: parsed.data.manager ?? "nessuno" });
  }
  return Response.json({ settings });
}
