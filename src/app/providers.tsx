"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { ContextMenuProvider } from "@/components/ui/context-menu";
import { ToastProvider } from "@/components/ui/toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <ToastProvider>
        <ContextMenuProvider>{children}</ContextMenuProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
