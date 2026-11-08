import type { NextRequest } from "next/server";
import { agentAuthError } from "@/lib/agent-auth";
import { agentBody } from "@/lib/ugc-agent";
import { noStore, reply } from "@/lib/ugc-http";
import { askQuestion, listQuestions, questionInput } from "@/lib/ugc-store";

// Domande a Branko (agent). RARE: decidi da solo tutto quello che puoi, chiedi solo quando senza
// quella risposta faresti un lavoro sbagliato. Branko le vede negli aggiornamenti live; se risponde
// vieni svegliato e la risposta compare in cima alla tua coda.
export async function GET(request: NextRequest) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const sp = request.nextUrl.searchParams;
  const status = sp.get("status");
  const items = await listQuestions({
    status: status === "aperta" || status === "risposta" || status === "chiusa" ? status : undefined,
    by: sp.get("agent") ?? undefined,
  });
  return Response.json({ items }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const b = await agentBody(request, questionInput);
  if ("error" in b) return b.error;
  return reply(await askQuestion(b.data, b.agent), (question) => ({
    ok: true,
    question,
    message: "Domanda visibile a Branko negli aggiornamenti live. Intanto vai avanti con il resto: se risponde vieni svegliato.",
  }));
}
