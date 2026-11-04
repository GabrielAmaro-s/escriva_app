"use client";

import { FlagIcon } from "@phosphor-icons/react";
import { CheckMark } from "@/components/ui/bits";
import { PRIORITY_COLOR, PRIORITY_LABEL, dueColor, formatDate } from "@/domain/board";
import type { Project, Task } from "@/domain/types";
import { cn } from "@/lib/cn";

/** Lista de tarefas de vários projetos (Visão geral e Tarefas). */
export function TaskList({
  tasks,
  projects,
  onOpen,
  onToggle,
  loading,
}: {
  tasks: Task[];
  projects: Map<string, Project>;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
  loading?: boolean;
}) {
  return (
    <ul className="flex flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
      {loading
        ? Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="flex h-14 items-center border-b border-line px-4 last:border-b-0">
              <span className="h-3 w-1/2 animate-pulse rounded bg-hover" />
            </li>
          ))
        : tasks.map((t) => {
            const project = projects.get(t.projectId);
            return (
              <li
                key={t.id}
                tabIndex={0}
                onClick={() => onOpen(t.id)}
                onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && onOpen(t.id)}
                className="flex cursor-pointer items-center gap-3 border-b border-line px-4 py-[11px] last:border-b-0 hover:bg-hover"
              >
                <button
                  type="button"
                  aria-pressed={t.completed}
                  aria-label={t.completed ? `Reabrir ${t.title}` : `Concluir ${t.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(t.id);
                  }}
                  className="border-0 bg-transparent p-0"
                >
                  <CheckMark checked={t.completed} shape="round" color="green" size={18} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-[13.5px] font-medium", t.completed && "text-ink3 line-through")}>{t.title}</p>
                  {project && (
                    <p data-tone={project.color} className="mt-0.5 flex items-center gap-1.5 text-xs text-ink3">
                      <span className="size-[7px] rounded-full bg-tone" aria-hidden />
                      {project.name}
                    </p>
                  )}
                </div>
                {t.dueOn && (
                  <span className="whitespace-nowrap text-xs" style={{ color: dueColor(t.dueOn, t.completed) }}>
                    {formatDate(t.dueOn)}
                  </span>
                )}
                <span
                  className="inline-flex w-3.5"
                  style={{ color: PRIORITY_COLOR[t.priority], opacity: t.priority === "low" ? 0 : 1 }}
                  title={`Prioridade ${PRIORITY_LABEL[t.priority].toLowerCase()}`}
                >
                  <FlagIcon size={13} weight="fill" />
                </span>
              </li>
            );
          })}
      {!loading && tasks.length === 0 && (
        <li className="px-5 py-11 text-center text-[13.5px] text-ink2">
          <p className="mb-1 font-semibold text-ink">Tudo em dia</p>
          Nenhuma tarefa aqui por enquanto.
        </li>
      )}
    </ul>
  );
}
