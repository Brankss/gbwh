import { connection } from "next/server";
import { noStore } from "@/lib/ugc-http";
import { listBriefs, listConcepts, overview } from "@/lib/ugc-store";
import { listPresence } from "@/lib/presence";
import { getBots } from "@/lib/store";

// Panoramica della UGC Factory per la pagina: fasi, brief, concept, squadra, registro.
export async function GET() {
  await connection();
  const [ov, briefs, concepts, bots, presence] = await Promise.all([overview(), listBriefs(), listConcepts(), getBots(), listPresence()]);
  return Response.json({ ...ov, briefList: briefs, concepts, bots, presence }, { headers: noStore });
}
