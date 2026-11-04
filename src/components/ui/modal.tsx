"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconButton } from "./button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** "center" para formulários, "sheet" para painel lateral (vira folha inferior no celular). */
  variant?: "center" | "sheet";
  children: ReactNode;
  footer?: ReactNode;
  headerExtra?: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, variant = "center", children, footer, headerExtra, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
      className={cn(
        "m-0 max-h-none max-w-none border-0 bg-transparent p-0 backdrop:bg-transparent",
        variant === "center" ? "pop" : "slide",
        variant === "center"
          ? "inset-0 m-auto h-fit w-[min(34rem,calc(100vw-2rem))]"
          : "fixed inset-x-0 bottom-0 top-auto h-[92dvh] w-full sm:inset-y-0 sm:left-auto sm:right-0 sm:h-dvh sm:w-[min(32rem,100vw)]",
      )}
    >
      {open && (
        <div
          className={cn(
            "flex flex-col bg-surface text-ink shadow-lift",
            variant === "center"
              ? "max-h-[calc(100dvh-2rem)] rounded-2xl border border-line"
              : "h-full rounded-t-2xl border-line sm:rounded-none sm:border-l",
            className,
          )}
        >
          <header className="flex items-center gap-2 px-5 pb-2 pt-4">
            <h2 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight">{title}</h2>
            {headerExtra}
            <IconButton label="Fechar" onClick={onClose}>
              <X />
            </IconButton>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-1">{children}</div>
          {footer && <footer className="flex items-center gap-2 border-t border-line px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
