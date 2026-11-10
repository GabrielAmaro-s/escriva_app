"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { classes } from "@/lib/classes";

/**
 * Janela sobre a tela, alinhada ao topo como no design.
 * Esc ou clique fora fecham; o foco entra na janela e volta ao fechar.
 */
export function Janela({
  aberta,
  aoFechar,
  rotulo,
  children,
  className,
}: {
  aberta: boolean;
  aoFechar: () => void;
  rotulo: string;
  children: ReactNode;
  className?: string;
}) {
  const painel = useRef<HTMLDivElement>(null);
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;

  useEffect(() => {
    if (!aberta) return;
    const anterior = document.activeElement as HTMLElement | null;
    const el = painel.current;
    if (el && !el.contains(document.activeElement)) {
      (el.querySelector<HTMLElement>("[autofocus], [data-autofocus]") ?? el).focus({ preventScroll: true });
    }
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        fechar.current();
      }
      if (e.key === "Tab" && el) {
        const itens = [...el.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex='-1'])")];
        if (!itens.length) return;
        const primeiro = itens[0];
        const ultimo = itens[itens.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    };
    document.addEventListener("keydown", aoTeclar);
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = rolagem;
      anterior?.focus?.();
    };
  }, [aberta]);

  if (!aberta || typeof document === "undefined") return null;

  // Vai direto para o <body>: assim cobre o menu lateral e não herda animações da página.
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex animate-fade items-start justify-center overflow-y-auto bg-scrim px-3 py-4 nav:px-5 nav:py-[6vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-label={rotulo}
        tabIndex={-1}
        className={classes("w-full animate-pop rounded-[18px] border border-line bg-surface-raised shadow-flutuante outline-none", className)}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
