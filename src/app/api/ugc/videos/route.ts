import { connection } from "next/server";
import { noStore } from "@/lib/ugc-http";
import { videosWithResults } from "@/lib/ugc-store";

/** Tutti i video con concept e numeri (tabella Risultati). */
export async function GET() {
  await connection();
  return Response.json({ items: await videosWithResults() }, { headers: noStore });
}
