"use client";

import { AlignLeft, ArrowUp, CalendarDays, Check, ListChecks, Link2 } from "lucide-react";
import { forwardRef, type HTMLAttributes } from "react";
import { PRIORITY_LABEL, checklistProgress, dueState, formatDate } from "@/domain/board";
import type { Label, Task } from "@/domain/types";
import { cn } from "@/lib/cn";

const DUE_STYLE = {
  overdue: "text-danger",
  today: "text-tone font-medium",
  soon: "text-ink-2",
  later: "text-ink-3",
};

interface TaskCardProps extends HTMLAttributes<HTMLDivElement> {
  task: Task;
  labelsById: Map<string, Label>;
  onToggleComplete?: () => void;
  dragging?: boolean;
  overlay?: boolean;
}

export const TaskCard = forwardRef<HTMLDivElement, TaskCardProps>(function TaskCard(
  { task, labelsById, onToggleComplete, dragging, overlay, className, ...props },
  ref,
) {
  const labels = task.labelIds.map((id) => labelsById.get(id)).filter((l): l is Label => Boolean(l));
  const check = checklistProgress(task);
  const due = task.dueOn && !task.completed ? dueState(task.dueOn) : null;
  const flagged = (task.priority === "high" || task.priority === "urgent") && !task.completed;
  const hasMeta = flagged || task.dueOn || check.total > 0 || task.links.length > 0 || task.description;

  return (
    <div
      ref={ref}
      className={cn(
        "group/card relative cursor-grab touch-manipulation rounded-lg border border-line bg-surface px-3 py-2.5 text-left transition-[border-color,box-shadow,opacity] duration-150 hover:border-line-strong active:cursor-grabbing",
        dragging && "opacity-35",
        overlay && "rotate-[1.5deg] cursor-grabbing border-line-strong shadow-lift",
        className,
      )}
      {...props}
    >
      {labels.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {labels.map((l) => (
            <span key={l.id} data-color={l.color} className="rounded bg-tone-soft px-1.5 py-px text-[0.6875rem] font-medium leading-4 text-tone">
              {l.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label={task.completed ? "Reabrir tarefa" : "Concluir tarefa"}
          aria-pressed={task.completed}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete?.();
          }}
          className={cn(
            "mt-[3px] grid size-4 shrink-0 place-items-center rounded-full border transition-colors",
            task.completed
              ? "border-tone bg-tone text-surface"
              : "border-line-strong text-transparent hover:border-tone hover:text-tone",
          )}
        >
          <Check className="size-2.5" strokeWidth={3.5} />
        </button>
        <p className={cn("min-w-0 flex-1 break-words text-sm leading-[1.35rem]", task.completed && "text-ink-3")}>
          {task.title}
        </p>
      </div>

      {hasMeta && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-6 text-xs text-ink-3 [&_svg]:size-3.5">
          {flagged && (
            <span className={cn("flex items-center gap-1 font-medium", task.priority === "urgent" ? "text-danger" : "text-ink-2")}>
              <ArrowUp />
              {PRIORITY_LABEL[task.priority]}
            </span>
          )}
          {task.dueOn && (
            <span className={cn("flex items-center gap-1", due ? DUE_STYLE[due] : "text-ink-3")}>
              <CalendarDays />
              {due === "today" ? "Hoje" : formatDate(task.dueOn)}
            </span>
          )}
          {check.total > 0 && (
            <span className={cn("flex items-center gap-1 tabular-nums", check.done === check.total && "text-tone")}>
              <ListChecks />
              {check.done}/{check.total}
            </span>
          )}
          {task.links.length > 0 && (
            <span className="flex items-center gap-1">
              <Link2 />
              {task.links.length}
            </span>
          )}
          {task.description && <AlignLeft aria-label="Tem descrição" />}
        </div>
      )}
    </div>
  );
});
