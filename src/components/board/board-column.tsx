"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PlusIcon } from "@phosphor-icons/react";
import { useState } from "react";
import type { BoardColumn, ColumnKind, Label, Task } from "@/domain/types";
import { cn } from "@/lib/cn";
import { TaskCard } from "./task-card";

const COLUMN_BG: Record<ColumnKind, string> = {
  todo: "bg-col-todo",
  doing: "bg-col-doing",
  waiting: "bg-col-waiting",
  done: "bg-col-done",
};

function SortableTask({
  task,
  labelsById,
  onOpen,
  onMenu,
}: {
  task: Task;
  labelsById: Map<string, Label>;
  onOpen: () => void;
  onMenu: (e: React.MouseEvent) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <li>
      <TaskCard
        ref={setNodeRef}
        task={task}
        labelsById={labelsById}
        dragging={isDragging}
        onMenu={onMenu}
        style={{ transform: CSS.Translate.toString(transform), transition }}
        {...attributes}
        {...listeners}
        aria-roledescription="tarefa arrastável"
        onClick={onOpen}
        onContextMenu={onMenu}
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
  dragging,
  adding,
  onStartAdding,
  onStopAdding,
  onOpenTask,
  onTaskMenu,
  onAddTask,
}: {
  column: BoardColumn;
  tasks: Task[];
  labelsById: Map<string, Label>;
  dragging: boolean;
  adding: boolean;
  onStartAdding: () => void;
  onStopAdding: () => void;
  onOpenTask: (id: string) => void;
  onTaskMenu: (task: Task, e: React.MouseEvent) => void;
  onAddTask: (title: string) => Promise<unknown>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      aria-label={column.title}
      className={cn(
        "flex min-w-[262px] flex-[1_1_0] snap-start flex-col gap-2 rounded-[14px] px-2.5 py-3 outline-2 -outline-offset-2 outline-dashed transition-[outline-color] duration-150 max-nav:min-w-[82vw]",
        COLUMN_BG[column.kind],
        dragging && isOver ? "outline-primary-line" : "outline-transparent",
      )}
    >
      <div className="flex items-center gap-2 px-1">
        <h2 className="text-[13.5px] font-semibold">{column.title}</h2>
        <span className="text-xs font-medium text-ink2">{tasks.length}</span>
      </div>

      <button
        type="button"
        onClick={onStartAdding}
        className="flex h-8 items-center gap-2 rounded-lg border-0 bg-transparent px-1.5 text-left text-[12.5px] text-ink2 hover:bg-surface hover:text-ink"
      >
        <PlusIcon size={14} weight="bold" />
        Adicionar tarefa
      </button>

      {adding && <Composer onAdd={onAddTask} onClose={onStopAdding} />}

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2">
          {tasks.map((t) => (
            <SortableTask key={t.id} task={t} labelsById={labelsById} onOpen={() => onOpenTask(t.id)} onMenu={(e) => onTaskMenu(t, e)} />
          ))}
        </ul>
      </SortableContext>

      {tasks.length === 0 && !adding && (
        <div className="mt-0.5 rounded-[10px] border border-dashed border-line2 px-3 py-[22px] text-center text-xs leading-normal text-ink3">
          {column.kind === "done" ? "Conclua tarefas para vê-las aqui" : "Solte uma tarefa aqui"}
        </div>
      )}
    </section>
  );
}

/** Criação rápida: Enter adiciona e o campo continua aberto para a próxima. */
function Composer({ onAdd, onClose }: { onAdd: (title: string) => Promise<unknown>; onClose: () => void }) {
  const [value, setValue] = useState("");

  const commit = async () => {
    const title = value.trim();
    if (!title) return onClose();
    setValue("");
    await onAdd(title);
  };

  return (
    <div className="animate-pop rounded-[10px] border border-primary bg-surface p-2 shadow-focus">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
        onBlur={() => !value.trim() && onClose()}
        placeholder="Título da tarefa…"
        aria-label="Título da nova tarefa"
        className="h-[26px] w-full border-0 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink3"
      />
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[11px] text-ink3">Enter adiciona, Esc cancela</span>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={commit}
          className="h-[26px] rounded-[7px] border-0 bg-primary px-2.5 text-xs font-semibold text-on-primary"
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}
