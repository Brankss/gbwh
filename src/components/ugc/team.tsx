"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Section, inputClass } from "@/components/kit";
import { ago, send } from "@/lib/client";
import { ROLES, type UgcSettings } from "@/lib/ugc";
import { FormError, GROUP, ROW_LINK, Switch, UGC_KEY, useSave, whoName, type UgcOverview } from "./common";

// Tab "Squadra": chi fa quale ruolo, la sveglia automatica e il registro delle ultime modifiche.

export function Team({ data }: { data: UgcOverview }) {
  const [draft, setDraft] = useState<UgcSettings | null>(null);
  const [logShown, setLogShown] = useState(10);
  const { error, busy, run } = useSave(() => setDraft(null));
  const s = draft ?? data.settings;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(data.settings);
  const edit = (patch: Partial<UgcSettings>) => setDraft({ ...s, ...patch, roles: { ...s.roles, ...(patch.roles ?? {}) } });

  return (
    <div className="space-y-8">
      <Section title="Ruoli">
        <p className="-mt-1 text-sm text-muted">Il bot assegnato riceve un&apos;email quando c&apos;è lavoro per il suo ruolo.</p>
        <div className={GROUP}>
          {ROLES.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium">{r.label}</p>
                <p className="text-[13px] leading-snug text-muted">{r.does}</p>
              </div>
              <select
                className={`${inputClass} py-2! sm:w-48`}
                value={s.roles[r.id] ?? ""}
                onChange={(e) => edit({ roles: { [r.id]: e.target.value || null } as UgcSettings["roles"] })}
                aria-label={`Bot per il ruolo ${r.label}`}
              >
                <option value="">— nessuno —</option>
                {data.bots.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <div className="flex items-center gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium">Sveglia automatica</p>
              <p className="text-[13px] leading-snug text-muted">A ogni cambio di fase il bot di turno viene svegliato da solo.</p>
            </div>
            <Switch on={s.autoWake} onChange={(v) => edit({ autoWake: v })} label="Sveglia automatica" />
          </div>
        </div>
        <FormError>{error}</FormError>
        {dirty && (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Annulla
            </Button>
            <Button disabled={busy} onClick={() => run(() => send("PATCH", "/api/ugc/settings", { roles: s.roles, autoWake: s.autoWake }, [UGC_KEY]))}>
              Salva squadra
            </Button>
          </div>
        )}
      </Section>

      <Section title="Attività recente">
        {data.log.length ? (
          <div className={GROUP}>
            {data.log.slice(0, logShown).map((e, i) => {
              const href = e.conceptId ? `/ugc/${e.conceptId}` : e.briefId ? `/ugc/brief/${e.briefId}` : null;
              const body = (
                <>
                  <p className="flex items-baseline gap-2 text-xs text-muted">
                    <span className="font-medium text-[#c4c4c4]">{whoName(data.bots, e.by)}</span>
                    <span className="min-w-0 flex-1 truncate">{e.action}</span>
                    <span className="shrink-0">{ago(e.at)}</span>
                  </p>
                  <p className="mt-0.5 truncate text-sm">{e.title}</p>
                </>
              );
              return href ? (
                <Link key={i} href={href} className={ROW_LINK}>
                  {body}
                </Link>
              ) : (
                <div key={i} className="px-4 py-3">
                  {body}
                </div>
              );
            })}
            {data.log.length > logShown && (
              <button onClick={() => setLogShown(data.log.length)} className="press block min-h-11 w-full px-4 py-3 text-center text-sm text-[#b4b4b4] hover:bg-white/[0.035] hover:text-fg">
                Mostra altre {data.log.length - logShown}
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">Ancora nessuna attività.</p>
        )}
      </Section>
    </div>
  );
}
