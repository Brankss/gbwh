"use client";

import { useState } from "react";
import { Button, Section, inputClass } from "@/components/kit";
import { send, useNow } from "@/lib/client";
import { ROLES, type UgcSettings } from "@/lib/ugc";
import { FormError, GROUP, Switch, UGC_KEY, nameOf, useSave, type UgcOverview } from "./common";
import { LiveDot, presenceOf, since } from "./regia-events";

// Squadra (impostazioni): chi fa quale ruolo, se il bot è sveglio, e la sveglia automatica.
// Cosa fa la squadra minuto per minuto sta nella regia (Squadra live e Feed).

export function Team({ data }: { data: UgcOverview }) {
  const now = useNow();
  const [draft, setDraft] = useState<UgcSettings | null>(null);
  const { error, busy, run } = useSave(() => setDraft(null));
  const s = draft ?? data.settings;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(data.settings);
  // Bot già assegnati ma non ancora in bacheca (scrivono solo via API): restano scelti e con il loro nome.
  const extra = [...new Set(Object.values(data.settings.roles).filter((b): b is string => !!b && !data.bots.some((x) => x.id === b)))];
  const options = [...data.bots, ...extra.map((id) => ({ id, name: nameOf(data, id) }))];
  const edit = (patch: Partial<UgcSettings>) => setDraft({ ...s, ...patch, roles: { ...s.roles, ...(patch.roles ?? {}) } });

  return (
    <div className="space-y-8">
      <Section title="Ruoli">
        <p className="-mt-1 text-sm text-muted">I bot lavorano da soli: quello assegnato a un ruolo viene svegliato quando c&apos;è lavoro per lui.</p>
        <div className={GROUP}>
          {ROLES.map((r) => {
            const bot = s.roles[r.id];
            const p = presenceOf(data.presence, bot);
            return (
              <div key={r.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium">{r.label}</p>
                  <p className="text-[13px] leading-snug text-muted">{r.does}</p>
                  {bot && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      <LiveDot on={!!p?.online} />
                      <span className="truncate">{p ? (p.online ? (p.doing ?? "online") : `visto ${since(p.at, now)}`) : "mai visto"}</span>
                    </p>
                  )}
                </div>
                <select
                  className={`${inputClass} py-2! sm:w-48`}
                  value={bot ?? ""}
                  onChange={(e) => edit({ roles: { [r.id]: e.target.value || null } as UgcSettings["roles"] })}
                  aria-label={`Bot per il ruolo ${r.label}`}
                >
                  <option value="">— nessuno —</option>
                  {options.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
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
    </div>
  );
}
