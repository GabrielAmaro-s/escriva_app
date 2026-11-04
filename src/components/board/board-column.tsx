"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { useRef, useState } from "react";
import type { BoardColumn, ColumnKind, Label, Task } from "@/domain/types";
import { cn } from "@/lib/cn";
import { TaskCard } from "./task-card";

const KIND_MARK: Record<ColumnKind, string> = {
  todo: "border border-ink-3 bg-transparent",
  doing: "bg-tone",
  waiting: "border border-tone bg-tone-soft",
  done: "bg-ink-3",
};

function SortableTask({
  task,
  labelsById,
  onOpen,
  onToggleComplete,
}: {
  task: Task;
  labelsById: Map<string, Label>;
  onOpen: () => void;
  onToggleComplete: () => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <li>
      <TaskCard
        ref={setNodeRef}
        task={task}
        labelsById={labelsById}
        dragging={isDragging}
        onToggleComplete={onToggleComplete}
        style={{ transform: CSS.Translate.toString(transform), transition }}
        {...attributes}
        {...listeners}
        aria-roledescription="tarefa arrastável"
        onClick={onOpen}
        onKeyDown={(e) => {
          // Enter abre a tarefa; Espaço pega o cartão para mover com as setas.
          if (e.key === "Enter") return onOpen();
          listeners?.onKeyDown?.(e);
        }}
      />
    </li>
  );
}

export function BoardColumnView({
  column,
  tasks,
  labelsById,
  onOpenTask,
  onToggleComplete,
  onAddTask,
}: {
  column: BoardColumn;
  tasks: Task[];
  labelsById: Map<string, Label>;
  onOpenTask: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onAddTask: (title: string) => Promise<unknown>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [adding, setAdding] = useState(false);

  return (
    <section
      aria-label={column.title}
      className="flex max-h-full w-[82vw] shrink-0 snap-start flex-col rounded-xl bg-ink/[0.04] sm:w-auto sm:min-w-[15.5rem] sm:max-w-[22rem] sm:flex-1 dark:bg-white/[0.03]"
    >
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <span className={cn("size-2.5 rounded-full", KIND_MARK[column.kind])} aria-hidden />
        <h2 className="text-sm font-semibold">{column.title}</h2>
        <span className="text-xs tabular-nums text-ink-3">{tasks.length}</span>
        <button
          type="button"
          onClick={() => setAdding(true)}
          aria-label={`Adicionar tarefa em ${column.title}`}
          className="ml-auto grid size-7 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface hover:text-ink"
        >
          <Plus className="size-4" />
        </button>
      </header>

      <div ref={setNodeRef} className={cn("min-h-16 flex-1 overflow-y-auto px-2 pb-2 transition-colors", isOver && tasks.length === 0 && "rounded-lg bg-tone-soft")}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-1.5">
            {tasks.map((t) => (
              <SortableTask
                key={t.id}
                task={t}
                labelsById={labelsById}
                onOpen={() => onOpenTask(t.id)}
                onToggleComplete={() => onToggleComplete(t.id)}
              />
            ))}
          </ul>
        </SortableContext>

        {adding ? (
          <Composer onAdd={onAddTask} onClose={() => setAdding(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-1.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-3 transition-colors hover:bg-surface hover:text-ink"
          >
            <Plus className="size-4" />
            Adicionar tarefa
          </button>
        )}
      </div>
    </section>
  );
}

/** Criação rápida: Enter adiciona e mantém o campo aberto para a próxima. */
function Composer({ onAdd, onClose }: { onAdd: (title: string) => Promise<unknown>; onClose: () => void }) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = async () => {
    if (!value.trim()) return onClose();
    const title = value;
    setValue("");
    await onAdd(title);
    ref.current?.focus();
  };

  return (
    <div className="mt-1.5 rounded-lg border border-accent bg-surface p-2">
      <textarea
        ref={ref}
        autoFocus
        rows={2}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") onClose();
        }}
        onBlur={() => !value.trim() && onClose()}
        placeholder="O que precisa ser feito?"
        aria-label="Título da nova tarefa"
        className="block w-full resize-none bg-transparent text-sm placeholder:text-ink-3 focus:outline-none"
      />
      <div className="mt-1 flex items-center justify-between text-xs text-ink-3">
        <span>Enter para adicionar</span>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={submit} className="rounded-md bg-accent px-2 py-1 font-medium text-accent-ink">
          Adicionar
        </button>
      </div>
    </div>
  );
}
