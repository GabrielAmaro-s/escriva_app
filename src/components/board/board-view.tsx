"use client";

import { ArrowLeftIcon, DotsThreeIcon, InfoIcon, KanbanIcon, PlusIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useProjectUi } from "@/components/projects/project-ui";
import { TaskModal } from "@/components/tasks/task-modal";
import { StatusBadge } from "@/components/ui/bits";
import { Button, IconButton } from "@/components/ui/button";
import { useContextMenu } from "@/components/ui/context-menu";
import { useProjects } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import { cn } from "@/lib/cn";
import { Board } from "./board";
import { DetailsTab } from "./details-tab";

export function BoardView({ projectId }: { projectId: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const store = useProjects();
  const api = useTasks(projectId);
  const openMenu = useContextMenu();
  const { actionsFor } = useProjectUi();
  const [openTask, setOpenTask] = useState<string | null>(params.get("tarefa"));
  const [adding, setAdding] = useState<string | null>(null);
  const tab = params.get("aba") === "detalhes" ? "details" : "board";
  const project = store.projects.find((p) => p.id === projectId) ?? null;
  const columns = api.columnsOf(projectId);

  useEffect(() => {
    if (project) document.title = `${project.name} | myPlan`;
  }, [project]);

  const setTab = (t: "board" | "details") => router.replace(`/projetos/${projectId}${t === "details" ? "?aba=detalhes" : ""}`, { scroll: false });

  if (api.status === "loading" || (store.loading && !project)) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 px-4 pt-5 nav:px-10 nav:pt-8">
        <div className="h-9 w-72 animate-pulse rounded-lg bg-hover" />
        <div className="flex gap-3.5">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-96 min-w-[262px] flex-1 animate-pulse rounded-[14px] bg-hover" />
          ))}
        </div>
      </div>
    );
  }

  if (api.status !== "ready" || !project) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col items-start gap-2 px-4 py-10 nav:px-10">
        <h1 className="text-xl font-bold">{api.status === "error" ? "Não foi possível abrir o quadro" : "Este projeto não existe mais"}</h1>
        <p className="text-sm text-ink2">{api.status === "error" ? "Verifique sua conexão e recarregue a página." : "Ele pode ter sido excluído."}</p>
        <Link href="/" className="mt-2 text-sm font-medium text-primary">
          Voltar para Meus projetos
        </Link>
      </div>
    );
  }

  const back = project.kind === "campaign" ? "/campanhas" : "/";
  const addTop = () => {
    setTab("board");
    setAdding(columns.find((c) => c.kind === "todo")?.id ?? columns[0]?.id ?? null);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 animate-in flex-col px-4 pb-10 pt-5 nav:px-10 nav:pb-12 nav:pt-8">
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div className="flex min-w-0 flex-[1_1_320px] items-start gap-3">
          <IconButton label="Voltar" size="icon-sm" className="mt-0.5 size-8" onClick={() => router.push(back)}>
            <ArrowLeftIcon size={18} />
          </IconButton>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="m-0 text-[26px] font-bold leading-[1.2] tracking-[-0.025em]">{project.name}</h1>
              <StatusBadge status={project.status} archived={Boolean(project.archivedAt)} className="px-2.5" />
            </div>
            {project.description && <p className="mt-[5px] text-[13.5px] text-ink2">{project.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <IconButton label="Mais opções" variant="secondary" size="icon" className="text-ink2" onClick={(e) => openMenu(e, actionsFor(project, { inBoard: true }))}>
            <DotsThreeIcon size={16} weight="bold" />
          </IconButton>
          <Button variant="primary" onClick={addTop}>
            <PlusIcon size={15} weight="bold" />
            Adicionar tarefa
          </Button>
        </div>
      </div>

      <div role="tablist" aria-label="Visualização" className="mb-4 mt-5 flex gap-1.5 border-b border-line pb-3">
        {(
          [
            { id: "board", label: "Quadro", icon: KanbanIcon },
            { id: "details", label: "Detalhes", icon: InfoIcon },
          ] as const
        ).map(({ id, label, icon: Glyph }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex h-8 items-center gap-[7px] rounded-lg border-0 px-3 text-[13px] font-medium transition-[background] duration-150",
              tab === id ? "bg-primary-soft text-primary" : "bg-transparent text-ink2 hover:bg-hover",
            )}
          >
            <Glyph size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === "board" ? (
        <Board api={api} columns={columns} adding={adding} setAdding={setAdding} onOpenTask={setOpenTask} />
      ) : (
        <DetailsTab project={project} />
      )}

      <TaskModal api={api} taskId={openTask} projects={store.projects} onClose={() => setOpenTask(null)} />
    </div>
  );
}
