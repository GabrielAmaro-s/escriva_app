"use client";

import { Archive, ArchiveRestore, CircleCheck, CirclePause, CirclePlay, Megaphone, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { IconButton } from "@/components/ui/button";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { formatDate } from "@/domain/board";
import { STATUS_LABEL, progressOf } from "@/domain/project";
import type { Project, ProjectStatus } from "@/domain/types";
import { cn } from "@/lib/cn";

export interface ProjectActions {
  onEdit: (p: Project) => void;
  onStatus: (p: Project, s: ProjectStatus) => void;
  onArchive: (p: Project) => void;
  onRestore: (p: Project) => void;
  onDelete: (p: Project) => void;
}

const STATUS_DOT: Record<ProjectStatus, string> = {
  active: "bg-tone",
  paused: "bg-transparent ring-1 ring-inset ring-ink-3",
  done: "bg-ink-3",
};

export function ProjectCard({ project, actions }: { project: Project; actions: ProjectActions }) {
  const progress = progressOf(project);
  const c = project.campaign;
  const period =
    c?.startsOn || c?.endsOn
      ? [c.startsOn && formatDate(c.startsOn), c.endsOn && formatDate(c.endsOn)].filter(Boolean).join(" a ")
      : null;

  const statusItems: MenuItem[] = (
    [
      { s: "active", label: "Marcar como ativo", icon: <CirclePlay /> },
      { s: "paused", label: "Pausar", icon: <CirclePause /> },
      { s: "done", label: "Marcar como concluído", icon: <CircleCheck /> },
    ] as const
  )
    .filter((x) => x.s !== project.status)
    .map((x) => ({ label: x.label, icon: x.icon, onSelect: () => actions.onStatus(project, x.s) }));

  const items: (MenuItem | "separator")[] = [
    { label: "Editar", icon: <Pencil />, onSelect: () => actions.onEdit(project) },
    ...(project.archivedAt ? [] : statusItems),
    "separator",
    project.archivedAt
      ? { label: "Restaurar", icon: <ArchiveRestore />, onSelect: () => actions.onRestore(project) }
      : { label: "Arquivar", icon: <Archive />, onSelect: () => actions.onArchive(project) },
    { label: "Excluir", icon: <Trash2 />, tone: "danger", onSelect: () => actions.onDelete(project) },
  ];

  return (
    <article
      data-color={project.color}
      className={cn(
        "group relative flex flex-col rounded-xl border border-line bg-surface transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-lift",
        project.status === "done" && "opacity-80",
      )}
    >
      {/* Aba colorida: a cor do projeto como a etiqueta de uma pasta */}
      <span aria-hidden className="absolute -top-px left-4 h-1.5 w-10 rounded-b-md bg-tone" />

      <Link href={`/projetos/${project.id}`} className="flex flex-1 flex-col gap-1.5 rounded-xl px-4 pb-4 pt-5 focus-visible:outline-offset-0">
        <h3 className="pr-7 text-[1.0625rem] font-semibold leading-snug tracking-tight text-ink">{project.name}</h3>
        {project.kind === "campaign" && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-tone">
            <Megaphone className="size-3.5" />
            Campanha
            {period && <span className="font-normal text-ink-3">{period}</span>}
          </p>
        )}
        {project.description && <p className="line-clamp-2 text-sm text-ink-2">{project.description}</p>}

        <div className="mt-auto flex items-center gap-3 pt-4">
          <span className="flex items-center gap-1.5 text-xs text-ink-2">
            <span className={cn("size-2 rounded-full", STATUS_DOT[project.status])} aria-hidden />
            {project.archivedAt ? "Arquivado" : STATUS_LABEL[project.status]}
          </span>
          <div
            className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso"
          >
            <div className="h-full rounded-full bg-tone transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs tabular-nums text-ink-3">
            {project.taskCount ? `${project.doneCount}/${project.taskCount}` : "Sem tarefas"}
          </span>
        </div>
      </Link>

      <div className="absolute right-2 top-3">
        <Menu
          items={items}
          trigger={(props) => (
            <IconButton
              label="Ações do projeto"
              {...props}
              className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100 max-md:opacity-100"
            >
              <MoreHorizontal />
            </IconButton>
          )}
        />
      </div>
    </article>
  );
}
