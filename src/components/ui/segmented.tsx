"use client";

import { cn } from "@/lib/cn";

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-lg bg-surface-2 p-0.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors",
              active ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-ink-2 hover:text-ink",
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn("tabular-nums text-xs", active ? "text-ink-3" : "text-ink-3/80")}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
