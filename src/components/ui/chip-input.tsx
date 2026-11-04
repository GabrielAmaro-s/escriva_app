"use client";

import { X } from "lucide-react";
import { useState } from "react";

/** Campo de chips: Enter ou vírgula adiciona, Backspace no campo vazio remove o último. */
export function ChipInput({
  value,
  onChange,
  placeholder,
  suggestions = [],
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const v = raw.trim();
    if (!v || value.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    onChange([...value, v]);
  };

  const unused = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5 focus-within:border-accent">
        {value.map((v) => (
          <span key={v} className="flex items-center gap-1 rounded-md bg-surface-2 py-0.5 pl-2 pr-1 text-sm">
            {v}
            <button
              type="button"
              aria-label={`Remover ${v}`}
              onClick={() => onChange(value.filter((x) => x !== v))}
              className="grid size-4 place-items-center rounded text-ink-3 hover:text-ink"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
              setDraft("");
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => {
            add(draft);
            setDraft("");
          }}
          placeholder={value.length ? "" : placeholder}
          className="min-w-24 flex-1 bg-transparent px-1 text-base placeholder:text-ink-3 focus:outline-none"
        />
      </div>
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {unused.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-md border border-dashed border-line-strong px-2 py-0.5 text-xs text-ink-2 hover:border-accent hover:text-ink"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
