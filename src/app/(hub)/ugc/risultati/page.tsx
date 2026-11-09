"use client";

import { UgcSubPage } from "@/components/ugc/regia-more";
import { Results } from "@/components/ugc/results";

// Risultati dei video UGC: una riga per video, numeri sommati di tutte le piattaforme.

export default function UgcResultsPage() {
  return (
    <UgcSubPage title="Risultati" subtitle={(d) => `${d.videos} video · spesa, hook rate, CTR e ROAS`} wide>
      {() => <Results />}
    </UgcSubPage>
  );
}
