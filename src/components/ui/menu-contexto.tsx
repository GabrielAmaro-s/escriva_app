"use client";

import type { Icon } from "@phosphor-icons/react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { classes } from "@/lib/classes";

export interface ItemMenu {
  rotulo: string;
  icone: Icon;
  aoSelecionar: () => void;
  perigo?: boolean;
}

type Abrir = (e: React.MouseEvent | React.KeyboardEvent, itens: ItemMenu[]) => void;

const ContextoMenu = createContext<Abrir>(() => {});

/** Abre o menu de ações perto do clique (botão "..." ou botão direito). */
export function useMenuDeContexto() {
  return useContext(ContextoMenu);
}

export function ProvedorMenuDeContexto({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<{ x: number; y: number; itens: ItemMenu[] } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const devolverFoco = useRef<HTMLElement | null>(null);

  const abrir = useCallback<Abrir>((e, itens) => {
    e.preventDefault();
    e.stopPropagation();
    devolverFoco.current = e.currentTarget as HTMLElement;
    let x: number;
    let y: number;
    if ("clientX" in e && e.clientX) {
      x = e.clientX;
      y = e.clientY;
    } else {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      x = r.left;
      y = r.bottom + 4;
    }
    x = Math.max(8, Math.min(x, window.innerWidth - 208));
    y = Math.max(8, Math.min(y, window.innerHeight - itens.length * 34 - 20));
    setMenu({ x, y, itens });
  }, []);

  const fechar = useCallback(() => {
    setMenu(null);
    devolverFoco.current?.focus();
  }, []);

  useEffect(() => {
    if (!menu) return;
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        fechar();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const botoes = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
        const i = botoes.indexOf(document.activeElement as HTMLButtonElement);
        const proximo = e.key === "ArrowDown" ? (i + 1) % botoes.length : (i - 1 + botoes.length) % botoes.length;
        botoes[proximo]?.focus();
      }
    };
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [menu, fechar]);

  return (
    <ContextoMenu.Provider value={abrir}>
      {children}
      {menu && (
        <div
          className="fixed inset-0 z-[80]"
          onClick={fechar}
          onContextMenu={(e) => {
            e.preventDefault();
            fechar();
          }}
        >
          <div
            ref={ref}
            role="menu"
            onClick={(e) => e.stopPropagation()}
            style={{ left: menu.x, top: menu.y }}
            className="fixed w-[196px] animate-pop rounded-xl border border-line bg-surface p-[5px] shadow-pop"
          >
            {menu.itens.map(({ rotulo, icone: Icone, aoSelecionar, perigo }) => (
              <button
                key={rotulo}
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  aoSelecionar();
                }}
                className={classes(
                  "flex min-h-[34px] w-full items-center gap-2.5 rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-left text-[13px] focus-visible:outline-none",
                  perigo ? "text-s-red hover:bg-t-red-bg focus-visible:bg-t-red-bg" : "text-ink hover:bg-hover focus-visible:bg-hover",
                )}
              >
                <Icone size={15} className="shrink-0" />
                {rotulo}
              </button>
            ))}
          </div>
        </div>
      )}
    </ContextoMenu.Provider>
  );
}
