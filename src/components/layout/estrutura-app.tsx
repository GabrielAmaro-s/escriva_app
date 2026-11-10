"use client";

import { ListIcon } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { classes } from "@/lib/classes";
import { Logotipo, MenuLateral } from "./menu-lateral";

export function EstruturaApp({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const caminho = usePathname();
  useEffect(() => setAberto(false), [caminho]);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  return (
    <div className="flex h-dvh overflow-hidden bg-surface text-sm text-ink">
      {aberto && <div className="fixed inset-0 z-40 animate-fade bg-scrim nav:hidden" onClick={() => setAberto(false)} aria-hidden />}

      {/* Até 820px o menu vira gaveta; acima disso fica fixo. */}
      <aside
        className={classes(
          "fixed inset-y-0 left-0 z-50 w-[232px] shrink-0 border-r border-line bg-surface-raised transition-transform duration-[250ms] ease-out nav:relative nav:translate-x-0",
          aberto ? "translate-x-0" : "-translate-x-[105%]",
        )}
      >
        <MenuLateral aoNavegar={() => setAberto(false)} />
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="sticky top-0 z-30 flex h-[54px] shrink-0 items-center gap-3 border-b border-line bg-surface-raised px-4 nav:hidden">
          <button
            type="button"
            aria-label="Abrir menu"
            onClick={() => setAberto(true)}
            className="grid size-9 place-items-center rounded-[9px] border border-line bg-surface-raised text-ink"
          >
            <ListIcon size={18} />
          </button>
          <Logotipo compacto />
        </div>
        {children}
      </main>
    </div>
  );
}
