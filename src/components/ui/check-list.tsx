"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { newId } from "@/domain/board";
import { cn } from "@/lib/cn";

export interface CheckItem {
  id: string;
  text: string;
  done: boolean;
}

/** Lista marcável e editável, usada no checklist da tarefa e nas entregas da campanha. */
export function CheckList({
  items,
  onChange,
  placeholder,
  addLabel,
}: {
  items: CheckItem[];
  onChange: (items: CheckItem[]) => void;
  placeholder: string;
  addLabel: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, { id: newId(), text, done: false }]);
    setDraft("");
  };

  const update = (id: string, patch: Partial<CheckItem>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  return (
    <div className="flex flex-col">
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.id} className="group flex items-center gap-2.5 rounded-lg py-1 pr-1">
            <input
              type="checkbox"
              checked={item.done}
              onChange={(e) => update(item.id, { done: e.target.checked })}
              aria-label={item.text}
              className="size-4 shrink-0 cursor-pointer rounded accent-[var(--accent)]"
            />
            <input
              value={item.text}
              onChange={(e) => update(item.id, { text: e.target.value })}
              onBlur={(e) => !e.target.value.trim() && onChange(items.filter((i) => i.id !== item.id))}
              className={cn(
                "min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-base focus:bg-surface-2 focus:outline-none",
                item.done && "text-ink-3 line-through decoration-ink-3/60",
              )}
            />
            <button
              type="button"
              aria-label={`Remover ${item.text}`}
              onClick={() => onChange(items.filter((i) => i.id !== item.id))}
              className="grid size-6 place-items-center rounded text-ink-3 opacity-0 transition-opacity hover:text-ink focus:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2.5 py-1">
        <Plus className="size-4 shrink-0 text-ink-3" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder={placeholder}
          aria-label={addLabel}
          className="min-w-0 flex-1 bg-transparent px-1 py-0.5 text-base placeholder:text-ink-3 focus:outline-none"
        />
      </div>
    </div>
  );
}
