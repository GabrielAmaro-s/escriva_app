"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Toast = { id: number; text: string; tone: "info" | "error"; action?: { label: string; run: () => void } };

const ToastContext = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), t.action ? 6000 : 4000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex animate-[pop-in_160ms_ease-out] items-center gap-3 rounded-xl bg-ink px-4 py-2.5 text-sm text-bg shadow-lift"
          >
            {t.tone === "error" && <span className="size-1.5 rounded-full bg-danger" aria-hidden />}
            <span>{t.text}</span>
            {t.action && (
              <button
                type="button"
                className="font-semibold underline-offset-2 hover:underline"
                onClick={() => {
                  t.action?.run();
                  setToasts((list) => list.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
