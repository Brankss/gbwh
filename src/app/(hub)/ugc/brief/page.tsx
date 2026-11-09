"use client";

import { useState } from "react";
import { Button } from "@/components/kit";
import { BriefForm } from "@/components/ugc/brief-form";
import { BriefList } from "@/components/ugc/briefs";
import { UgcSubPage } from "@/components/ugc/regia-more";
import type { BriefSummary } from "@/lib/ugc-store";

// Brief della UGC Factory: da qui partono i concept (ricerca e angoli dentro ogni brief).

export default function UgcBriefsPage() {
  const [form, setForm] = useState<BriefSummary | "new" | null>(null);
  return (
    <>
      <UgcSubPage
        title="Brief"
        subtitle={(d) => (d.briefList.length ? `${d.briefList.filter((b) => b.status === "attivo").length} attivi · UGC Factory` : "UGC Factory")}
        actions={
          <Button icon="plus" onClick={() => setForm("new")}>
            <span className="sm:hidden">Brief</span>
            <span className="hidden sm:inline">Nuovo brief</span>
          </Button>
        }
      >
        {(data) => <BriefList briefs={data.briefList} onNew={() => setForm("new")} onEdit={setForm} />}
      </UgcSubPage>
      {form && <BriefForm brief={form === "new" ? undefined : form} onClose={() => setForm(null)} />}
    </>
  );
}
