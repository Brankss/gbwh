"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AgentsOnline } from "@/components/agents-online";
import { AgendaList } from "@/components/calendar/month-grid";
import { Icon } from "@/components/icons";
import { Card, PageBody, PageHeader, Progress, Section, Stat } from "@/components/kit";
import { Thumb } from "@/components/media-grid";
import type { Bot, Inbox } from "@/lib/bots";
import { ago, eur, useApi, useNow } from "@/lib/client";
import type { ProjectSummary } from "@/lib/hub";
import { expand, wallNow, type CalEvent, type CalSettings } from "@/lib/calendar";
import { formatScore, type ModelsData } from "@/lib/models";
import type { Ad, Alert, MediaItem } from "@/lib/schemas";

function greeting(now: number) {
  if (!now) return "Ciao";
  const h = new Date(now).getHours();
  return h < 6 ? "Notte fonda" : h < 13 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera";
}

const more = (href: string, label = "Vedi tutto") => (
  <Link href={href} className="rounded-full px-2 py-0.5 text-xs font-medium text-[#b4b4b4] transition-colors hover:bg-white/[0.06] hover:text-fg">
    {label} →
  </Link>
);

export default function NowPage() {
  const alerts = useApi<{ items: Alert[] }>("/api/c/alerts", { refreshInterval: 20_000 });
  const projects = useApi<{ items: ProjectSummary[] }>("/api/c/projects");
  const media = useApi<{ items: MediaItem[] }>("/api/media");
  const ads = useApi<{ items: Ad[] }>("/api/c/ads");
  const chat = useApi<{ bots?: Bot[]; inbox?: Inbox }>("/api/messages", { refreshInterval: 30_000 });
  const models = useApi<{ data: ModelsData | null }>("/api/models");

  const unread = (alerts.data?.items ?? []).filter((a) => !a.readAt && !a.archivedAt);
  const active = (projects.data?.items ?? []).filter((p) => p.status === "attivo");
  const botName = (id: string) => chat.data?.bots?.find((b) => b.id === id)?.name ?? id;
  const lastFromBots = Object.values(chat.data?.inbox ?? {})
    .flat()
    .filter((m) => m.from === "bot")
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 4);
  const liveAds = (ads.data?.items ?? []).filter((a) => a.status === "attiva");
  const spend = liveAds.reduce((s, a) => s + (a.spend ?? 0), 0);
  const revenue = liveAds.reduce((s, a) => s + (a.revenue ?? 0), 0);
  const llm = models.data?.data?.llm;
  const index = llm?.benchmarks[0];
  const podium = index
    ? [...llm!.models].filter((m) => m.scores[index.key] !== undefined).sort((a, b) => b.scores[index.key] - a.scores[index.key]).slice(0, 3)
    : [];

  const now = useNow();
  const today = now ? new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(now) : "";

  return (
    <>
      <PageHeader wide title={greeting(now)} subtitle={today || undefined} />
      <PageBody wide>
        {/* Annunci: in cima, perché è l'unica cosa che va letta */}
        <Section title="Annunci" action={more("/annunci")}>
          {!alerts.data ? (
            <div className="h-16 skeleton rounded-[1.25rem]" />
          ) : unread.length === 0 ? (
            <Card className="flex items-center gap-3 text-sm text-muted">
              <Icon name="check" className="size-4" /> Niente di importante da leggere. Tutto tranquillo.
            </Card>
          ) : (
            <div className="stagger space-y-2">
              {unread.slice(0, 3).map((a) => (
                <Link key={a.id} href="/annunci" className="matte flex items-start gap-3 rounded-[1.25rem] p-4 lift">
                  <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${a.level === "urgente" ? "bg-[#e66767]/15 text-[#e66767]" : "orb"}`}>
                    <Icon name={a.level === "urgente" ? "alert" : "bell"} className="size-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] text-muted">
                      {a.level === "urgente" ? "Urgente" : "Importante"} · {a.source} · {ago(a.updatedAt)}
                    </span>
                    <span className="block font-medium">{a.title}</span>
                  </span>
                </Link>
              ))}
              {unread.length > 3 && <p className="text-xs text-muted">e altri {unread.length - 3}</p>}
            </div>
          )}
        </Section>

        <Section title="Oggi" action={more("/calendario", "Calendario")}>
          <TodayAgenda now={now} />
        </Section>

        <Section title="Chi è sveglio">
          <AgentsOnline />
        </Section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Progetti attivi" action={more("/progetti")}>
            {!projects.data ? (
              <div className="h-28 skeleton rounded-[1.25rem]" />
            ) : active.length === 0 ? (
              <EmptyLine href="/progetti">Nessun progetto attivo. Creane uno →</EmptyLine>
            ) : (
              <div className="stagger space-y-2">
                {active.slice(0, 4).map((p) => (
                  <Link key={p.id} href={`/progetti/${p.id}`} className="matte block space-y-2 rounded-[1.25rem] p-4 lift">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {p.emoji ? `${p.emoji} ` : ""}
                        {p.name}
                      </span>
                      {p.latest?.progress !== undefined && <span className="ml-auto text-sm tabular-nums">{p.latest.progress}%</span>}
                    </div>
                    {p.latest?.progress !== undefined && <Progress value={p.latest.progress} />}
                    <p className="line-clamp-2 text-sm text-muted">{p.latest?.summary ?? "Nessun checkpoint ancora."}</p>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          <Section title="Dai bot" action={more("/agenti", "Apri chat")}>
            {!chat.data ? (
              <div className="h-28 skeleton rounded-[1.25rem]" />
            ) : lastFromBots.length === 0 ? (
              <EmptyLine href="/agenti">Ancora nessuna risposta dai bot.</EmptyLine>
            ) : (
              <div className="stagger matte divide-y divide-line rounded-[1.25rem]">
                {lastFromBots.map((m) => (
                  <Link key={m.id} href="/agenti" className="flex gap-3 px-4 py-3 transition-colors hover:bg-white/[0.04]">
                    <span className="orb grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold">{botName(m.bot)[0]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex justify-between text-xs text-muted">
                        <span className="font-medium text-fg">{botName(m.bot)}</span>
                        {ago(m.ts)}
                      </span>
                      <span className="line-clamp-1 text-sm text-muted">{m.text || (m.media?.length ? "📎 Media" : "")}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Section>
        </div>

        <Section title="Dropshipping" action={more("/dropshipping")}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="Ads attive" value={ads.data ? liveAds.length : "…"} />
            <Stat label="Spesa (attive)" value={ads.data ? eur(spend) : "…"} />
            <Stat label="Ricavi (attive)" value={ads.data ? eur(revenue) : "…"} />
            <Stat label="ROAS" value={ads.data ? (spend ? `${(revenue / spend).toLocaleString("it-IT", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}×` : "—") : "…"} />
          </div>
        </Section>

        <Section title="Ultimi media" action={more("/media")}>
          {!media.data ? (
            <div className="h-24 skeleton rounded-[1.25rem]" />
          ) : media.data.items.length === 0 ? (
            <EmptyLine href="/media">Ancora nessun media dai bot.</EmptyLine>
          ) : (
            <div className="stagger grid grid-cols-3 gap-2 sm:grid-cols-6">
              {media.data.items.slice(0, 6).map((m) => (
                <Link key={m.id} href="/media">
                  <Thumb item={m} />
                </Link>
              ))}
            </div>
          )}
        </Section>

        {podium.length > 0 && index && (
          <Section title={`Modelli AI · ${index.label}`} action={more("/modelli")}>
            <div className="stagger grid gap-2 sm:grid-cols-3">
              {podium.map((m, i) => (
                <Card key={m.id} className="flex items-center gap-3">
                  <span className="orb grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{m.name}</span>
                    <span className="block text-xs text-muted">{m.org}</span>
                  </span>
                  <span className="text-sm tabular-nums">{formatScore(m.scores[index.key], index.unit)}</span>
                </Card>
              ))}
            </div>
          </Section>
        )}
      </PageBody>
    </>
  );
}

/** Cosa stai facendo adesso e cosa viene dopo, oggi. */
function TodayAgenda({ now }: { now: number }) {
  const wall = now ? wallNow(undefined, now) : "";
  const today = wall.slice(0, 10);
  const cal = useApi<{ events: CalEvent[] }>(today ? `/api/calendar?from=${today}&to=${today}` : null, { refreshInterval: 60_000 });
  const meta = useApi<{ settings: CalSettings }>("/api/calendar/meta");
  if (!cal.data || !meta.data) return <div className="h-20 skeleton rounded-[1.25rem]" />;
  // Quello in corso e quello che deve ancora finire, più le cose di tutto il giorno.
  const left = expand(cal.data.events, today, today).filter((o) => o.allDay || o.end > wall);
  if (!left.length) return <EmptyLine href="/calendario">Niente in programma per il resto di oggi. Apri il calendario →</EmptyLine>;
  return (
    <Link href="/calendario" className="matte block rounded-[1.25rem] p-2 lift">
      <AgendaList occs={left.slice(0, 4)} categories={meta.data.settings.categories} now={wall} />
      {left.length > 4 && <p className="px-3 pt-1.5 pb-1 text-xs text-muted">e altri {left.length - 4}</p>}
    </Link>
  );
}

function EmptyLine({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="matte block rounded-[1.25rem] p-4 text-sm text-muted hover:text-fg">
      {children}
    </Link>
  );
}
