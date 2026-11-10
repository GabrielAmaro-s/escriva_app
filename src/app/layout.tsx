import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { scriptInicialCorDestaque } from "@/lib/aparencia";
import { Provedores } from "./provedores";

// Tipografia da marca (docs/marca/tokens.json): Bricolage Grotesque nos títulos e no logotipo,
// IBM Plex Sans no texto e IBM Plex Mono no que se confere dígito a dígito.
const fonteDisplay = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600"], variable: "--fonte-display", display: "swap" });
const fonteSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--fonte-sans", display: "swap" });
const fonteMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--fonte-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Escriva",
  description: "A assessora que não deixa o advogado autônomo perder prazo: calcula o vencimento mostrando como chegou na data e lembra antes de vencer.",
  applicationName: "Escriva",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    // surface do tokens.json
    { media: "(prefers-color-scheme: light)", color: "#F5F6F3" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1514" },
  ],
};

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${fonteDisplay.variable} ${fonteSans.variable} ${fonteMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptInicialCorDestaque }} />
      </head>
      <body>
        <Provedores>{children}</Provedores>
      </body>
    </html>
  );
}
