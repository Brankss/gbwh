import type { NextRequest } from "next/server";
import { agentAuthError } from "@/lib/agent-auth";
import { ROLES, ROLE_IDS, type RoleId } from "@/lib/ugc";
import { agentFrom, refuse, roleLabel, roleQueue, rolesOf } from "@/lib/ugc-agent";
import { noStore } from "@/lib/ugc-http";
import { getSettings } from "@/lib/ugc-store";

/**
 * Il lavoro da fare: GET /api/agent/ugc/queue?role=regista oppure ?agent=berlu
 * (tutti i ruoli di quel bot; se non ne ha, la coda di tutti, così un bot da solo lavora lo stesso).
 */
export async function GET(request: NextRequest) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  const sp = request.nextUrl.searchParams;
  const roleParam = sp.get("role")?.trim().toLowerCase();
  const agent = agentFrom(request);
  const settings = await getSettings();

  let roles: RoleId[];
  let nota: string;
  if (roleParam) {
    if (!(ROLE_IDS as string[]).includes(roleParam)) return refuse(400, `role: "${roleParam}" non esiste. Usa uno di: ${ROLE_IDS.join(", ")}.`);
    roles = [roleParam as RoleId];
    const bot = settings.roles[roles[0]];
    nota = bot ? `Coda di ${roleLabel(roles[0])} (assegnato a '${bot}').` : `Coda di ${roleLabel(roles[0])} (ruolo non assegnato: chiunque può farlo).`;
  } else if (agent) {
    const mine = rolesOf(settings, agent);
    if (mine.length) {
      roles = mine;
      nota = `I tuoi ruoli: ${mine.map((r) => roleLabel(r)).join(", ")}.`;
    } else {
      roles = ROLES.map((r) => r.id);
      const free = ROLES.filter((r) => !settings.roles[r.id]).map((r) => r.label);
      nota =
        `Nessun ruolo assegnato a '${agent}' (li sceglie Branko in Squadra). Ti mostro la coda di TUTTI i ruoli, così puoi lavorare lo stesso: ` +
        (free.length ? `preferisci le voci dei ruoli non assegnati (${free.join(", ")}). ` : "tutti i ruoli hanno già un bot: lascia a loro il loro lavoro, salvo voci ferme da molto. ") +
        "Ricorda: al gate non puoi revisionare un concept scritto da te.";
    }
  } else {
    return refuse(400, `Dimmi di chi è la coda: ?agent=<il tuo id> (i ruoli assegnati a te) oppure ?role=<${ROLE_IDS.join("|")}>.`);
  }

  const lists = await Promise.all(roles.map((r) => roleQueue(r, agent)));
  const items = lists.flat().sort((a, b) => a.dal.localeCompare(b.dal));
  return Response.json(
    {
      ruoli: roles,
      nota,
      totale: items.length,
      per_ruolo: Object.fromEntries(roles.map((r, i) => [r, lists[i].length])),
      lavoro: items,
      ...(!items.length && {
        suggerimento:
          "Niente in coda per te. Puoi: leggere il Playbook e i numeri (GET /api/agent/ugc), proporre nuovi concept su un brief attivo (POST /api/agent/ugc/concepts), " +
          "o, se fai lo stratega, aprire un brief nuovo (POST /api/agent/ugc/briefs). Altrimenti fermati: tornerai sveglio quando c'è lavoro.",
      }),
      come: "Prendi la voce più vecchia libera (preso_da vuoto o tuo): PATCH /api/agent/ugc/concepts/<id> {agent, owner:'<il tuo id>'}, poi segui 'chiama'.",
    },
    { headers: noStore },
  );
}
