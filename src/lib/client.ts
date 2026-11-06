"use client";

import { useSyncExternalStore } from "react";
import useSWR, { mutate as globalMutate, type SWRConfiguration } from "swr";

// Helper lato browser per parlare con le API dell'hub.

export class ApiError extends Error {}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    // Sessione scaduta: ricarica pulita sul login (fuori dal router, siamo in un helper di fetch).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    location.href = "/login";
    throw new ApiError("Sessione scaduta");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Errore ${res.status}`);
  return data as T;
}

export const fetcher = <T,>(url: string) => fetch(url, { cache: "no-store" }).then((r) => handle<T>(r));

export function useApi<T>(url: string | null, config?: SWRConfiguration<T>) {
  return useSWR<T>(url, fetcher, { revalidateOnFocus: true, ...config });
}

/** POST/PATCH/DELETE in JSON; poi riaggiorna le chiavi indicate. */
export async function send<T = unknown>(method: "POST" | "PATCH" | "DELETE", url: string, body?: unknown, refresh: string[] = []) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await handle<T>(res);
  await Promise.all(refresh.map((k) => globalMutate(k)));
  return data;
}

export const eur = (n: number | undefined) =>
  n === undefined ? "—" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: n < 100 ? 2 : 0 }).format(n);

const rtf = new Intl.RelativeTimeFormat("it", { numeric: "auto" });
export function ago(ts: number) {
  const s = (ts - Date.now()) / 1000;
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.35, "week"],
    [12, "month"],
    [Infinity, "year"],
  ];
  let value = s;
  for (const [size, unit] of steps) {
    if (Math.abs(value) < size) return rtf.format(Math.round(value), unit);
    value /= size;
  }
  return "";
}

/* Ora corrente lato browser (0 durante il prerender), aggiornata ogni minuto. */
let nowValue = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const nowSubs = new Set<() => void>();
function subscribeNow(cb: () => void) {
  nowSubs.add(cb);
  timer ??= setInterval(() => {
    nowValue = Date.now();
    nowSubs.forEach((f) => f());
  }, 60_000);
  return () => {
    nowSubs.delete(cb);
    if (!nowSubs.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}
export function useNow() {
  return useSyncExternalStore(subscribeNow, () => (nowValue ||= Date.now()), () => 0);
}
