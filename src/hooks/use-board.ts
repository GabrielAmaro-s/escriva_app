"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRepository } from "@/data";
import { patchForColumnChange, patchForCompletionToggle } from "@/domain/board";
import type { Board, BoardColumn, ColorKey, Label, Task, TaskPatch } from "@/domain/types";
import { addTask as addTaskService } from "@/services/tasks";
import { useToast } from "@/components/ui/toast";
import { useProjects } from "./use-projects";

const message = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado. Tente de novo.");

export function useBoard(projectId: string) {
  const repo = getRepository();
  const toast = useToast();
  const { syncCounts, projects } = useProjects();
  const [board, setBoard] = useState<Board | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const queue = useRef(new Map<string, Promise<unknown>>());

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    repo
      .getBoard(projectId)
      .then((b) => {
        if (!alive) return;
        if (!b) return setStatus("missing");
        setBoard(b);
        setTasks(b.tasks);
        setLabels(b.labels);
        setStatus("ready");
      })
      .catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
    };
  }, [projectId, repo]);

  // Progresso dos cartões da página inicial acompanha o quadro.
  useEffect(() => {
    if (status === "ready") syncCounts(projectId, tasks.length, tasks.filter((t) => t.completed).length);
  }, [tasks, status, projectId, syncCounts]);

  // Dados do projeto editados pelo menu (nome, cor, campanha) vêm do store global.
  const project = projects.find((p) => p.id === projectId) ?? board?.project ?? null;
  const columns = board?.columns ?? [];

  const pending = useRef(new Map<string, { patch: TaskPatch; rollback: Task | undefined; timer: ReturnType<typeof setTimeout> }>());

  /** Envia o que estiver acumulado para uma tarefa, em série, para não chegar fora de ordem. */
  const flush = useCallback(
    (id: string) => {
      const entry = pending.current.get(id);
      if (!entry) return;
      clearTimeout(entry.timer);
      pending.current.delete(id);
      const prev = queue.current.get(id) ?? Promise.resolve();
      const next = prev
        .then(() => repo.updateTask(id, entry.patch))
        .catch((e) => {
          if (entry.rollback) setTasks((list) => list.map((t) => (t.id === id ? entry.rollback! : t)));
          toast({ text: message(e), tone: "error" });
        });
      queue.current.set(id, next);
    },
    [repo, toast],
  );

  /** Junta edições em sequência (digitação no checklist, por exemplo) numa única gravação. */
  const persist = useCallback(
    (id: string, patch: TaskPatch, rollback: Task | undefined) => {
      const entry = pending.current.get(id);
      if (entry) clearTimeout(entry.timer);
      pending.current.set(id, {
        patch: { ...entry?.patch, ...patch },
        rollback: entry?.rollback ?? rollback,
        timer: setTimeout(() => flush(id), 350),
      });
    },
    [flush],
  );

  useEffect(() => {
    const flushAll = () => [...pending.current.keys()].forEach(flush);
    window.addEventListener("pagehide", flushAll);
    return () => {
      window.removeEventListener("pagehide", flushAll);
      flushAll();
    };
  }, [flush]);

  const updateTask = useCallback(
    (id: string, patch: TaskPatch) => {
      let before: Task | undefined;
      setTasks((list) =>
        list.map((t) => {
          if (t.id !== id) return t;
          before = t;
          return { ...t, ...patch };
        }),
      );
      persist(id, patch, before);
    },
    [persist],
  );

  const moveTask = useCallback(
    (id: string, column: BoardColumn, position: number) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      updateTask(id, { ...patchForColumnChange(task, column), position });
    },
    [tasks, updateTask],
  );

  const toggleComplete = useCallback(
    (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (task) updateTask(id, patchForCompletionToggle(task, columns, tasks));
    },
    [tasks, columns, updateTask],
  );

  const addTask = useCallback(
    async (column: BoardColumn, title: string) => {
      try {
        const task = await addTaskService(repo, column, title, tasks);
        setTasks((list) => [...list, task]);
        return task;
      } catch (e) {
        toast({ text: message(e), tone: "error" });
        return null;
      }
    },
    [repo, tasks, toast],
  );

  const deleteTask = useCallback(
    (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      const entry = pending.current.get(id);
      if (entry) clearTimeout(entry.timer);
      pending.current.delete(id);
      setTasks((list) => list.filter((t) => t.id !== id));
      repo
        .deleteTask(id)
        .then(() => toast({ text: "Tarefa excluída.", tone: "info" }))
        .catch((e) => {
          setTasks((list) => [...list, task]);
          toast({ text: message(e), tone: "error" });
        });
    },
    [repo, tasks, toast],
  );

  const createLabel = useCallback(
    async (name: string, color: ColorKey) => {
      try {
        const label = await repo.createLabel(projectId, name.trim().slice(0, 40), color);
        setLabels((l) => [...l, label]);
        return label;
      } catch (e) {
        toast({ text: message(e), tone: "error" });
        return null;
      }
    },
    [repo, projectId, toast],
  );

  const deleteLabel = useCallback(
    (id: string) => {
      setLabels((l) => l.filter((x) => x.id !== id));
      setTasks((list) => list.map((t) => (t.labelIds.includes(id) ? { ...t, labelIds: t.labelIds.filter((l) => l !== id) } : t)));
      repo.deleteLabel(id).catch((e) => toast({ text: message(e), tone: "error" }));
    },
    [repo, toast],
  );

  const labelsById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);

  return {
    status,
    project,
    columns,
    tasks,
    setTasks,
    labels,
    labelsById,
    updateTask,
    moveTask,
    toggleComplete,
    addTask,
    deleteTask,
    createLabel,
    deleteLabel,
  };
}

export type BoardApi = ReturnType<typeof useBoard>;
