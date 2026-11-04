"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getRepository } from "@/data";
import type { Project, ProjectInput, ProjectStatus } from "@/domain/types";
import * as service from "@/services/projects";
import { useToast } from "@/components/ui/toast";

interface ProjectsState {
  projects: Project[];
  loading: boolean;
  error: string | null;
  create(input: ProjectInput): Promise<Project | null>;
  update(id: string, input: ProjectInput): Promise<Project | null>;
  setStatus(id: string, status: ProjectStatus): void;
  archive(id: string): void;
  restore(id: string): void;
  remove(id: string): Promise<void>;
  /** Mantém o progresso dos cartões em dia quando o quadro muda. */
  syncCounts(id: string, taskCount: number, doneCount: number): void;
  reload(): void;
}

const Ctx = createContext<ProjectsState | null>(null);

export function useProjects(): ProjectsState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProjects precisa estar dentro de ProjectsProvider");
  return ctx;
}

const message = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado. Tente de novo.");

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const repo = getRepository();
  const toast = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    repo
      .listProjects()
      .then((list) => {
        setProjects(list);
        setError(null);
      })
      .catch((e) => setError(message(e)))
      .finally(() => setLoading(false));
  }, [repo]);

  useEffect(reload, [reload]);

  const replace = (p: Project) => setProjects((list) => list.map((x) => (x.id === p.id ? p : x)));

  /** Atualização otimista: aplica na tela, grava e desfaz se falhar. */
  const optimistic = useCallback(
    (id: string, change: Partial<Project>, run: () => Promise<Project>, success?: string, undo?: () => void) => {
      let previous: Project | undefined;
      setProjects((list) =>
        list.map((p) => {
          if (p.id !== id) return p;
          previous = p;
          return { ...p, ...change };
        }),
      );
      run()
        .then((p) => {
          replace(p);
          if (success) toast({ text: success, tone: "info", action: undo ? { label: "Desfazer", run: undo } : undefined });
        })
        .catch((e) => {
          if (previous) replace(previous);
          toast({ text: message(e), tone: "error" });
        });
    },
    [toast],
  );

  const value = useMemo<ProjectsState>(
    () => ({
      projects,
      loading,
      error,
      reload,
      async create(input) {
        try {
          const p = await service.createProject(repo, input);
          setProjects((list) => [p, ...list]);
          return p;
        } catch (e) {
          toast({ text: message(e), tone: "error" });
          return null;
        }
      },
      async update(id, input) {
        try {
          const p = await service.updateProject(repo, id, input);
          replace(p);
          return p;
        } catch (e) {
          toast({ text: message(e), tone: "error" });
          return null;
        }
      },
      setStatus(id, status) {
        optimistic(id, { status }, () => service.setProjectStatus(repo, id, status));
      },
      archive(id) {
        optimistic(id, { archivedAt: new Date().toISOString() }, () => service.archiveProject(repo, id), "Projeto arquivado.", () =>
          optimistic(id, { archivedAt: null }, () => service.restoreProject(repo, id)),
        );
      },
      restore(id) {
        optimistic(id, { archivedAt: null }, () => service.restoreProject(repo, id), "Projeto restaurado.");
      },
      async remove(id) {
        const previous = projects;
        setProjects((list) => list.filter((p) => p.id !== id));
        try {
          await service.deleteProject(repo, id);
          toast({ text: "Projeto excluído.", tone: "info" });
        } catch (e) {
          setProjects(previous);
          toast({ text: message(e), tone: "error" });
        }
      },
      syncCounts(id, taskCount, doneCount) {
        setProjects((list) => list.map((p) => (p.id === id ? { ...p, taskCount, doneCount } : p)));
      },
    }),
    [projects, loading, error, reload, repo, toast, optimistic],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
