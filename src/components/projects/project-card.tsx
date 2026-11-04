"use client";

import { CalendarBlankIcon, DotsThreeIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { ProgressBar, StatusBadge, ToneTile } from "@/components/ui/bits";
import { useContextMenu } from "@/components/ui/context-menu";
import { formatDate } from "@/domain/board";
import { deadlineOf, progressOf } from "@/domain/project";
import type { Project } from "@/domain/types";
import { useProjectUi } from "./project-ui";

export function ProjectCard({ project }: { project: Project }) {
  const router = useRouter();
  const openMenu = useContextMenu();
  const { actionsFor } = useProjectUi();
  const pct = progressOf(project);
  const deadline = deadlineOf(project);
  const showDue = deadline && project.status !== "done";
  const open = () => router.push(`/projetos/${project.id}`);
  const menu = (e: React.MouseEvent | React.KeyboardEvent) => openMenu(e, actionsFor(project));

  return (
    <article
      tabIndex={0}
      aria-label={project.name}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) open();
      }}
      onContextMenu={menu}
      className="flex cursor-pointer flex-col rounded-[14px] border border-line bg-surface p-4 transition-[border-color,box-shadow] duration-150 hover:border-line2 hover:shadow-card"
    >
      <div className="flex items-start justify-between">
        <ToneTile tone={project.color} icon={project.icon} />
        <div className="flex items-center gap-1">
          <StatusBadge status={project.status} archived={Boolean(project.archivedAt)} />
          <button
            type="button"
            aria-label="Mais opções"
            onClick={menu}
            className="grid size-[26px] place-items-center rounded-[7px] border-0 bg-transparent text-ink3 hover:bg-hover hover:text-ink"
          >
            <DotsThreeIcon size={16} weight="bold" />
          </button>
        </div>
      </div>
      <h3 className="mt-3.5 text-[15px] font-semibold tracking-[-0.01em]">{project.name}</h3>
      <p className="mt-1 line-clamp-2 min-h-[38px] text-[12.5px] leading-normal text-ink2">{project.description}</p>
      <div className="mt-auto flex justify-between pt-3.5 text-xs text-ink2">
        <span>
          {project.doneCount} de {project.taskCount} tarefas
        </span>
        <span className="font-semibold text-ink">{pct}%</span>
      </div>
      <div className="mt-[7px]">
        <ProgressBar value={pct} tone={project.color} done={project.status === "done"} />
      </div>
      {showDue && (
        <p className="mt-3.5 flex items-center gap-[7px] text-xs text-ink2">
          <CalendarBlankIcon size={14} />
          Até {formatDate(deadline)}
        </p>
      )}
    </article>
  );
}
