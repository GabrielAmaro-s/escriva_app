"use client";

import { CalendarBlankIcon, CheckCircleIcon, DotsThreeIcon, MegaphoneIcon, PlusIcon, TargetIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useProjectUi } from "@/components/projects/project-ui";
import { EmptyState, FilterChips, Page, PageHeader, ProgressBar, SearchInput, StatusBadge, ToneTile } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { useContextMenu } from "@/components/ui/context-menu";
import { formatRange } from "@/domain/board";
import { filterProjects, progressOf } from "@/domain/project";
import type { Project } from "@/domain/types";
import { useProjects } from "@/hooks/use-projects";

type Filter = "all" | "active" | "done";

export function CampaignsView() {
  const store = useProjects();
  const { openNew } = useProjectUi();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const campaigns = store.projects.filter((p) => p.kind === "campaign" && !p.archivedAt);
  const count = (f: Filter) => campaigns.filter((p) => f === "all" || (f === "done") === (p.status === "done")).length;
  const rows = filterProjects(campaigns, "all", query).filter((p) => filter === "all" || (filter === "done") === (p.status === "done"));

  return (
    <Page width={1040}>
      <PageHeader
        title="Campanhas"
        description="Planeje, execute e acompanhe suas campanhas."
        action={
          <Button variant="primary" onClick={() => openNew("campaign")}>
            <PlusIcon size={15} weight="bold" />
            Nova campanha
          </Button>
        }
      />

      <div className="mb-5 mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar campanhas…" />
        <FilterChips
          label="Filtrar campanhas"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: `Todas (${count("all")})` },
            { value: "active", label: `Ativas (${count("active")})` },
            { value: "done", label: `Concluídas (${count("done")})` },
          ]}
        />
      </div>

      {!store.loading && rows.length === 0 ? (
        <EmptyState icon={MegaphoneIcon} title="Nenhuma campanha por aqui" body="Crie uma campanha para planejar entregas, canais e período.">
          <Button variant="primary" size="sm" onClick={() => openNew("campaign")}>
            + Nova campanha
          </Button>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {store.loading
            ? Array.from({ length: 3 }, (_, i) => <div key={i} className="h-[98px] animate-pulse rounded-[14px] border border-line bg-surface" />)
            : rows.map((p) => <CampaignRow key={p.id} project={p} />)}
        </div>
      )}
    </Page>
  );
}

function CampaignRow({ project }: { project: Project }) {
  const router = useRouter();
  const openMenu = useContextMenu();
  const { actionsFor } = useProjectUi();
  const c = project.campaign;
  const deliverables = c?.deliverables ?? [];
  const pct = progressOf(project);
  const open = () => router.push(`/projetos/${project.id}`);
  const menu = (e: React.MouseEvent) => openMenu(e, actionsFor(project));

  return (
    <article
      tabIndex={0}
      aria-label={project.name}
      onClick={open}
      onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && open()}
      onContextMenu={menu}
      className="relative flex cursor-pointer flex-wrap items-center gap-x-6 gap-y-4 rounded-[14px] border border-line bg-surface py-4 pl-[18px] pr-[52px] transition-[border-color,box-shadow] duration-150 hover:border-line2 hover:shadow-card"
    >
      <ToneTile tone={project.color} icon={project.icon} size={40} />
      <div className="min-w-0 flex-[1_1_300px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{project.name}</h3>
          <StatusBadge status={project.status} className="py-0.5" />
        </div>
        {project.description && <p className="mt-[3px] text-[12.5px] text-ink2">{project.description}</p>}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink2">
          <span className="inline-flex items-center gap-1.5">
            <TargetIcon size={14} />
            {c?.objective || "Sem objetivo"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarBlankIcon size={14} />
            {formatRange(c?.startsOn ?? null, c?.endsOn ?? null)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MegaphoneIcon size={14} />
            {c?.channels.length ? c.channels.join(", ") : "Sem canais"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircleIcon size={14} />
            {deliverables.filter((d) => d.done).length} de {deliverables.length} entregas
          </span>
        </div>
      </div>
      <div className="flex flex-[0_0_150px] flex-col gap-[7px]">
        <div className="flex justify-between text-xs text-ink2">
          <span>Progresso</span>
          <span className="font-semibold text-ink">{pct}%</span>
        </div>
        <ProgressBar value={pct} tone={project.color} done={project.status === "done"} />
      </div>
      <button
        type="button"
        aria-label="Mais opções"
        onClick={menu}
        className="absolute right-3 top-3 grid size-7 place-items-center rounded-[7px] border-0 bg-transparent text-ink3 hover:bg-hover hover:text-ink"
      >
        <DotsThreeIcon size={16} weight="bold" />
      </button>
    </article>
  );
}
