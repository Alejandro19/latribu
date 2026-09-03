import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Cormorant_Garamond, Jost, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import Providers from "./providers";
import ThemeRoot from "../components/layout/ThemeRoot";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

// Identidad Ephirox (reskin en curso, ver plan de reskin) — conviven con
// Fraunces/Inter hasta que cada pantalla migre; no reemplazan las fuentes
// legacy todavía.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-jost",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EPHIROX",
  description: "Redefining limits.",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0A08",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${fraunces.variable} ${inter.variable} ${cormorant.variable} ${jost.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Acelera la conexión TLS antes de que los scripts la necesiten */}
        <link rel="preconnect" href="https://accounts.google.com" />
        <link rel="preconnect" href="https://appleid.cdn-apple.com" />
      </head>
      <body className={inter.className}>
        {/* beforeInteractive: Next.js inyecta y ejecuta estos scripts antes de
            que la página se vuelva interactiva, en vez de esperar a que un
            <script async defer> del <head> cargue por su cuenta — así los
            botones de Google/Apple están listos casi de inmediato en
            /login, sin el delay de varios segundos que había antes. */}
        <Script src="https://accounts.google.com/gsi/client" strategy="beforeInteractive" />
        <Script src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js" strategy="beforeInteractive" />
        {/* Contenedor raíz del sistema de temas Ephirox — data-theme vive acá,
            no en <body>, para que toda la app (incluida la barra superior)
            herede los tokens por cascada. Resolución dinámica por pantalla y
            preferencia del usuario en ThemeRoot (lib/theme.ts). */}
        <ThemeRoot>
          <Providers>{children}</Providers>
        </ThemeRoot>
      </body>
    </html>
  );
}
