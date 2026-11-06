import type { NextRequest } from "next/server";
import { agentAuthError } from "@/lib/agent-auth";
import { listCatalog } from "@/lib/hub";

// Prodotti e pubblicità, per sapere a cosa collegare un media ("product" / "ad" in POST /api/board).
export async function GET(request: NextRequest) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  return Response.json({ products: await listCatalog() }, { headers: { "Cache-Control": "no-store" } });
}
