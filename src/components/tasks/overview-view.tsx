"use client";

import { useMemo, useState } from "react";
import { Page, PageHeader } from "@/components/ui/bits";
import { todayIso } from "@/domain/board";
import { useProjects } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import { cn } from "@/lib/cn";
import { TaskList } from "./task-list";
import { TaskModal } from "./task-modal";
import { openTasks } from "./tasks-view";

export function OverviewView() {
  const store = useProjects();
  const api = useTasks();
  const [openTask, setOpenTask] = useState<string | null>(null);
  const projectsById = useMemo(() => new Map(store.projects.map((p) => [p.id, p])), [store.projects]);

  const open = openTasks(api.tasks, projectsById);
  const upcoming = open.filter((t) => t.dueOn).slice(0, 8);
  const inAWeek = new Date();
  inAWeek.setDate(inAWeek.getDate() + 7);
  const weekLimit = todayIso(inAWeek);
  const dueSoon = open.filter((t) => t.dueOn && t.dueOn <= weekLimit).length;

  const stats = [
    { v: store.projects.filter((p) => p.status === "active" && !p.archivedAt).length, l: "Projetos ativos", warn: false },
    { v: open.length, l: "Tarefas abertas", warn: false },
    { v: dueSoon, l: "Vencem em 7 dias", warn: dueSoon > 0 },
  ].filter((s) => s.v > 0);
  const loading = api.status === "loading" || store.loading;

  return (
    <Page width={880}>
      <PageHeader title="Visão geral" description="O que pede atenção nos seus projetos e campanhas." />
      {!loading && stats.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3">
          {stats.map((s) => (
            <div key={s.l} className="flex-[1_1_150px] rounded-xl border border-line bg-surface px-4 py-3.5">
              <p className={cn("text-2xl font-bold tracking-[-0.02em]", s.warn ? "text-s-amber" : "text-ink")}>{s.v}</p>
              <p className="mt-0.5 text-[12.5px] text-ink2">{s.l}</p>
            </div>
          ))}
        </div>
      )}
      <p className="mb-2.5 mt-7 text-xs font-semibold text-ink3">Próximas entregas</p>
      <TaskList tasks={upcoming} projects={projectsById} onOpen={setOpenTask} onToggle={api.toggleComplete} loading={loading} />
      <TaskModal api={api} taskId={openTask} projects={store.projects} onClose={() => setOpenTask(null)} />
    </Page>
  );
}
