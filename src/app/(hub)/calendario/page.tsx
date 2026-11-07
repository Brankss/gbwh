"use client";

import { CalendarApp } from "@/components/calendar/calendar-app";
import { PageHeader } from "@/components/kit";
import { useNow } from "@/lib/client";

// Il calendario vive tutto nel browser (vista, zoom e "adesso" dipendono dal tuo schermo e dalla tua ora):
// prima dell'idratazione mostriamo solo lo scheletro.
export default function CalendarPage() {
  const now = useNow();
  if (!now) {
    return (
      <>
        <PageHeader wide title="Calendario" />
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 px-3 pt-3 pb-3 md:px-6">
          <div className="h-10 skeleton rounded-2xl" />
          <div className="h-12 skeleton rounded-2xl" />
          <div className="flex-1 skeleton rounded-[1.25rem]" />
        </div>
      </>
    );
  }
  return <CalendarApp />;
}
