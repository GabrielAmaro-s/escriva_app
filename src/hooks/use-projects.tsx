"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getRepository } from "@/data";
import type { Project, ProjectInput, ProjectStatus } from "@/domain/types";
import * as service from "@/services/projects";
import { useToast } from "@/components/ui/toast";

interface ProjectsState {
  projects: Project[];
  loading: boolean;
  error: string | null;
  create(input: ProjectInput): Promise<Project | null>;
  update(id: string, input: ProjectInput, options?: { quiet?: boolean }): Promise<Project | null>;
  setStatus(id: string, status: ProjectStatus): void;
  archive(id: string): void;
  restore(id: string): void;
  /** Remove da tela na hora e só apaga de vez se o aviso não for desfeito. */
  remove(id: string): void;
  /** Mantém o progresso dos cartões em dia quando as tarefas mudam. */
  syncCounts(counts: Map<string, { taskCount: number; doneCount: number }>): void;
  reload(): void;
}

const Ctx = createContext<ProjectsState | null>(null);

export function useProjects(): ProjectsState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProjects precisa estar dentro de ProjectsProvider");
  return ctx;
}

const message = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado. Tente de novo.");
const UNDO_MS = 5000;

const STATUS_TOAST: Record<ProjectStatus, string> = {
  active: "Projeto reativado",
  paused: "Projeto pausado",
  done: "Projeto concluído",
};

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const repo = getRepository();
  const toast = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pendingDeletes = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; run: () => void }>());

  // Ao fechar a página, conclui as exclusões que ainda esperavam o "Desfazer".
  useEffect(() => {
    const flush = () => pendingDeletes.current.forEach(({ timer, run }) => (clearTimeout(timer), run()));
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    repo
      .listProjects()
      .then((list) => {
        setProjects(list.filter((p) => !pendingDeletes.current.has(p.id)));
        setError(null);
      })
      .catch((e) => setError(message(e)))
      .finally(() => setLoading(false));
  }, [repo]);

  useEffect(reload, [reload]);

  const replace = (p: Project) => setProjects((list) => list.map((x) => (x.id === p.id ? { ...p, taskCount: x.taskCount, doneCount: x.doneCount } : x)));

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
      if (success) toast({ text: success, tone: "info", action: undo ? { label: "Desfazer", run: undo } : undefined });
      run()
        .then(replace)
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
          toast({ text: input.kind === "campaign" ? "Campanha criada" : "Projeto criado", tone: "info" });
          return p;
        } catch (e) {
          toast({ text: message(e), tone: "error" });
          return null;
        }
      },
      async update(id, input, options) {
        try {
          const p = await service.updateProject(repo, id, input);
          replace(p);
          if (!options?.quiet) toast({ text: "Alterações salvas", tone: "info" });
          return p;
        } catch (e) {
          toast({ text: message(e), tone: "error" });
          return null;
        }
      },
      setStatus(id, status) {
        optimistic(id, { status }, () => service.setProjectStatus(repo, id, status), STATUS_TOAST[status]);
      },
      archive(id) {
        optimistic(id, { archivedAt: new Date().toISOString() }, () => service.archiveProject(repo, id), "Projeto arquivado", () =>
          optimistic(id, { archivedAt: null }, () => service.restoreProject(repo, id)),
        );
      },
      restore(id) {
        optimistic(id, { archivedAt: null }, () => service.restoreProject(repo, id), "Projeto restaurado");
      },
      remove(id) {
        const index = projects.findIndex((p) => p.id === id);
        const removed = projects[index];
        if (!removed) return;
        setProjects((list) => list.filter((p) => p.id !== id));
        const run = () => {
          pendingDeletes.current.delete(id);
          service.deleteProject(repo, id).catch((e) => {
            setProjects((list) => [...list.slice(0, index), removed, ...list.slice(index)]);
            toast({ text: message(e), tone: "error" });
          });
        };
        const timer = setTimeout(run, UNDO_MS);
        pendingDeletes.current.set(id, { timer, run });
        toast({
          text: removed.kind === "campaign" ? "Campanha excluída" : "Projeto excluído",
          tone: "info",
          action: {
            label: "Desfazer",
            run: () => {
              clearTimeout(timer);
              pendingDeletes.current.delete(id);
              setProjects((list) => [...list.slice(0, index), removed, ...list.slice(index)]);
            },
          },
        });
      },
      syncCounts(counts) {
        setProjects((list) => {
          let changed = false;
          const next = list.map((p) => {
            const c = counts.get(p.id);
            if (!c || (c.taskCount === p.taskCount && c.doneCount === p.doneCount)) return p;
            changed = true;
            return { ...p, ...c };
          });
          return changed ? next : list;
        });
      },
    }),
    [projects, loading, error, reload, repo, toast, optimistic],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
