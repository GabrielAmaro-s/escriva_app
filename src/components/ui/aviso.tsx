"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type Aviso = { id: number; texto: string; tom: "info" | "erro"; acao?: { rotulo: string; executar: () => void } };

const ContextoAviso = createContext<(a: Omit<Aviso, "id">) => void>(() => {});

export function useAviso() {
  return useContext(ContextoAviso);
}

/** Um aviso por vez, na parte de baixo da tela, como no design. */
export function ProvedorAvisos({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mostrar = useCallback((a: Omit<Aviso, "id">) => {
    if (temporizador.current) clearTimeout(temporizador.current);
    setAviso({ ...a, id: Date.now() });
    temporizador.current = setTimeout(() => setAviso(null), a.acao ? 5000 : 3600);
  }, []);

  return (
    <ContextoAviso.Provider value={mostrar}>
      {children}
      {aviso && (
        <div
          key={aviso.id}
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[90] flex max-w-[calc(100vw-32px)] -translate-x-1/2 animate-pop items-center gap-3.5 rounded-[11px] bg-ink py-2.5 pl-4 pr-3.5 text-[13px] text-surface-raised shadow-flutuante"
        >
          {aviso.tom === "erro" && <span className="size-1.5 shrink-0 rounded-full bg-fatal" aria-hidden />}
          {aviso.texto}
          {aviso.acao && (
            <button
              type="button"
              onClick={() => {
                aviso.acao?.executar();
                setAviso(null);
              }}
              className="border-0 bg-transparent p-0 text-[13px] font-semibold text-primary-line"
            >
              {aviso.acao.rotulo}
            </button>
          )}
        </div>
      )}
    </ContextoAviso.Provider>
  );
}
