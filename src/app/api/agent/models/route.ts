import type { NextRequest } from "next/server";
import { z } from "zod";
import "@/lib/schemas"; // errori in italiano
import { agentAuthError, zodMessage } from "@/lib/agent-auth";
import { pushCategory } from "@/lib/models-sync";

const body = z.object({
  kind: z.enum(["llm", "image", "video"]),
  source: z.string().trim().min(1).max(80),
  models: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        org: z.string().trim().min(1).max(60),
        open: z.boolean().optional(),
        released: z.string().max(20).optional(),
        scores: z.record(z.string().max(60), z.number().finite()),
      }),
    )
    .min(1)
    .max(500),
});

// Un agent carica una classifica completa per una categoria (sostituisce quella esistente).
export async function POST(request: NextRequest) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: zodMessage(parsed.error) }, { status: 400 });
  const { kind, source, models } = parsed.data;
  const entries = models.map((m) => ({ ...m, id: m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") }));
  await pushCategory(kind, entries, source);
  return Response.json({ ok: true, kind, count: entries.length });
}
