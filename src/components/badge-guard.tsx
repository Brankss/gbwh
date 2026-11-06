"use client";

import { useEffect } from "react";

/**
 * Netlify inietta in basso a destra un badge ("Powered by Netlify") che può coprire il pulsante
 * d'invio. Invece di indovinarne la misura, lo cerchiamo sulla pagina: un elemento fisso, piccolo,
 * attaccato al bordo basso, che non è nostro. Ne misuriamo l'altezza e la scriviamo in
 * --badge-space: la barra di scrittura (.composer-dock) si alza di quel tanto.
 */
export function BadgeGuard() {
  useEffect(() => {
    const root = document.documentElement;

    const isOurs = (el: Element) => el.closest("[data-app]") !== null;

    const measure = () => {
      let space = 0;
      for (const el of Array.from(document.body.children)) {
        if (isOurs(el) || el.tagName === "SCRIPT" || el.tagName === "NEXT-ROUTE-ANNOUNCER") continue;
        const style = getComputedStyle(el);
        if (style.position !== "fixed" || style.display === "none" || style.visibility === "hidden") continue;
        const r = el.getBoundingClientRect();
        const small = r.height > 12 && r.height < 160 && r.width < innerWidth * 0.95;
        const atBottom = r.bottom >= innerHeight - 80 && r.top > innerHeight * 0.5;
        if (small && atBottom) space = Math.max(space, innerHeight - r.top + 12);
      }
      if (space > 0) {
        root.style.setProperty("--badge-space", `${Math.ceil(space)}px`);
        root.dataset.nfBadge = "";
      } else {
        root.style.removeProperty("--badge-space");
      }
    };

    // Il badge arriva dopo il caricamento: osserviamo la pagina e rimisuriamo.
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true });
    addEventListener("resize", schedule);
    const timers = [300, 1000, 2500, 5000].map((t) => setTimeout(schedule, t));
    schedule();

    return () => {
      mo.disconnect();
      removeEventListener("resize", schedule);
      timers.forEach(clearTimeout);
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
