"use client";

import { useMemo, useState } from "react";
import { FilterChips, Page, PageHeader } from "@/components/ui/bits";
import type { Project, Task } from "@/domain/types";
import { useProjects } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import { TaskList } from "./task-list";
import { TaskModal } from "./task-modal";

const byDue = (a: Task, b: Task) => (a.dueOn ?? "9999") < (b.dueOn ?? "9999") ? -1 : (a.dueOn ?? "9999") > (b.dueOn ?? "9999") ? 1 : 0;

/** Tarefas abertas de projetos que ainda estão em andamento, ordenadas por prazo. */
export function openTasks(tasks: Task[], projects: Map<string, Project>): Task[] {
  return tasks
    .filter((t) => {
      const p = projects.get(t.projectId);
      return !t.completed && p && p.status !== "done" && !p.archivedAt;
    })
    .sort(byDue);
}

export function TasksView() {
  const store = useProjects();
  const api = useTasks();
  const [filter, setFilter] = useState<"open" | "done">("open");
  const [openTask, setOpenTask] = useState<string | null>(null);
  const projectsById = useMemo(() => new Map(store.projects.map((p) => [p.id, p])), [store.projects]);

  const rows =
    filter === "open"
      ? openTasks(api.tasks, projectsById)
      : api.tasks
          .filter((t) => {
            const p = projectsById.get(t.projectId);
            return t.completed && p && p.status !== "done" && !p.archivedAt;
          })
          .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const loading = api.status === "loading" || store.loading;

  return (
    <Page width={880}>
      <PageHeader title="Tarefas" description="Todas as tarefas em um só lugar." />
      <div className="mt-[22px]">
        <FilterChips
          label="Filtrar tarefas"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "open", label: "Abertas" },
            { value: "done", label: "Concluídas" },
          ]}
        />
      </div>
      <p className="mb-2.5 mt-[18px] text-xs font-semibold text-ink3">
        {filter === "open" ? `Abertas · ${rows.length} · ordenadas por prazo` : `Concluídas · ${rows.length}`}
      </p>
      <TaskList tasks={rows} projects={projectsById} onOpen={setOpenTask} onToggle={api.toggleComplete} loading={loading} />
      <TaskModal api={api} taskId={openTask} projects={store.projects} onClose={() => setOpenTask(null)} />
    </Page>
  );
}
