"use client";

import { MagnifyingGlassIcon, PlusIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { EmptyState, FilterChips, Page, PageHeader, SearchInput } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { type ProjectFilter, filterProjects } from "@/domain/project";
import { useProjects } from "@/hooks/use-projects";
import { ProjectCard } from "./project-card";
import { useProjectUi } from "./project-ui";

export function ProjectsView() {
  const params = useSearchParams();
  const router = useRouter();
  const store = useProjects();
  const { openNew } = useProjectUi();
  const [query, setQuery] = useState("");
  const filter = (params.get("filtro") as ProjectFilter | null) ?? "all";
  const setFilter = (f: ProjectFilter) => router.replace(f === "all" ? "/" : `/?filtro=${f}`, { scroll: false });

  const counts = useMemo(() => {
    const visible = store.projects.filter((p) => !p.archivedAt);
    return {
      all: visible.length,
      active: visible.filter((p) => p.status === "active").length,
      paused: visible.filter((p) => p.status === "paused").length,
      done: visible.filter((p) => p.status === "done").length,
      archived: store.projects.length - visible.length,
    };
  }, [store.projects]);

  const list = filterProjects(store.projects, filter, query);
  const options: { value: ProjectFilter; label: string }[] = [
    { value: "all", label: `Todos (${counts.all})` },
    { value: "active", label: `Ativos (${counts.active})` },
    { value: "paused", label: `Pausados (${counts.paused})` },
    { value: "done", label: `Concluídos (${counts.done})` },
  ];
  // "Arquivados" só aparece quando há algo arquivado.
  if (counts.archived > 0 || filter === "archived") options.push({ value: "archived", label: `Arquivados (${counts.archived})` });

  const newButton = (
    <Button variant="primary" onClick={() => openNew("project")}>
      <PlusIcon size={15} weight="bold" />
      Novo projeto
    </Button>
  );

  return (
    <Page width={1240}>
      <PageHeader title="Meus projetos" description="Acompanhe e gerencie todos os seus projetos e campanhas." action={newButton} />

      <div className="mb-5 mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar projetos…" />
        <FilterChips label="Filtrar por status" value={filter} onChange={setFilter} options={options} />
      </div>

      {store.loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-[214px] animate-pulse rounded-[14px] border border-line bg-surface" />
          ))}
        </div>
      ) : store.error ? (
        <EmptyState icon={WarningCircleIcon} title="Não foi possível carregar seus projetos" body={store.error}>
          <Button size="sm" onClick={store.reload}>
            Tentar de novo
          </Button>
        </EmptyState>
      ) : list.length === 0 ? (
        counts.all === 0 && counts.archived === 0 ? (
          <EmptyState icon={PlusIcon} title="Comece seu primeiro projeto" body="Cada projeto ganha um quadro para você mover as tarefas conforme avançam.">
            <Button variant="primary" size="sm" onClick={() => openNew("project")}>
              + Novo projeto
            </Button>
          </EmptyState>
        ) : (
          <EmptyState icon={MagnifyingGlassIcon} title="Nenhum projeto encontrado" body="Ajuste a busca ou o filtro, ou comece algo novo.">
            <Button
              size="sm"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
            >
              Limpar filtros
            </Button>
            <Button variant="primary" size="sm" onClick={() => openNew("project")}>
              + Novo projeto
            </Button>
          </EmptyState>
        )
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-4">
          {list.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </Page>
  );
}
