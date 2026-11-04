import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Chat",
  description: "Chat privata con Berlusc, Syrup e Aurelio",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
  themeColor: "#16161a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
      <head>
        {/* Su *.netlify.app Netlify aggiunge il badge "Powered by Netlify" in basso a destra:
            lo segnamo prima del primo paint così la barra di scrittura gli lascia spazio. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if(/\\.netlify\\.app$/.test(location.hostname))document.documentElement.dataset.nfBadge=""`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
