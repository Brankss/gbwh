import type { NextRequest } from "next/server";
import { body, noStore } from "@/lib/ugc-http";
import { logChange, saveSettings, settingsInput } from "@/lib/ugc-store";

/** Chi fa quale ruolo nella squadra (e se svegliarlo da solo). */
export async function PATCH(request: NextRequest) {
  const b = await body(request, settingsInput);
  if ("error" in b) return b.error;
  const settings = await saveSettings(b.data);
  await logChange({ by: "tu", action: "squadra aggiornata", title: Object.entries(settings.roles).map(([r, bot]) => `${r}: ${bot ?? "—"}`).join(", ") });
  return Response.json({ settings }, { headers: noStore });
}
