import type { NextRequest } from "next/server";
import { body, reply } from "@/lib/ugc-http";
import { conceptInput, createConcept } from "@/lib/ugc-store";

export async function POST(request: NextRequest) {
  const b = await body(request, conceptInput);
  if ("error" in b) return b.error;
  return reply(await createConcept(b.data, "tu"), (concept) => ({ concept }));
}
