"use client";

import { PlusIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { CheckMark, ProgressBar } from "@/components/ui/bits";
import { formatDate, formatRange, newId } from "@/domain/board";
import { STATUS_LABEL, progressOf, toProjectInput } from "@/domain/project";
import type { Project } from "@/domain/types";
import { useProjects } from "@/hooks/use-projects";
import { cn } from "@/lib/cn";

function Heading({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-xs font-semibold text-ink3">{children}</p>;
}

export function DetailsTab({ project }: { project: Project }) {
  const store = useProjects();
  const [newDeliverable, setNewDeliverable] = useState("");
  const isCampaign = project.kind === "campaign";
  const c = project.campaign;
  const deliverables = c?.deliverables ?? [];
  const pct = progressOf(project);

  const saveDeliverables = (next: typeof deliverables) => {
    if (!c) return;
    store.update(project.id, { ...toProjectInput(project), campaign: { ...c, deliverables: next } }, { quiet: true });
  };

  const addDeliverable = () => {
    const title = newDeliverable.trim();
    if (!title) return;
    saveDeliverables([...deliverables, { id: newId(), title, done: false }]);
    setNewDeliverable("");
  };

  const facts = [
    { k: "Status", v: project.archivedAt ? "Arquivado" : STATUS_LABEL[project.status] },
    { k: "Tipo", v: isCampaign ? "Campanha" : "Projeto" },
    isCampaign
      ? { k: "Período", v: formatRange(c?.startsOn ?? null, c?.endsOn ?? null) }
      : { k: "Prazo", v: project.dueOn ? formatDate(project.dueOn) : "Sem prazo" },
    { k: "Tarefas", v: `${project.doneCount} de ${project.taskCount} · ${pct}%` },
  ];

  return (
    <div className="flex animate-in flex-wrap items-start gap-x-10 gap-y-7">
      <div className="flex min-w-0 max-w-[640px] flex-[1_1_360px] flex-col gap-[22px]">
        {isCampaign ? (
          <>
            <div>
              <Heading>Objetivo</Heading>
              <p className="text-sm leading-normal">{c?.objective || "Ainda sem objetivo. Defina em Editar."}</p>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-ink3">Canais de divulgação</p>
              {c?.channels.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {c.channels.map((ch) => (
                    <span key={ch} className="rounded-full border border-line bg-hover px-[11px] py-1 text-[12.5px] text-ink2">
                      {ch}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink2">Nenhum canal escolhido.</p>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-ink3">
                Entregas planejadas · {deliverables.filter((d) => d.done).length} de {deliverables.length}
              </p>
              <div className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface">
                {deliverables.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={d.done}
                    onClick={() => saveDeliverables(deliverables.map((x) => (x.id === d.id ? { ...x, done: !x.done } : x)))}
                    className="flex items-center gap-[11px] border-0 border-b border-solid border-line bg-transparent px-3.5 py-[11px] text-left text-[13.5px] hover:bg-hover"
                  >
                    <CheckMark checked={d.done} />
                    <span className={cn(d.done ? "text-ink3 line-through" : "text-ink")}>{d.title}</span>
                  </button>
                ))}
                <div className="flex items-center gap-2.5 px-3.5">
                  <PlusIcon size={14} weight="bold" className="text-ink3" />
                  <input
                    value={newDeliverable}
                    onChange={(e) => setNewDeliverable(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDeliverable())}
                    placeholder="Adicionar entrega…"
                    aria-label="Adicionar entrega"
                    className="h-10 flex-1 border-0 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink3"
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div>
            <Heading>Sobre o projeto</Heading>
            <p className="text-sm leading-relaxed text-ink2">{project.description || "Sem descrição. Adicione uma em Editar."}</p>
          </div>
        )}
      </div>

      <div className="min-w-[240px] flex-[0_1_280px] rounded-[14px] border border-line bg-surface px-4 py-1.5">
        {facts.map((f) => (
          <div key={f.k} className="flex justify-between gap-3 border-b border-line py-3 text-[13px]">
            <span className="text-ink2">{f.k}</span>
            <span className="text-right font-semibold">{f.v}</span>
          </div>
        ))}
        <div className="pb-3 pt-3.5">
          <ProgressBar value={pct} tone={project.color} done={project.status === "done"} height={5} />
        </div>
      </div>
    </div>
  );
}
