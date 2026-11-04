"use client";

import { Check } from "lucide-react";
import { COLOR_KEYS, COLOR_NAME } from "@/domain/project";
import type { ColorKey } from "@/domain/types";
import { cn } from "@/lib/cn";

export function ColorPicker({
  value,
  onChange,
  size = "md",
}: {
  value: ColorKey;
  onChange: (c: ColorKey) => void;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label="Cor" className="flex flex-wrap gap-1.5">
      {COLOR_KEYS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={COLOR_NAME[c]}
          title={COLOR_NAME[c]}
          data-color={c}
          onClick={() => onChange(c)}
          className={cn(
            "grid place-items-center rounded-full bg-tone text-white ring-offset-2 ring-offset-surface transition-transform hover:scale-110 dark:text-black/70",
            size === "md" ? "size-7" : "size-5",
            value === c && "ring-2 ring-tone",
          )}
        >
          {value === c && <Check className={size === "md" ? "size-3.5" : "size-3"} strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}
