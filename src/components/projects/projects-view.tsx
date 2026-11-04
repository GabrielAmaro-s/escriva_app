"use client";

import { Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Segmented } from "@/components/ui/segmented";
import { type ProjectFilter, filterProjects, toProjectInput } from "@/domain/project";
import type { Project } from "@/domain/types";
import { useProjects } from "@/hooks/use-projects";
import { ProjectCard, type ProjectActions } from "./project-card";
import { ProjectFormDialog } from "./project-form-dialog";

type StatusFilter = Exclude<ProjectFilter, "archived">;

export function ProjectsView() {
  const params = useSearchParams();
  const router = useRouter();
  const archivedView = params.get("filtro") === "arquivados";
  const store = useProjects();
  const [filter, setFilter] = useState<StatusFilter>("active");
  const [form, setForm] = useState<{ open: boolean; project?: Project }>({ open: false });
  const [toDelete, setToDelete] = useState<Project | null>(null);

  const counts = useMemo(() => {
    const open = store.projects.filter((p) => !p.archivedAt);
    return {
      all: open.length,
      active: open.filter((p) => p.status === "active").length,
      paused: open.filter((p) => p.status === "paused").length,
      done: open.filter((p) => p.status === "done").length,
    };
  }, [store.projects]);

  const list = filterProjects(store.projects, archivedView ? "archived" : filter);

  const actions: ProjectActions = {
    onEdit: (project) => setForm({ open: true, project }),
    onStatus: (p, s) => store.setStatus(p.id, s),
    onArchive: (p) => store.archive(p.id),
    onRestore: (p) => store.restore(p.id),
    onDelete: (p) => setToDelete(p),
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
            {archivedView ? "Arquivados" : "Meus projetos"}
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            {archivedView
              ? "Projetos guardados. Restaure quando quiser retomar."
              : counts.all === 0
                ? "Nada por aqui ainda."
                : `${counts.active} ${counts.active === 1 ? "ativo" : "ativos"}, ${counts.paused} ${counts.paused === 1 ? "pausado" : "pausados"}`}
          </p>
        </div>
        {!archivedView && (
          <Button variant="primary" onClick={() => setForm({ open: true })}>
            <Plus />
            Novo projeto
          </Button>
        )}
      </header>

      {!archivedView && counts.all > 0 && (
        <Segmented<StatusFilter>
          label="Filtrar por status"
          value={filter}
          onChange={setFilter}
          className="self-start max-sm:w-full max-sm:overflow-x-auto"
          options={[
            { value: "active", label: "Ativos", count: counts.active },
            { value: "paused", label: "Pausados", count: counts.paused },
            { value: "done", label: "Concluídos", count: counts.done },
            { value: "all", label: "Todos", count: counts.all },
          ]}
        />
      )}

      {store.loading ? (
        <Grid>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl border border-line bg-surface" />
          ))}
        </Grid>
      ) : store.error ? (
        <Empty title="Não foi possível carregar seus projetos." body={store.error}>
          <Button onClick={store.reload}>Tentar de novo</Button>
        </Empty>
      ) : list.length === 0 ? (
        archivedView ? (
          <Empty title="Nenhum projeto arquivado." body="Projetos arquivados saem da lista principal e ficam guardados aqui.">
            <Button onClick={() => router.push("/")}>Ver meus projetos</Button>
          </Empty>
        ) : counts.all === 0 ? (
          <Empty title="Crie seu primeiro projeto." body="Cada projeto ganha um quadro com colunas para você mover as tarefas conforme avançam.">
            <Button variant="primary" onClick={() => setForm({ open: true })}>
              <Plus />
              Novo projeto
            </Button>
          </Empty>
        ) : (
          <Empty title="Nenhum projeto com esse status." body="Escolha outro filtro para ver os demais.">
            <Button onClick={() => setFilter("all")}>Ver todos</Button>
          </Empty>
        )
      ) : (
        <Grid>
          {list.map((p) => (
            <ProjectCard key={p.id} project={p} actions={actions} />
          ))}
        </Grid>
      )}

      <ProjectFormDialog
        open={form.open}
        initial={form.project ? toProjectInput(form.project) : undefined}
        onClose={() => setForm({ open: false })}
        onSubmit={async (input) => {
          if (form.project) return Boolean(await store.update(form.project.id, input));
          const created = await store.create(input);
          if (created) router.push(`/projetos/${created.id}`);
          return Boolean(created);
        }}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir projeto?"
        body={`"${toDelete?.name}" e todas as suas tarefas serão apagados de vez. Se quiser só tirar da lista, arquive.`}
        confirmLabel="Excluir projeto"
        onConfirm={() => toDelete && store.remove(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-3 sm:gap-4">{children}</div>;
}

function Empty({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-line-strong px-6 py-10 sm:items-center sm:text-center">
      <p className="text-base font-medium">{title}</p>
      <p className="max-w-sm text-sm text-ink-2">{body}</p>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}
