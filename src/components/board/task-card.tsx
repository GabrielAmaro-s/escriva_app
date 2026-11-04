"use client";

import { CalendarBlankIcon, CheckIcon, CheckSquareIcon, DotsThreeIcon, FlagIcon } from "@phosphor-icons/react";
import { forwardRef, type HTMLAttributes } from "react";
import { Pill } from "@/components/ui/bits";
import { PRIORITY_COLOR, PRIORITY_LABEL, checklistProgress, dueColor, formatDate } from "@/domain/board";
import type { Label, Task } from "@/domain/types";
import { cn } from "@/lib/cn";

interface TaskCardProps extends HTMLAttributes<HTMLDivElement> {
  task: Task;
  labelsById: Map<string, Label>;
  dragging?: boolean;
  overlay?: boolean;
  onMenu?: (e: React.MouseEvent) => void;
}

export const TaskCard = forwardRef<HTMLDivElement, TaskCardProps>(function TaskCard(
  { task, labelsById, dragging, overlay, onMenu, className, ...props },
  ref,
) {
  const done = task.completed;
  const labels = done ? [] : task.labelIds.map((id) => labelsById.get(id)).filter((l): l is Label => Boolean(l));
  const check = checklistProgress(task);
  const flagged = task.priority !== "low";
  const hasMeta = !done && (task.dueOn || check.total > 0 || flagged);

  return (
    <div
      ref={ref}
      className={cn(
        "flex cursor-grab touch-manipulation flex-col gap-[9px] rounded-[11px] border border-line bg-surface px-3 py-[11px] text-left transition-[border-color,box-shadow,opacity] duration-150 hover:border-line2 hover:shadow-soft active:cursor-grabbing",
        dragging && "opacity-40",
        overlay && "rotate-[1.5deg] cursor-grabbing border-line2 shadow-pop",
        className,
      )}
      {...props}
    >
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-[5px]">
          {labels.map((l) => (
            <Pill key={l.id} tone={l.color}>
              {l.name}
            </Pill>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2">
        {done && (
          <span className="mt-px grid size-4 shrink-0 place-items-center rounded-full bg-s-green text-on-primary" aria-label="Concluída">
            <CheckIcon size={10} weight="bold" />
          </span>
        )}
        <span className={cn("min-w-0 flex-1 break-words text-[13.5px] font-medium leading-[1.4] tracking-[-0.005em]", done && "text-ink3 line-through")}>
          {task.title}
        </span>
        {onMenu && (
          <button
            type="button"
            aria-label="Mais opções"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onMenu(e);
            }}
            className="-mr-[5px] -mt-[3px] grid size-6 shrink-0 place-items-center rounded-md border-0 bg-transparent text-ink3 nav:hidden"
          >
            <DotsThreeIcon size={16} />
          </button>
        )}
      </div>

      {hasMeta && (
        <div className="flex items-center gap-3 text-[11.5px] text-ink3">
          {task.dueOn && (
            <span className="inline-flex items-center gap-[5px]" style={{ color: dueColor(task.dueOn, done) }}>
              <CalendarBlankIcon size={13} />
              {formatDate(task.dueOn)}
            </span>
          )}
          {check.total > 0 && (
            <span className="inline-flex items-center gap-[5px] tabular-nums">
              <CheckSquareIcon size={13} />
              {check.done}/{check.total}
            </span>
          )}
          {flagged && (
            <span title={`Prioridade ${PRIORITY_LABEL[task.priority].toLowerCase()}`} className="ml-auto inline-flex" style={{ color: PRIORITY_COLOR[task.priority] }}>
              <FlagIcon size={13} weight="fill" />
            </span>
          )}
        </div>
      )}
    </div>
  );
});
