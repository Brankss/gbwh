import { verifyMail } from "@/lib/wake";

/** Prova la configurazione email (credenziali e server) senza mandare niente. */
export async function POST() {
  const res = await verifyMail();
  return Response.json(res, { status: res.ok ? 200 : 502 });
}
