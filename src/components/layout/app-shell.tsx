"use client";

import { Menu as MenuIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Logo, Sidebar } from "./sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  useEffect(() => setDrawer(false), [pathname]);

  return (
    <div className="flex min-h-dvh">
      {/* Desktop: menu lateral fixo e discreto */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-line bg-bg md:block">
        <Suspense>
          <Sidebar />
        </Suspense>
      </aside>

      {/* Celular: barra superior + gaveta */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/30 transition-opacity md:hidden",
          drawer ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setDrawer(false)}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 border-r border-line bg-bg transition-transform duration-200 md:hidden",
          drawer ? "translate-x-0" : "-translate-x-full",
        )}
        aria-hidden={!drawer}
        inert={!drawer}
      >
        <Suspense>
          <Sidebar onNavigate={() => setDrawer(false)} />
        </Suspense>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-line bg-bg/90 px-3 backdrop-blur md:hidden">
          <IconButton label="Abrir menu" onClick={() => setDrawer(true)}>
            <MenuIcon />
          </IconButton>
          <Logo />
        </header>
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
