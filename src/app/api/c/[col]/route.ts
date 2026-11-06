import type { NextRequest } from "next/server";
import { list, put, stamp } from "@/lib/db";
import { createAlert, listProjects } from "@/lib/hub";
import { COLLECTIONS, isCollection, validate } from "../collections";

// API per te (protetta dalla password): elenco e creazione per ogni sezione dell'hub.
const noStore = { "Cache-Control": "no-store" };

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/c/[col]">) {
  const { col } = await ctx.params;
  if (!isCollection(col)) return Response.json({ error: "Sezione sconosciuta" }, { status: 404 });
  const items = col === "projects" ? await listProjects() : await list(col);
  return Response.json({ items }, { headers: noStore });
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/c/[col]">) {
  const { col } = await ctx.params;
  if (!isCollection(col)) return Response.json({ error: "Sezione sconosciuta" }, { status: 404 });
  const body = await request.json().catch(() => null);

  if (col === "alerts") {
    const res = await createAlert({ source: "tu", ...body });
    return res.ok ? Response.json({ item: res.alert }) : Response.json({ error: res.error }, { status: res.status });
  }

  const result = await validate(col, body);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  const item = await put(COLLECTIONS[col].name, stamp(result.data));
  return Response.json({ item });
}
