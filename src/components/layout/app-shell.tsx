"use client";

import { ListIcon } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Logo, Sidebar } from "./sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex h-dvh overflow-hidden bg-bg text-sm text-ink">
      {open && <div className="fixed inset-0 z-40 animate-fade bg-scrim nav:hidden" onClick={() => setOpen(false)} aria-hidden />}

      {/* Até 820px o menu vira gaveta; acima disso fica fixo. */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[232px] shrink-0 border-r border-line bg-surface transition-transform duration-[250ms] ease-out nav:relative nav:translate-x-0",
          open ? "translate-x-0" : "-translate-x-[105%]",
        )}
      >
        <Sidebar onNavigate={() => setOpen(false)} />
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="sticky top-0 z-30 flex h-[54px] shrink-0 items-center gap-3 border-b border-line bg-surface px-4 nav:hidden">
          <button
            type="button"
            aria-label="Abrir menu"
            onClick={() => setOpen(true)}
            className="grid size-9 place-items-center rounded-[9px] border border-line bg-surface text-ink"
          >
            <ListIcon size={18} />
          </button>
          <Logo compact />
        </div>
        {children}
      </main>
    </div>
  );
}
