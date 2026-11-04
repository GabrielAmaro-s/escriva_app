"use client";

import type { Icon } from "@phosphor-icons/react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface MenuItem {
  label: string;
  icon: Icon;
  onSelect: () => void;
  danger?: boolean;
}

type Open = (e: React.MouseEvent | React.KeyboardEvent, items: MenuItem[]) => void;

const MenuContext = createContext<Open>(() => {});

/** Abre o menu de ações perto do clique (botão "..." ou botão direito). */
export function useContextMenu() {
  return useContext(MenuContext);
}

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const open = useCallback<Open>((e, items) => {
    e.preventDefault();
    e.stopPropagation();
    returnFocus.current = e.currentTarget as HTMLElement;
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
    y = Math.max(8, Math.min(y, window.innerHeight - items.length * 34 - 20));
    setMenu({ x, y, items });
  }, []);

  const close = useCallback(() => {
    setMenu(null);
    returnFocus.current?.focus();
  }, []);

  useEffect(() => {
    if (!menu) return;
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = e.key === "ArrowDown" ? (i + 1) % buttons.length : (i - 1 + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [menu, close]);

  return (
    <MenuContext.Provider value={open}>
      {children}
      {menu && (
        <div
          className="fixed inset-0 z-[80]"
          onClick={close}
          onContextMenu={(e) => {
            e.preventDefault();
            close();
          }}
        >
          <div
            ref={ref}
            role="menu"
            onClick={(e) => e.stopPropagation()}
            style={{ left: menu.x, top: menu.y }}
            className="fixed w-[196px] animate-pop rounded-xl border border-line bg-surface p-[5px] shadow-pop"
          >
            {menu.items.map(({ label, icon: Icon, onSelect, danger }) => (
              <button
                key={label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  onSelect();
                }}
                className={cn(
                  "flex min-h-[34px] w-full items-center gap-2.5 rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-left text-[13px] focus-visible:outline-none",
                  danger ? "text-s-red hover:bg-t-red-bg focus-visible:bg-t-red-bg" : "text-ink hover:bg-hover focus-visible:bg-hover",
                )}
              >
                <Icon size={15} className="shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </MenuContext.Provider>
  );
}
