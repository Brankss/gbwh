import type { NextRequest } from "next/server";
import { agentAuthError } from "@/lib/agent-auth";
import { ALERTS_PER_SOURCE_PER_DAY } from "@/lib/hub";
import { LEARNING_KINDS } from "@/lib/schemas";

// Istruzioni per gli agent, leggibili da loro stessi: GET /api/agent?token=...
export async function GET(request: NextRequest) {
  const denied = agentAuthError(request);
  if (denied) return denied;
  return Response.json({
    auth: "Header 'Authorization: Bearer <token>' oppure ?token=<token> su ogni richiesta.",
    endpoints: {
      "GET /api/board?bot=<id>&since=<cursor>": "Messaggi di Branko per te + note visibili a te. Ripassa con since=cursor.",
      "POST /api/board?bot=<id>":
        "Rispondi. Body: {message, name?, media?, product?, ad?}. Se sei un bot nuovo vieni creato con 'name'. " +
        "Con product/ad (id o nome) il media viene collegato alla scheda del prodotto/pubblicità.",
      "GET /api/agent/products": "Prodotti e pubblicità (id, nome, stato): per sapere a cosa collegare i media.",
      "GET /api/agent/projects": "Progetti con l'ultimo checkpoint di ognuno.",
      "GET /api/agent/projects/<id>": "Progetto completo: checkpoint (dal più recente) e conoscenze accumulate.",
      "POST /api/agent/projects/<id>/checkpoints":
        "Nuovo checkpoint. Body: {author, summary, progress?, next?: string[], learnings?: [{kind, text}]}",
      "POST /api/agent/alerts": "Annuncio importante per Branko. Body: {source, title, level, body?, link?, dedupeKey?}",
      "GET /api/agent/calendar":
        "Calendario di Branko: istruzioni complete, oggi, prossimi 7 giorni, cose da pianificare, preferenze. " +
        "Da lì aggiungi/sposti eventi (anche a parole: {agent, text:'palestra domani 18-19:30'}).",
      "POST /api/agent/heartbeat":
        "Segnale di vita, almeno ogni 15 minuti mentre lavori. Body: {agent, name?, status?: attivo|occupato|in pausa, doing?, projectId?}",
    },
    checkpoint: {
      summary: "A che punto è il progetto ADESSO, in poche frasi concrete.",
      next: "Prossimi passi.",
      learnings: `Cose da non dimenticare. kind: ${LEARNING_KINDS.join(" | ")}. Una per voce, specifica e riutilizzabile.`,
      regola: "Leggi l'ultimo checkpoint prima di lavorare a un progetto. Scrivine uno nuovo quando cambia lo stato o impari qualcosa.",
    },
    alerts: {
      level: "importante | urgente",
      regola:
        "La casella annunci è l'unico posto che Branko legge davvero. Scrivi SOLO se serve una sua decisione o azione, " +
        "o se è successo qualcosa che deve sapere oggi. Niente aggiornamenti di routine, niente 'tutto ok'. " +
        `Usa dedupeKey per lo stesso argomento (aggiorna invece di duplicare). Massimo ${ALERTS_PER_SOURCE_PER_DAY} al giorno per fonte.`,
    },
  });
}
