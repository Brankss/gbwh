import { after, connection } from "next/server";
import { getModelsData, syncFromArtificialAnalysis } from "@/lib/models-sync";

const DAY = 24 * 60 * 60 * 1000;

// Dati delle classifiche. Se sono vecchi di più di un giorno e c'è la chiave, si aggiornano in background.
export async function GET() {
  await connection(); // sempre a runtime: mai "fotografata" al build
  const data = await getModelsData();
  const configured = Boolean(process.env.AA_API_KEY);
  if (configured && (!data || Date.now() - data.updatedAt > DAY)) {
    after(() => syncFromArtificialAnalysis().catch((e) => console.error("[models] sync fallito", e)));
  }
  return Response.json({ data, configured }, { headers: { "Cache-Control": "no-store" } });
}
