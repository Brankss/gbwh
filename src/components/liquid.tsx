"use client";

import { useEffect, useId, useRef } from "react";
import { startLiquid, type Layout } from "./liquid-gl";

/**
 * Mercurio nero: forme che si fondono come un liquido (filtro "goo"), riflessi d'argento
 * da un ambiente a fasce e tentacoli che si staccano e si riassorbono. Solo SVG + CSS.
 *
 * - "backdrop": sfondo dell'hub, ai bordi, renderizzato a metà risoluzione (leggero).
 * - "hero": forma grande e nitida, per il login.
 */
type Variant = "backdrop" | "hero";

/**
 * Mercurio nero. Di base gira in WebGL (GPU, risoluzione ridotta): fluido anche su telefono.
 * Se WebGL non c'è, resta il disegno SVG fermo (calcolato una volta sola, costo zero dopo).
 * Con "riduci animazioni" attivo si disegna un solo fotogramma.
 */
export function Liquid({ variant = "backdrop" }: { variant?: Variant }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const box = wrap.current;
    if (!el || !box) return;
    const wide = matchMedia("(min-width: 768px)");
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    let stop: (() => void) | null = null;

    const start = () => {
      stop?.();
      const layout: Layout = variant === "hero" ? (wide.matches ? "hero" : "heroTall") : wide.matches ? "wide" : "tall";
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      stop = startLiquid(el, layout, {
        scale: dpr * (variant === "hero" ? 0.75 : 0.5),
        animate: !still.matches,
        gain: variant === "hero" ? 1 : 0.42,
        follow: variant === "hero",
      });
      box.dataset.gl = stop ? "on" : "off";
    };
    start();
    wide.addEventListener("change", start);
    still.addEventListener("change", start);
    return () => {
      stop?.();
      wide.removeEventListener("change", start);
      still.removeEventListener("change", start);
    };
  }, [variant]);

  const hero = variant === "hero";
  return (
    <div ref={wrap} aria-hidden data-gl="pending" className={`liquid pointer-events-none ${hero ? "liquid-hero" : "liquid-backdrop"}`}>
      <canvas ref={canvas} className="liquid-canvas" />
      {/* Riserva senza WebGL: SVG fermo */}
      <div className="liquid-fallback">
        <div className="hidden size-full md:block">
          <Mercury viewBox="0 0 1000 700" shapes={hero ? "hero" : "wide"} />
        </div>
        <div className="size-full md:hidden">
          <Mercury viewBox="0 0 400 860" shapes={hero ? "heroTall" : "tall"} />
        </div>
      </div>
    </div>
  );
}

function Mercury({ viewBox, shapes }: { viewBox: string; shapes: "hero" | "heroTall" | "wide" | "tall" }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const env = `env${id}`;
  const goo = `goo${id}`;
  const [, , w, h] = viewBox.split(" ").map(Number);

  return (
    <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice">
      <defs>
        {/* "Ambiente" riflesso: fasce d'argento continue, così due gocce che si fondono condividono il riflesso */}
        <linearGradient id={env} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={w} y2={h}>
          <stop offset="0" stopColor="#060606" />
          <stop offset=".18" stopColor="#2c2c2c" />
          <stop offset=".24" stopColor="#8a8a8a" />
          <stop offset=".29" stopColor="#151515" />
          <stop offset=".5" stopColor="#0a0a0a" />
          <stop offset=".62" stopColor="#3a3a3a" />
          <stop offset=".67" stopColor="#b5b5b5" />
          <stop offset=".71" stopColor="#1a1a1a" />
          <stop offset=".88" stopColor="#0c0c0c" />
          <stop offset="1" stopColor="#4a4a4a" />
        </linearGradient>
        <filter id={goo} x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="b" />
          <feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -11" result="goo" />
          <feGaussianBlur in="goo" stdDeviation="7" result="h" />
          <feSpecularLighting in="h" surfaceScale="12" specularConstant="1.6" specularExponent="38" lightingColor="#f4f4f4" result="s1">
            <feDistantLight azimuth="230" elevation="42" />
          </feSpecularLighting>
          <feSpecularLighting in="h" surfaceScale="8" specularConstant=".45" specularExponent="16" lightingColor="#8e96a0" result="s2">
            <feDistantLight azimuth="40" elevation="20" />
          </feSpecularLighting>
          <feComposite in="s1" in2="s2" operator="arithmetic" k2="1" k3="1" result="s" />
          <feComposite in="s" in2="goo" operator="in" result="si" />
          <feComposite in="goo" in2="si" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
        </filter>
      </defs>

      <g filter={`url(#${goo})`} fill={`url(#${env})`}>
        {shapes === "hero" && (
          <>
            <circle className="lq lq-1" cx="500" cy="330" r="150" />
            <ellipse className="lq lq-2" cx="600" cy="400" rx="210" ry="70" />
            <circle className="lq lq-3" cx="380" cy="420" r="80" />
            <circle className="lq lq-4" cx="640" cy="230" r="55" />
            <g className="lq-lash" style={{ transformOrigin: "500px 330px" }}>
              <path d="M500 330 C 420 250, 340 270, 260 200 C 330 290, 410 300, 500 360 Z" />
              <path d="M520 350 C 600 440, 690 450, 760 540 C 700 430, 620 420, 550 330 Z" />
            </g>
            <g className="lq-lash" style={{ transformOrigin: "500px 330px", animationDelay: "-5s" }}>
              <path d="M520 310 C 560 220, 640 180, 700 110 C 640 200, 580 240, 545 330 Z" />
            </g>
          </>
        )}
        {shapes === "heroTall" && (
          <>
            {/* sopra la scheda di login, con i tentacoli che scendono ai lati */}
            <circle className="lq lq-1" cx="210" cy="170" r="95" />
            <ellipse className="lq lq-2" cx="240" cy="235" rx="140" ry="44" />
            <circle className="lq lq-3" cx="110" cy="230" r="52" />
            <circle className="lq lq-4" cx="300" cy="110" r="38" />
            <g className="lq-lash" style={{ transformOrigin: "210px 180px" }}>
              <path d="M150 220 C 60 300, 40 380, 20 470 C 70 390, 110 320, 185 245 Z" />
              <path d="M270 230 C 360 300, 380 380, 395 470 C 350 390, 320 320, 245 255 Z" />
            </g>
            <g className="lq-lash" style={{ transformOrigin: "210px 170px", animationDelay: "-5s" }}>
              <path d="M220 130 C 240 70, 290 40, 330 0 C 300 60, 265 95, 245 150 Z" />
            </g>
            {/* goccia in basso */}
            <circle className="lq lq-2" cx="330" cy="790" r="70" style={{ animationDelay: "-7s" }} />
            <ellipse className="lq lq-3" cx="260" cy="840" rx="120" ry="34" style={{ animationDelay: "-2s" }} />
          </>
        )}
        {shapes === "wide" && (
          <>
            {/* in alto a destra */}
            <circle className="lq lq-1" cx="880" cy="90" r="115" />
            <ellipse className="lq lq-2" cx="960" cy="230" rx="170" ry="50" />
            <circle className="lq lq-3" cx="760" cy="200" r="48" />
            <g className="lq-lash" style={{ transformOrigin: "880px 100px" }}>
              <path d="M880 100 C 800 40, 720 60, 650 20 C 710 80, 790 90, 880 130 Z" />
            </g>
            {/* in basso a sinistra */}
            <ellipse className="lq lq-1" cx="120" cy="640" rx="150" ry="44" style={{ animationDelay: "-6s" }} />
            <circle className="lq lq-2" cx="40" cy="540" r="85" style={{ animationDelay: "-3s" }} />
            <circle className="lq lq-3" cx="250" cy="690" r="50" style={{ animationDelay: "-9s" }} />
            <g className="lq-lash" style={{ transformOrigin: "40px 540px", animationDelay: "-4s" }}>
              <path d="M40 540 C 120 470, 180 490, 250 430 C 190 510, 120 520, 60 570 Z" />
            </g>
          </>
        )}
        {shapes === "tall" && (
          <>
            {/* in alto a destra, dietro l'intestazione */}
            <circle className="lq lq-1" cx="380" cy="40" r="90" />
            <ellipse className="lq lq-2" cx="330" cy="120" rx="110" ry="34" />
            <g className="lq-lash" style={{ transformOrigin: "380px 50px" }}>
              <path d="M380 50 C 320 20, 260 40, 200 10 C 250 60, 310 70, 380 85 Z" />
            </g>
            {/* in basso a sinistra */}
            <circle className="lq lq-2" cx="10" cy="800" r="95" style={{ animationDelay: "-3s" }} />
            <ellipse className="lq lq-1" cx="90" cy="860" rx="130" ry="40" style={{ animationDelay: "-6s" }} />
            <g className="lq-lash" style={{ transformOrigin: "20px 800px", animationDelay: "-4s" }}>
              <path d="M20 800 C 90 740, 150 750, 210 690 C 160 770, 100 780, 40 830 Z" />
            </g>
          </>
        )}
      </g>
    </svg>
  );
}
