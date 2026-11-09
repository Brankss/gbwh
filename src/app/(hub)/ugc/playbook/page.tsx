"use client";

import { Playbook } from "@/components/ugc/playbook";
import { UgcSubPage } from "@/components/ugc/regia-more";

// Playbook (lezioni dai numeri) e libreria creativa (format, hook) che i bot seguono.

export default function UgcPlaybookPage() {
  return (
    <UgcSubPage title="Playbook" subtitle={(d) => `${d.learnings} ${d.learnings === 1 ? "lezione" : "lezioni"} · libreria dei format e degli hook`}>
      {(data) => <Playbook data={data} />}
    </UgcSubPage>
  );
}
