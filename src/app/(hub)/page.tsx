"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AgentsOnline } from "@/components/agents-online";
import { AgendaList } from "@/components/calendar/month-grid";
import { Icon } from "@/components/icons";
import { List, PageBody, PageHeader, Progress, Section, SectionLink, Stat, StatGrid } from "@/components/kit";
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
      <PageHeader wide title={greeting(now)} subtitle={today ? today[0].toUpperCase() + today.slice(1) : undefined} />
      <PageBody wide>
        {/* Due colonne su desktop. Su telefono una sola, in ordine d'importanza (order-*). */}
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start lg:gap-x-8">
          <div className="contents lg:flex lg:flex-col lg:gap-10">
            {/* Annunci: in cima, perché è l'unica cosa che va letta */}
            <Section className="order-1" title="Annunci" action={<SectionLink href="/annunci" />}>
              {!alerts.data ? (
                <div className="skeleton h-16 rounded-2xl" />
              ) : unread.length === 0 ? (
                <Quiet icon="check">Niente di importante da leggere. Tutto tranquillo.</Quiet>
              ) : (
                <List className="stagger">
                  {unread.slice(0, 3).map((a) => {
                    const urgent = a.level === "urgente";
                    return (
                      <Link key={a.id} href="/annunci" className="row-link relative flex items-start gap-3 px-4 py-3.5">
                        {urgent && <span aria-hidden className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-[#e66767]" />}
                        <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${urgent ? "bg-[#e66767]/12 text-[#ec8585]" : "bg-white/[0.06] text-soft"}`}>
                          <Icon name={urgent ? "alert" : "bell"} className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{a.title}</span>
                          <span className="mt-0.5 block truncate text-xs text-muted">
                            <span className={urgent ? "font-medium text-[#ec8585]" : ""}>{urgent ? "Urgente" : "Importante"}</span> · {a.source} · {ago(a.updatedAt)}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                  {unread.length > 3 && (
                    <Link href="/annunci" className="row-link block px-4 py-2.5 text-xs text-muted">
                      e altri {unread.length - 3}
                    </Link>
                  )}
                </List>
              )}
            </Section>

            <Section className="order-2" title="Oggi" action={<SectionLink href="/calendario">Calendario</SectionLink>}>
              <TodayAgenda now={now} />
            </Section>

            <Section className="order-4" title="Progetti attivi" action={<SectionLink href="/progetti" />}>
              {!projects.data ? (
                <div className="skeleton h-28 rounded-2xl" />
              ) : active.length === 0 ? (
                <Quiet href="/progetti">Nessun progetto attivo. Creane uno →</Quiet>
              ) : (
                <List className="stagger">
                  {active.slice(0, 4).map((p) => (
                    <Link key={p.id} href={`/progetti/${p.id}`} className="row-link flex items-center gap-3 px-4 py-3.5">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-base">{p.emoji || p.name[0]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="mt-0.5 block truncate text-[13px] text-muted">{p.latest?.summary ?? "Nessun checkpoint ancora."}</span>
                      </span>
                      {p.latest?.progress !== undefined && (
                        <span className="w-14 shrink-0 space-y-1.5 text-right">
                          <span className="block text-[13px] font-medium tabular-nums">{p.latest.progress}%</span>
                          <Progress value={p.latest.progress} />
                        </span>
                      )}
                    </Link>
                  ))}
                </List>
              )}
            </Section>

            {podium.length > 0 && index && (
              <Section className="order-8" title={`Modelli AI · ${index.label}`} action={<SectionLink href="/modelli" />}>
                <List className="stagger">
                  {podium.map((m, i) => (
                    <Link key={m.id} href="/modelli" className="row-link flex items-center gap-3 px-4 py-3">
                      <span className="w-5 shrink-0 text-center text-sm font-semibold text-muted tabular-nums">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{m.name}</span>
                        <span className="block truncate text-xs text-muted">{m.org}</span>
                      </span>
                      <span className="text-sm font-medium tabular-nums">{formatScore(m.scores[index.key], index.unit)}</span>
                    </Link>
                  ))}
                </List>
              </Section>
            )}
          </div>

          <div className="contents lg:flex lg:flex-col lg:gap-10">
            <Section className="order-3" title="Chi è sveglio">
              <AgentsOnline />
            </Section>

            <Section className="order-5" title="Dai bot" action={<SectionLink href="/agenti">Apri chat</SectionLink>}>
              {!chat.data ? (
                <div className="skeleton h-28 rounded-2xl" />
              ) : lastFromBots.length === 0 ? (
                <Quiet href="/agenti">Ancora nessuna risposta dai bot.</Quiet>
              ) : (
                <List className="stagger">
                  {lastFromBots.map((m) => (
                    <Link key={m.id} href="/agenti" className="row-link flex gap-3 px-4 py-3">
                      <span className="orb grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold">{botName(m.bot)[0]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2 text-xs text-muted">
                          <span className="truncate text-sm font-medium text-fg">{botName(m.bot)}</span>
                          <span className="shrink-0">{ago(m.ts)}</span>
                        </span>
                        <span className="line-clamp-1 text-[13px] text-muted">{m.text || (m.media?.length ? "📎 Media" : "")}</span>
                      </span>
                    </Link>
                  ))}
                </List>
              )}
            </Section>

            <Section className="order-6" title="Dropshipping · ads attive" action={<SectionLink href="/dropshipping" />}>
              <StatGrid two>
                <Stat label="Ads attive" value={ads.data ? liveAds.length : "…"} />
                <Stat label="ROAS" value={ads.data ? (spend ? `${(revenue / spend).toLocaleString("it-IT", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}×` : "—") : "…"} />
                <Stat label="Spesa" value={ads.data ? eur(spend) : "…"} />
                <Stat label="Ricavi" value={ads.data ? eur(revenue) : "…"} />
              </StatGrid>
            </Section>

            <Section className="order-7" title="Ultimi media" action={<SectionLink href="/media" />}>
              {!media.data ? (
                <div className="skeleton h-24 rounded-2xl" />
              ) : media.data.items.length === 0 ? (
                <Quiet href="/media">Ancora nessun media dai bot.</Quiet>
              ) : (
                <div className="stagger grid grid-cols-3 gap-2">
                  {media.data.items.slice(0, 6).map((m) => (
                    <Link key={m.id} href="/media" aria-label={`Media da ${m.sourceName}`}>
                      <Thumb item={m} />
                    </Link>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </div>
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
  if (!cal.data || !meta.data) return <div className="skeleton h-20 rounded-2xl" />;
  // Quello in corso e quello che deve ancora finire, più le cose di tutto il giorno.
  const left = expand(cal.data.events, today, today).filter((o) => o.allDay || o.end > wall);
  if (!left.length) return <Quiet href="/calendario">Niente in programma per il resto di oggi. Apri il calendario →</Quiet>;
  return (
    <Link href="/calendario" className="panel lift block overflow-hidden rounded-2xl">
      <AgendaList occs={left.slice(0, 4)} categories={meta.data.settings.categories} now={wall} />
      {left.length > 4 && <p className="border-t border-line px-4 py-2.5 text-xs text-muted">e altri {left.length - 4}</p>}
    </Link>
  );
}

/** Riga quieta per gli stati vuoti, dentro un pannello. */
function Quiet({ href, icon, children }: { href?: string; icon?: "check"; children: ReactNode }) {
  const inner = (
    <>
      {icon && <Icon name={icon} className="size-4 shrink-0" />}
      <span>{children}</span>
    </>
  );
  const cls = "panel flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm text-muted";
  return href ? (
    <Link href={href} className={`${cls} lift hover:text-fg`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
