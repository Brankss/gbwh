"use client";

import { useState } from "react";
import { send, useApi, ago } from "@/lib/client";
import { KIND_LABEL, TRACKED_ORGS, type ModelEntry, type ModelKind, type ModelsData } from "@/lib/models";
import { Button, Empty, Tabs } from "./kit";

export function useModels() {
  const res = useApi<{ data: ModelsData | null; configured: boolean }>("/api/models");
  return res;
}

export function KindTabs({ value, onChange, data }: { value: ModelKind; onChange: (k: ModelKind) => void; data: ModelsData | null }) {
  return (
    <Tabs
      value={value}
      onChange={onChange}
      options={(["llm", "image", "video"] as const).map((k) => ({ value: k, label: KIND_LABEL[k], count: data?.[k].models.length }))}
    />
  );
}

export type OrgScope = "seguite" | "tutte";
export type OpenScope = "tutti" | "open" | "chiusi";

export function filterModels(models: ModelEntry[], kind: ModelKind, org: OrgScope, open: OpenScope) {
  return models.filter(
    (m) =>
      (org === "tutte" || kind !== "llm" || (TRACKED_ORGS as readonly string[]).includes(m.org)) &&
      (open === "tutti" || (open === "open" ? m.open === true : m.open === false)),
  );
}

/** Stato della fonte dati + pulsante "Aggiorna". */
export function SourceBar({ data, configured, onSynced }: { data: ModelsData | null; configured: boolean; onSynced: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sync = async () => {
    setBusy(true);
    setError(null);
    try {
      await send("POST", "/api/models/sync", undefined, ["/api/models"]);
      onSynced();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      {data && (
        <span>
          Fonte: {data.source} · aggiornato {ago(data.updatedAt)}
        </span>
      )}
      {configured && (
        <Button small variant="ghost" icon="refresh" onClick={sync} disabled={busy}>
          {busy ? "Aggiorno…" : "Aggiorna"}
        </Button>
      )}
      {error && <span className="text-red-400">{error}</span>}
    </div>
  );
}

export function NoModelsData({ configured }: { configured: boolean }) {
  return (
    <Empty icon="chart" title="Nessun dato sui modelli, per ora">
      {configured ? (
        <>Premi “Aggiorna” per scaricare le classifiche da Artificial Analysis.</>
      ) : (
        <>
          Le classifiche si riempiono da sole da <strong>Artificial Analysis</strong> (Intelligence Index, benchmark, arene immagini e video).
          Crea una chiave API gratuita su artificialanalysis.ai e aggiungila su Netlify come <code>AA_API_KEY</code>. In alternativa un agent
          può caricarle con <code>POST /api/agent/models</code>.
        </>
      )}
    </Empty>
  );
}
