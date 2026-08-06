import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import Script from "next/script";
import Providers from "./providers";
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

export const metadata: Metadata = {
  title: "LA TRIBU",
  description: "Comunidad de bienestar y alto rendimiento.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${fraunces.variable} ${inter.variable}`} suppressHydrationWarning>
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
