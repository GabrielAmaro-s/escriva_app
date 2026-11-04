"use client";

import { Check, Plus, Tag, X } from "lucide-react";
import { useState } from "react";
import { ColorPicker } from "@/components/ui/color-picker";
import type { ColorKey, Label } from "@/domain/types";
import { cn } from "@/lib/cn";

/** Etiquetas da tarefa: mostra as aplicadas e abre um painel para escolher ou criar. */
export function LabelPicker({
  labels,
  selected,
  onChange,
  onCreate,
  onDelete,
}: {
  labels: Label[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onCreate: (name: string, color: ColorKey) => Promise<Label | null>;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<ColorKey>("lavanda");
  const applied = labels.filter((l) => selected.includes(l.id));

  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const create = async () => {
    if (!name.trim()) return;
    const label = await onCreate(name, color);
    if (label) {
      onChange([...selected, label.id]);
      setName("");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {applied.map((l) => (
          <span key={l.id} data-color={l.color} className="rounded-md bg-tone-soft px-2 py-0.5 text-sm font-medium text-tone">
            {l.name}
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm text-ink-3 hover:bg-surface-2 hover:text-ink"
        >
          <Tag className="size-3.5" />
          {applied.length ? "Alterar" : "Adicionar"}
        </button>
      </div>

      {open && (
        <div className="animate-[pop-in_140ms_ease-out] rounded-xl border border-line p-2">
          {labels.length > 0 && (
            <ul className="mb-2 flex flex-col">
              {labels.map((l) => {
                const on = selected.includes(l.id);
                return (
                  <li key={l.id} className="group flex items-center">
                    <button
                      type="button"
                      onClick={() => toggle(l.id)}
                      aria-pressed={on}
                      data-color={l.color}
                      className="flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                    >
                      <span className={cn("grid size-4 place-items-center rounded border", on ? "border-tone bg-tone text-surface" : "border-line-strong")}>
                        {on && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      <span className="size-2 rounded-full bg-tone" aria-hidden />
                      {l.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(l.id)}
                      aria-label={`Excluir etiqueta ${l.name}`}
                      title="Excluir etiqueta do projeto"
                      className="grid size-7 place-items-center rounded-md text-ink-3 opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-col gap-2 rounded-lg bg-surface-2/60 p-2">
            <div className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    create();
                  }
                }}
                maxLength={40}
                placeholder="Nova etiqueta"
                aria-label="Nome da nova etiqueta"
                className="h-8 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-sm focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={create}
                disabled={!name.trim()}
                className="flex h-8 items-center gap-1 rounded-md bg-accent px-2.5 text-sm font-medium text-accent-ink disabled:opacity-40"
              >
                <Plus className="size-3.5" />
                Criar
              </button>
            </div>
            <ColorPicker size="sm" value={color} onChange={setColor} />
          </div>
        </div>
      )}
    </div>
  );
}
