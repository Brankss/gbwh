import type { NextRequest } from "next/server";
import { agentAuthError } from "@/lib/agent-auth";
import { agentBody, viewLearning } from "@/lib/ugc-agent";
import { noStore, reply } from "@/lib/ugc-http";
import { addLearning, learningInput, listLearnings } from "@/lib/ugc-store";

// Il Playbook (agent): leggilo prima di creare, scrivici dopo ogni revisione e ogni risultato.
export async function GET(request: NextRequest) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const sp = request.nextUrl.searchParams;
  const kind = sp.get("kind");
  const strength = sp.get("strength");
  const conceptId = sp.get("conceptId");
  const items = (await listLearnings()).filter(
    (l) => (!kind || l.kind === kind) && (!strength || l.strength === strength) && (!conceptId || l.conceptId === conceptId),
  );
  return Response.json({ items: items.map(viewLearning) }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const b = await agentBody(request, learningInput);
  if ("error" in b) return b.error;
  const text = b.data.text.toLowerCase();
  const twin = (await listLearnings()).find((l) => l.text.toLowerCase() === text);
  if (twin) return Response.json({ error: `C'è già questa voce nel Playbook (${twin.id}): aggiornala con PATCH /api/agent/ugc/learnings/${twin.id}.` }, { status: 409 });
  return reply(await addLearning(b.data, b.agent), (learning) => ({ ok: true, learning }));
}
