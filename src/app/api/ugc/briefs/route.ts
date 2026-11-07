import type { NextRequest } from "next/server";
import { body, reply } from "@/lib/ugc-http";
import { briefInput, createBrief } from "@/lib/ugc-store";

export async function POST(request: NextRequest) {
  const b = await body(request, briefInput);
  if ("error" in b) return b.error;
  return reply(await createBrief(b.data, "tu"), (brief) => ({ brief }));
}
