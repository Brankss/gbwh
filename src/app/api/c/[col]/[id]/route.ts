import type { NextRequest } from "next/server";
import { get, list, put, remove, type Doc } from "@/lib/db";
import { getProjectFull } from "@/lib/hub";
import type { Ad, Alert } from "@/lib/schemas";
import { COLLECTIONS, isCollection, validate } from "../../collections";

const noStore = { "Cache-Control": "no-store" };
const notFound = () => Response.json({ error: "Non trovato" }, { status: 404 });

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/c/[col]/[id]">) {
  const { col, id } = await ctx.params;
  if (!isCollection(col)) return notFound();
  if (col === "projects") {
    const full = await getProjectFull(id);
    return full ? Response.json(full, { headers: noStore }) : notFound();
  }
  const item = await get(COLLECTIONS[col].name, id);
  return item ? Response.json({ item }, { headers: noStore }) : notFound();
}

/** Modifica: si unisce al documento esistente e si rivalida tutto, così i default non sovrascrivono nulla. */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/c/[col]/[id]">) {
  const { col, id } = await ctx.params;
  if (!isCollection(col)) return notFound();
  const existing = await get<Doc & Record<string, unknown>>(COLLECTIONS[col].name, id);
  if (!existing) return notFound();
  const body = (await request.json().catch(() => ({}))) ?? {};

  if (col === "alerts") {
    const alert = existing as unknown as Alert;
    const now = Date.now();
    if (typeof body.read === "boolean") alert.readAt = body.read ? now : undefined;
    if (typeof body.archived === "boolean") alert.archivedAt = body.archived ? now : undefined;
    return Response.json({ item: await put("alerts", { ...alert, updatedAt: now }) });
  }

  const current: Record<string, unknown> = { ...existing };
  for (const k of ["id", "createdAt", "updatedAt"]) delete current[k];
  const { createdAt } = existing;
  const result = await validate(col, { ...current, ...body });
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  const item = await put(COLLECTIONS[col].name, { ...result.data, id, createdAt, updatedAt: Date.now() } as Doc);
  return Response.json({ item });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/c/[col]/[id]">) {
  const { col, id } = await ctx.params;
  if (!isCollection(col)) return notFound();
  if (!(await get(COLLECTIONS[col].name, id))) return notFound();

  // Collegamenti: un progetto si porta via i suoi checkpoint; un prodotto viene scollegato dalle pubblicità.
  if (col === "projects") {
    const own = (await list<Doc & { projectId: string }>("checkpoints")).filter((c) => c.projectId === id);
    await remove("checkpoints", own.map((c) => c.id));
  }
  if (col === "products") {
    for (const ad of (await list<Ad>("ads")).filter((a) => a.productId === id)) {
      await put("ads", { ...ad, productId: undefined, updatedAt: Date.now() });
    }
  }
  await remove(COLLECTIONS[col].name, [id]);
  return Response.json({ ok: true });
}
