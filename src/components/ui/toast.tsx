"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type Toast = { id: number; text: string; tone: "info" | "error"; action?: { label: string; run: () => void } };

const ToastContext = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

/** Um aviso por vez, na parte de baixo da tela, como no design. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = useCallback((t: Omit<Toast, "id">) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ ...t, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), t.action ? 5000 : 3600);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      {toast && (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[90] flex max-w-[calc(100vw-32px)] -translate-x-1/2 animate-pop items-center gap-3.5 rounded-[11px] bg-ink py-2.5 pl-4 pr-3.5 text-[13px] text-surface shadow-modal"
        >
          {toast.tone === "error" && <span className="size-1.5 shrink-0 rounded-full bg-s-red" aria-hidden />}
          {toast.text}
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.run();
                setToast(null);
              }}
              className="border-0 bg-transparent p-0 text-[13px] font-semibold text-primary-line"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
}
