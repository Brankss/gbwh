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
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 px-3 pt-3 pb-3 md:px-8 md:pt-5">
          <div className="skeleton h-10 rounded-xl" />
          <div className="skeleton h-11 rounded-xl" />
          <div className="skeleton flex-1 rounded-2xl" />
        </div>
      </>
    );
  }
  return <CalendarApp />;
}
