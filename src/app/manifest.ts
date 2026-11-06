import type { MetadataRoute } from "next";

// Installabile sul telefono: icona sulla home, a schermo intero, nero.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hub",
    short_name: "Hub",
    description: "Il tuo hub personale: agenti, progetti, dropshipping, media e modelli AI.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#030303",
    theme_color: "#030303",
    lang: "it",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
