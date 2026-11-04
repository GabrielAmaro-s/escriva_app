"use client";

import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  PauseIcon,
  PencilSimpleIcon,
  PlayIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { MenuItem } from "@/components/ui/context-menu";
import { emptyProjectInput, toProjectInput } from "@/domain/project";
import type { Project, ProjectKind } from "@/domain/types";
import { useProjects } from "@/hooks/use-projects";
import { ProjectFormDialog } from "./project-form-dialog";

interface ProjectUi {
  openNew(kind: ProjectKind): void;
  openEdit(project: Project): void;
  /** Ações do menu "..." de um projeto. `inBoard` tira o "Abrir". */
  actionsFor(project: Project, options?: { inBoard?: boolean }): MenuItem[];
}

const Ctx = createContext<ProjectUi | null>(null);

export function useProjectUi(): ProjectUi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProjectUi precisa estar dentro de ProjectUiProvider");
  return ctx;
}

/** Formulário de projeto e menu de ações, disponíveis em qualquer tela. */
export function ProjectUiProvider({ children }: { children: ReactNode }) {
  const store = useProjects();
  const router = useRouter();
  const [form, setForm] = useState<{ open: boolean; kind: ProjectKind; project?: Project }>({ open: false, kind: "project" });

  const openNew = useCallback((kind: ProjectKind) => setForm({ open: true, kind }), []);
  const openEdit = useCallback((project: Project) => setForm({ open: true, kind: project.kind, project }), []);

  const actionsFor = useCallback(
    (p: Project, options?: { inBoard?: boolean }): MenuItem[] => {
      const items: MenuItem[] = [];
      if (!options?.inBoard) items.push({ label: "Abrir", icon: ArrowRightIcon, onSelect: () => router.push(`/projetos/${p.id}`) });
      items.push({ label: "Editar", icon: PencilSimpleIcon, onSelect: () => openEdit(p) });
      if (p.archivedAt) {
        items.push({ label: "Restaurar", icon: ArrowCounterClockwiseIcon, onSelect: () => store.restore(p.id) });
      } else {
        items.push(
          p.status === "paused"
            ? { label: "Reativar", icon: PlayIcon, onSelect: () => store.setStatus(p.id, "active") }
            : { label: "Pausar", icon: PauseIcon, onSelect: () => store.setStatus(p.id, "paused") },
        );
        if (p.status !== "done") items.push({ label: "Marcar como concluído", icon: CheckCircleIcon, onSelect: () => store.setStatus(p.id, "done") });
        items.push({ label: "Arquivar", icon: ArchiveIcon, onSelect: () => store.archive(p.id) });
      }
      items.push({
        label: "Excluir",
        icon: TrashIcon,
        danger: true,
        onSelect: () => {
          if (options?.inBoard) router.push(p.kind === "campaign" ? "/campanhas" : "/");
          store.remove(p.id);
        },
      });
      return items;
    },
    [router, store, openEdit],
  );

  const value = useMemo(() => ({ openNew, openEdit, actionsFor }), [openNew, openEdit, actionsFor]);
  const initial = form.project ? toProjectInput(form.project) : emptyProjectInput(form.kind);

  return (
    <Ctx.Provider value={value}>
      {children}
      <ProjectFormDialog
        open={form.open}
        editing={Boolean(form.project)}
        initial={initial}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onSubmit={async (input) => {
          if (form.project) return Boolean(await store.update(form.project.id, input));
          const created = await store.create(input);
          if (created) router.push(`/projetos/${created.id}`);
          return Boolean(created);
        }}
      />
    </Ctx.Provider>
  );
}
