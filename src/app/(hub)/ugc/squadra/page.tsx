"use client";

import { UgcSubPage } from "@/components/ugc/regia-more";
import { Team } from "@/components/ugc/team";

// Squadra della UGC Factory: chi fa quale ruolo e la sveglia automatica.

export default function UgcTeamPage() {
  return (
    <UgcSubPage
      title="Squadra"
      subtitle={(d) => `${Object.values(d.settings.roles).filter(Boolean).length}/5 ruoli assegnati · sveglia ${d.settings.autoWake ? "automatica" : "spenta"}`}
    >
      {(data) => <Team data={data} />}
    </UgcSubPage>
  );
}
