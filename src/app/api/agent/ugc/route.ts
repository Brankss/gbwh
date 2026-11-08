import type { NextRequest } from "next/server";
import { agentAuthError } from "@/lib/agent-auth";
import { ACTIVE_STAGES, ROLES, STAGES, type RoleId } from "@/lib/ugc";
import { adesso, agentFrom, library, protocol, roleLabel, team, viewBriefShort, viewConceptShort, viewLearning } from "@/lib/ugc-agent";
import { noStore } from "@/lib/ugc-http";
import { botName, getSettings, listBriefs, listConcepts, listLearnings, queue } from "@/lib/ugc-store";

// UGC Factory per gli agent: il punto d'ingresso. Istruzioni complete + situazione della catena.
export async function GET(request: NextRequest) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const agent = agentFrom(request);
  const settings = await getSettings();
  const [squadra, briefs, concepts, learnings, queues] = await Promise.all([
    team(settings, agent),
    listBriefs(),
    listConcepts(),
    listLearnings(),
    Promise.all(ROLES.map(async (r) => [r.id, (await queue(r.id)).length] as const)),
  ]);
  const names = Object.fromEntries(
    await Promise.all(ROLES.filter((r) => settings.roles[r.id]).map(async (r) => [r.id, await botName(settings.roles[r.id]!)] as const)),
  ) as Partial<Record<RoleId, string>>;

  return Response.json(
    {
      adesso: adesso(),
      squadra,
      catena: STAGES.map((s) => {
        const bot = s.role && s.role !== "tu" ? settings.roles[s.role as RoleId] : null;
        return {
          fase: s.id,
          nome: s.label,
          concept: concepts.filter((c) => c.stage === s.id).length,
          tocca_a: s.role ? `${roleLabel(s.role)}${bot ? ` (${names[s.role as RoleId] ?? bot}, '${bot}')` : s.role === "tu" ? "" : " (non assegnato: chiunque)"}` : "nessuno",
        };
      }),
      coda: Object.fromEntries(queues),
      brief_attivi: briefs.filter((b) => b.status === "attivo").sort((a, b) => b.updatedAt - a.updatedAt).map(viewBriefShort),
      concept_in_corso: concepts
        .filter((c) => ACTIVE_STAGES.includes(c.stage))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((c) => {
          const v = viewConceptShort(c);
          return { id: v.id, title: v.title, stage: v.stage, fase: v.fase, format: v.format_nome, hook_scelto: v.hook_scelto, owner: v.owner, aggiornato: v.aggiornato };
        }),
      playbook: learnings.slice(0, 30).map(viewLearning),
      libreria: library(),
      protocollo: protocol(settings, names),
    },
    { headers: noStore },
  );
}
