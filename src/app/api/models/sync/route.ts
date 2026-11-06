import { syncFromArtificialAnalysis } from "@/lib/models-sync";

// Aggiorna adesso (pulsante "Aggiorna" nella pagina Modelli).
export async function POST() {
  try {
    const data = await syncFromArtificialAnalysis();
    return Response.json({ data });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Aggiornamento fallito" }, { status: 502 });
  }
}
