import { connection } from "next/server";
import { filloInstructions } from "@/lib/fillo";

// Istruzioni da incollare a fillobot. Solo per Branko: il proxy fa passare qui soltanto la sessione principale.
export async function GET() {
  await connection();
  return new Response(await filloInstructions(), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
