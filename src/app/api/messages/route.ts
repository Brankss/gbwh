import type { NextRequest } from "next/server";
import { getRev, getSnapshot } from "@/lib/store";

// Polling leggero: se il client ha già l'ultima revisione, rispondiamo con un solo comando Redis.
export async function GET(request: NextRequest) {
  const known = Number(request.nextUrl.searchParams.get("rev") ?? -1);
  const rev = await getRev();
  const headers = { "Cache-Control": "no-store" };

  if (rev === known) return Response.json({ rev }, { headers });

  const snapshot = await getSnapshot();
  return Response.json({ rev, ...snapshot }, { headers });
}
