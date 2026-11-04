import type { NextRequest } from "next/server";
import { getInbox, getRev } from "@/lib/store";

// Polling leggero: se il client ha già l'ultima revisione, rispondiamo con un solo comando Redis.
export async function GET(request: NextRequest) {
  const known = Number(request.nextUrl.searchParams.get("rev") ?? -1);
  const rev = await getRev();

  if (rev === known) return Response.json({ rev }, { headers: { "Cache-Control": "no-store" } });

  const inbox = await getInbox();
  return Response.json({ rev, inbox }, { headers: { "Cache-Control": "no-store" } });
}
