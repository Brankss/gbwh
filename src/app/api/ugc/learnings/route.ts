import { connection, type NextRequest } from "next/server";
import { body, noStore, reply } from "@/lib/ugc-http";
import { addLearning, learningInput, listLearnings } from "@/lib/ugc-store";

export async function GET() {
  await connection();
  return Response.json({ items: await listLearnings() }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  const b = await body(request, learningInput);
  if ("error" in b) return b.error;
  return reply(await addLearning(b.data, "tu"), (learning) => ({ learning }));
}
