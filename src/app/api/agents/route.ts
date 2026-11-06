import { connection } from "next/server";
import { listPresence } from "@/lib/presence";

// Per te (protetto dalla password): chi è sveglio adesso.
export async function GET() {
  await connection();
  return Response.json({ items: await listPresence() }, { headers: { "Cache-Control": "no-store" } });
}
