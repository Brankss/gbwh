"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { logout } from "@/app/actions";
import { useApi } from "@/lib/client";
import type { Alert } from "@/lib/schemas";
import { Icon, type IconName } from "./icons";

// Struttura dell'hub: barra laterale a icone su desktop, menu a scomparsa su mobile.

export const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Adesso", icon: "home" },
  { href: "/annunci", label: "Annunci", icon: "bell" },
  { href: "/progetti", label: "Progetti", icon: "folder" },
  { href: "/dropshipping", label: "Dropship", icon: "cart" },
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
      className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg md:hidden"
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
          className={`grid h-5 min-w-5 place-items-center rounded-full bg-white px-1.5 text-[11px] font-semibold text-black ${
            variant === "rail" ? "absolute top-1 right-2" : "ml-auto"
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
            className={`group relative flex flex-col items-center gap-1 rounded-2xl px-1 py-2 transition-colors ${active ? "text-fg" : "text-muted hover:text-fg"}`}
          >
            <span className={`grid size-10 place-items-center rounded-2xl transition-colors ${active ? "gloss" : "group-hover:bg-surface-2"}`}>
              <Icon name={item.icon} />
            </span>
            <span className="text-[10px] font-medium">{item.label}</span>
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
          className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] transition-colors ${
            active ? "gloss text-fg" : "border border-transparent text-muted hover:bg-surface-2 hover:text-fg"
          }`}
        >
          <Icon name={item.icon} />
          {item.label}
          {badge}
        </Link>
      );
    });

  return (
    <MenuContext.Provider value={() => setDrawer(true)}>
      <div className="flex h-dvh overflow-hidden">
        {/* Desktop: barra a icone */}
        <nav className="scroll-thin hidden w-[76px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-surface px-1.5 py-4 md:flex">
          {links("rail")}
          <form action={logout} className="mt-auto">
            <button title="Esci" className="flex w-full flex-col items-center gap-1 py-2 text-muted transition-colors hover:text-fg">
              <Icon name="logout" />
              <span className="text-[10px] font-medium">Esci</span>
            </button>
          </form>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">{children}</div>

        {/* Mobile: menu a scomparsa */}
        {drawer && (
          <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal>
            <button aria-label="Chiudi menu" className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-pop" onClick={() => setDrawer(false)} />
            <div className="matte absolute inset-y-0 left-0 flex w-[min(80vw,300px)] flex-col gap-1 rounded-r-3xl p-3 pt-5 animate-pop">
              <div className="mb-3 flex items-center justify-between px-2">
                <span className="text-lg font-semibold tracking-tight">Hub</span>
                <button onClick={() => setDrawer(false)} aria-label="Chiudi" className="grid size-9 place-items-center rounded-full text-muted hover:text-fg">
                  <Icon name="close" />
                </button>
              </div>
              {links("drawer", () => setDrawer(false))}
              <form action={logout} className="mt-auto">
                <button className="flex w-full items-center gap-3 px-3 py-3 text-muted hover:text-fg">
                  <Icon name="logout" /> Esci
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </MenuContext.Provider>
  );
}
