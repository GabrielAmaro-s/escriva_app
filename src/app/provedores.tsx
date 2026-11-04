"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { ProvedorMenuDeContexto } from "@/components/ui/menu-contexto";
import { ProvedorAvisos } from "@/components/ui/aviso";

export function Provedores({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <ProvedorAvisos>
        <ProvedorMenuDeContexto>{children}</ProvedorMenuDeContexto>
      </ProvedorAvisos>
    </ThemeProvider>
  );
}
