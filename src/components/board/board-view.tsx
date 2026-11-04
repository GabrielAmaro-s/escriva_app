"use client";

import { ArrowLeft, Megaphone, Pencil } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, progressOf, toProjectInput } from "@/domain/project";
import type { CampaignDetails } from "@/domain/types";
import { useBoard } from "@/hooks/use-board";
import { useProjects } from "@/hooks/use-projects";
import { Board } from "./board";
import { CampaignStrip } from "./campaign-strip";
import { TaskSheet } from "./task-sheet";

export function BoardView({ projectId }: { projectId: string }) {
  const api = useBoard(projectId);
  const store = useProjects();
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [campaignDraft, setCampaignDraft] = useState<CampaignDetails | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const project = api.project;

  useEffect(() => {
    if (project) document.title = `${project.name} | myPlan`;
  }, [project]);

  if (api.status === "loading") {
    return (
      <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-surface-2" />
        <div className="flex gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-64 w-[19rem] shrink-0 animate-pulse rounded-xl bg-surface-2/70" />
          ))}
        </div>
      </div>
    );
  }

  if (api.status !== "ready" || !project) {
    return (
      <div className="flex flex-1 flex-col items-start gap-3 px-4 py-10 sm:px-8">
        <h1 className="text-xl font-semibold">
          {api.status === "missing" ? "Este projeto não existe mais." : "Não foi possível abrir o quadro."}
        </h1>
        <p className="text-sm text-ink-2">
          {api.status === "missing" ? "Ele pode ter sido excluído." : "Verifique sua conexão e recarregue a página."}
        </p>
        <Link href="/" className="text-sm font-medium text-accent hover:underline">
          Voltar para Meus projetos
        </Link>
      </div>
    );
  }

  const progress = progressOf(project);
  const campaign = campaignDraft ?? project.campaign;

  const saveCampaign = (c: CampaignDetails) => {
    setCampaignDraft(c);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await store.update(project.id, { ...toProjectInput(project), campaign: c });
      setCampaignDraft(null);
    }, 500);
  };

  return (
    <div data-color={project.color} className="flex min-h-0 flex-1 flex-col bg-tone-wash md:h-dvh">
      <header className="flex flex-col gap-4 px-4 pb-4 pt-5 sm:px-8 sm:pt-8">
        <Link href="/" className="flex w-fit items-center gap-1 text-sm text-ink-3 hover:text-ink md:hidden">
          <ArrowLeft className="size-4" />
          Projetos
        </Link>
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <span className="size-3 shrink-0 rounded-[4px] bg-tone" aria-hidden />
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{project.name}</h1>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 pl-5.5 text-sm text-ink-3">
              {project.kind === "campaign" && (
                <span className="flex items-center gap-1.5 font-medium text-tone">
                  <Megaphone className="size-3.5" />
                  Campanha
                </span>
              )}
              <span>{project.archivedAt ? "Arquivado" : STATUS_LABEL[project.status]}</span>
              <span className="flex items-center gap-2">
                <span className="h-1 w-20 overflow-hidden rounded-full bg-ink/10" aria-hidden>
                  <span className="block h-full rounded-full bg-tone transition-[width] duration-300" style={{ width: `${progress}%` }} />
                </span>
                <span className="tabular-nums">
                  {project.doneCount} de {project.taskCount} concluídas
                </span>
              </span>
            </div>
          </div>
          <Button size="sm" onClick={() => setEditing(true)}>
            <Pencil />
            Editar projeto
          </Button>
        </div>
        {project.description && <p className="max-w-2xl pl-5.5 text-sm text-ink-2">{project.description}</p>}
        {project.kind === "campaign" && campaign && <CampaignStrip campaign={campaign} onChange={saveCampaign} />}
      </header>

      <Board api={api} onOpenTask={setOpenTask} />

      <TaskSheet api={api} taskId={openTask} onClose={() => setOpenTask(null)} />

      <ProjectFormDialog
        open={editing}
        initial={toProjectInput(project)}
        onClose={() => setEditing(false)}
        onSubmit={async (input) => Boolean(await store.update(project.id, input))}
      />
    </div>
  );
}
