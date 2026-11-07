"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { logout } from "@/app/actions";
import { useApi } from "@/lib/client";
import type { Alert } from "@/lib/schemas";
import { Icon, type IconName } from "./icons";
import { Liquid } from "./liquid";

// Struttura dell'hub: barra laterale a icone su desktop, menu a scomparsa su mobile.

export const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Adesso", icon: "home" },
  { href: "/calendario", label: "Calendario", icon: "calendar" },
  { href: "/annunci", label: "Annunci", icon: "bell" },
  { href: "/progetti", label: "Progetti", icon: "folder" },
  { href: "/dropshipping", label: "Dropship", icon: "cart" },
  { href: "/ugc", label: "UGC Factory", icon: "film" },
  { href: "/media", label: "Media", icon: "image" },
  { href: "/agenti", label: "Agenti", icon: "chat" },
  { href: "/modelli", label: "Modelli AI", icon: "chart" },
];

const MenuContext = createContext<() => void>(() => {});

/** Pulsante ☰ da mettere nell'header delle pagine: su mobile apre il menu. */
export function MenuButton() {
  const open = useContext(MenuContext);
  return (
    <button
      onClick={open}
      aria-label="Menu"
      className="press grid size-9 shrink-0 place-items-center rounded-full text-[#b4b4b4] hover:bg-white/[0.07] hover:text-fg md:hidden"
    >
      <Icon name="menu" />
    </button>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Legge l'indirizzo attuale: sta dentro <Suspense> perché sulle pagine dinamiche si conosce solo a runtime. */
function CurrentPath({ children }: { children: (pathname: string) => ReactNode }) {
  return children(usePathname());
}

export function HubShell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  // Annunci non letti: il numero che conta davvero, sempre in vista.
  const { data } = useApi<{ items: Alert[] }>("/api/c/alerts", { refreshInterval: 20_000 });
  const unread = data?.items.filter((a) => !a.readAt && !a.archivedAt).length ?? 0;

  useEffect(() => {
    document.title = unread ? `(${unread}) Hub` : "Hub";
  }, [unread]);

  const links = (variant: "rail" | "drawer", onNavigate?: () => void) => (
    <Suspense fallback={linkList("", variant, onNavigate)}>
      <CurrentPath>{(pathname) => linkList(pathname, variant, onNavigate)}</CurrentPath>
    </Suspense>
  );

  const linkList = (pathname: string, variant: "rail" | "drawer", onNavigate?: () => void) =>
    NAV.map((item) => {
      const active = isActive(pathname, item.href);
      const badge = item.href === "/annunci" && unread > 0 && (
        <span
          className={`chrome grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${
            variant === "rail" ? "absolute top-1 right-2.5 ring-2 ring-black" : "ml-auto"
          }`}
        >
          {unread}
        </span>
      );
      if (variant === "rail") {
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`group relative flex flex-col items-center gap-1 rounded-2xl px-1 py-1.5 transition-colors ${active ? "text-fg" : "text-[#9a9a9a] hover:text-fg"}`}
          >
            <span className="relative grid size-11 place-items-center">
              {/* Voce attiva: goccia d'argento liquido che si deforma dietro l'icona */}
              <span
                className={`absolute inset-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  active
                    ? "chrome blob scale-100 opacity-100"
                    : "blob scale-50 bg-white/[0.07] opacity-0 group-hover:scale-90 group-hover:opacity-100 group-active:scale-75"
                }`}
              />
              <span className={`relative transition-transform duration-300 group-hover:scale-105 ${active ? "text-black" : ""}`}>
                <Icon name={item.icon} />
              </span>
            </span>
            <span className={`text-[10px] tracking-wide ${active ? "font-semibold" : "font-medium"}`}>{item.label}</span>
            {badge}
          </Link>
        );
      }
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={`press flex items-center gap-3.5 rounded-2xl px-3.5 py-2.5 text-[15px] ${
            active ? "chrome font-semibold" : "border border-transparent text-[#b4b4b4] hover:bg-white/[0.05] hover:text-fg"
          }`}
        >
          <span className={`grid size-8 place-items-center rounded-xl ${active ? "" : "bg-white/[0.04]"}`}>
            <Icon name={item.icon} className="size-[18px]" />
          </span>
          {item.label}
          {badge}
        </Link>
      );
    });

  return (
    <MenuContext.Provider value={() => setDrawer(true)}>
      <div className="relative flex h-dvh overflow-hidden">
        {/* Mercurio nero sullo sfondo, dietro a tutto */}
        <Liquid />

        {/* Desktop: barra a icone */}
        <nav className="glass scroll-thin relative z-10 hidden w-[80px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-white/[0.06] px-1.5 py-4 md:flex">
          <div className="mb-4 grid place-items-center">
            <span className="chrome-text text-2xl font-black tracking-tighter">B</span>
            <span aria-hidden className="mt-3 h-px w-8 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>
          {links("rail")}
          <form action={logout} className="mt-auto pt-3">
            <span aria-hidden className="mx-auto mb-2 block h-px w-8 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <button title="Esci" className="press flex w-full flex-col items-center gap-1 rounded-2xl py-2 text-[#9a9a9a] hover:text-fg">
              <Icon name="logout" />
              <span className="text-[10px] font-medium tracking-wide">Esci</span>
            </button>
          </form>
        </nav>

        <div className="relative z-10 flex min-w-0 flex-1 flex-col">{children}</div>

        {/* Mobile: menu a scomparsa */}
        {drawer && (
          <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal>
            <button aria-label="Chiudi menu" className="animate-fade absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setDrawer(false)} />
            <div className="card animate-drawer absolute inset-y-0 left-0 flex w-[min(82vw,310px)] flex-col gap-1 rounded-l-none! p-3 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <div className="mb-4 flex items-center justify-between px-2">
                <span className="chrome-text text-[1.75rem] font-black tracking-tighter">Hub</span>
                <button
                  onClick={() => setDrawer(false)}
                  aria-label="Chiudi"
                  className="press grid size-9 place-items-center rounded-full text-[#b4b4b4] hover:bg-white/[0.07] hover:text-fg"
                >
                  <Icon name="close" />
                </button>
              </div>
              <div className="stagger flex flex-col gap-1">{links("drawer", () => setDrawer(false))}</div>
              <form action={logout} className="mt-auto">
                <span aria-hidden className="mx-2 mb-2 block h-px bg-gradient-to-r from-white/15 via-white/5 to-transparent" />
                <button className="press flex w-full items-center gap-3.5 rounded-2xl px-3.5 py-2.5 text-[#9a9a9a] hover:bg-white/[0.05] hover:text-fg">
                  <span className="grid size-8 place-items-center rounded-xl bg-white/[0.04]">
                    <Icon name="logout" className="size-[18px]" />
                  </span>
                  Esci
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </MenuContext.Provider>
  );
}
