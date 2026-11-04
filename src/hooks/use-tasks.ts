"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRepository } from "@/data";
import { patchForColumnChange, patchForCompletionToggle, positionAtTop, nextPositionInColumn } from "@/domain/board";
import { PROJECT_TONES } from "@/domain/project";
import type { BoardColumn, Label, Task, TaskPatch } from "@/domain/types";
import { addTask as addTaskService } from "@/services/tasks";
import { useToast } from "@/components/ui/toast";
import { useProjects } from "./use-projects";

const message = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado. Tente de novo.");
const UNDO_MS = 5000;

/**
 * Estado das tarefas com atualização otimista.
 * Com `projectId` carrega um quadro; sem ele, as tarefas de todos os projetos.
 */
export function useTasks(projectId?: string) {
  const repo = getRepository();
  const toast = useToast();
  const { syncCounts } = useProjects();
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const queue = useRef(new Map<string, Promise<unknown>>());
  const pending = useRef(new Map<string, { patch: TaskPatch; rollback: Task | undefined; timer: ReturnType<typeof setTimeout> }>());
  const pendingDeletes = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; run: () => void }>());

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    const load = projectId
      ? repo.getBoard(projectId).then((b) => (b ? { columns: b.columns, tasks: b.tasks, labels: b.labels } : null))
      : repo.getWorkspace();
    load
      .then((w) => {
        if (!alive) return;
        if (!w) return setStatus("missing");
        setColumns(w.columns);
        setTasks(w.tasks);
        setLabels(w.labels);
        setStatus("ready");
      })
      .catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
    };
  }, [projectId, repo]);

  // O progresso dos projetos acompanha as tarefas.
  useEffect(() => {
    if (status !== "ready") return;
    const counts = new Map<string, { taskCount: number; doneCount: number }>();
    if (projectId) counts.set(projectId, { taskCount: 0, doneCount: 0 });
    for (const t of tasks) {
      const c = counts.get(t.projectId) ?? { taskCount: 0, doneCount: 0 };
      c.taskCount += 1;
      if (t.completed) c.doneCount += 1;
      counts.set(t.projectId, c);
    }
    syncCounts(counts);
  }, [tasks, status, projectId, syncCounts]);

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

  /** Junta edições em sequência (digitação, por exemplo) numa única gravação. */
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
    const flushAll = () => {
      [...pending.current.keys()].forEach(flush);
      pendingDeletes.current.forEach(({ timer, run }) => (clearTimeout(timer), run()));
    };
    window.addEventListener("pagehide", flushAll);
    return () => {
      window.removeEventListener("pagehide", flushAll);
      flushAll();
    };
  }, [flush]);

  const columnsOf = useCallback((pid: string) => columns.filter((c) => c.projectId === pid).sort((a, b) => a.position - b.position), [columns]);
  const labelsOf = useCallback((pid: string) => labels.filter((l) => l.projectId === pid), [labels]);
  const labelsById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);

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
    (id: string, column: BoardColumn, position?: number) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      const changedColumn = task.columnId !== column.id;
      updateTask(id, {
        ...patchForColumnChange(task, column),
        position: position ?? nextPositionInColumn(tasks.filter((t) => t.id !== id), column.id),
      });
      if (changedColumn) toast({ text: `Movida para “${column.title}”`, tone: "info" });
    },
    [tasks, updateTask, toast],
  );

  /** Alterna entre concluída e aberta, movendo para a coluna correspondente. */
  const toggleComplete = useCallback(
    (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (task) updateTask(id, patchForCompletionToggle(task, columnsOf(task.projectId), tasks));
    },
    [tasks, columnsOf, updateTask],
  );

  const addTask = useCallback(
    async (column: BoardColumn, title: string) => {
      try {
        const task = await addTaskService(repo, column, title, positionAtTop(tasks, column.id));
        setTasks((list) => [...list, task]);
        return task;
      } catch (e) {
        toast({ text: message(e), tone: "error" });
        return null;
      }
    },
    [repo, tasks, toast],
  );

  const duplicateTask = useCallback(
    async (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      try {
        const copy = await repo.createTask({
          projectId: task.projectId,
          columnId: task.columnId,
          title: `${task.title} (cópia)`.slice(0, 200),
          description: task.description,
          dueOn: task.dueOn,
          priority: task.priority,
          labelIds: task.labelIds,
          position: task.position + 0.5,
        });
        const full = await repo.updateTask(copy.id, {
          checklist: task.checklist,
          links: task.links,
          completed: task.completed,
          completedAt: task.completedAt,
        });
        setTasks((list) => [...list, full]);
        toast({ text: "Tarefa duplicada", tone: "info" });
      } catch (e) {
        toast({ text: message(e), tone: "error" });
      }
    },
    [repo, tasks, toast],
  );

  /** Some da tela na hora; só apaga de vez se o aviso não for desfeito. */
  const deleteTask = useCallback(
    (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      const entry = pending.current.get(id);
      if (entry) clearTimeout(entry.timer);
      pending.current.delete(id);
      setTasks((list) => list.filter((t) => t.id !== id));
      const run = () => {
        pendingDeletes.current.delete(id);
        repo.deleteTask(id).catch((e) => {
          setTasks((list) => [...list, task]);
          toast({ text: message(e), tone: "error" });
        });
      };
      const timer = setTimeout(run, UNDO_MS);
      pendingDeletes.current.set(id, { timer, run });
      toast({
        text: "Tarefa excluída",
        tone: "info",
        action: {
          label: "Desfazer",
          run: () => {
            clearTimeout(timer);
            pendingDeletes.current.delete(id);
            setTasks((list) => [...list, task]);
          },
        },
      });
    },
    [repo, tasks, toast],
  );

  const createLabel = useCallback(
    async (pid: string, name: string) => {
      const clean = name.trim().slice(0, 40);
      if (!clean) return null;
      const existing = labels.find((l) => l.projectId === pid && l.name.toLowerCase() === clean.toLowerCase());
      if (existing) return existing;
      try {
        const count = labels.filter((l) => l.projectId === pid).length;
        const label = await repo.createLabel(pid, clean, [...PROJECT_TONES, "gray" as const][count % 7]);
        setLabels((l) => [...l, label]);
        return label;
      } catch (e) {
        toast({ text: message(e), tone: "error" });
        return null;
      }
    },
    [repo, labels, toast],
  );

  return {
    status,
    tasks,
    columns,
    labels,
    labelsById,
    columnsOf,
    labelsOf,
    updateTask,
    moveTask,
    toggleComplete,
    addTask,
    duplicateTask,
    deleteTask,
    createLabel,
  };
}

export type TasksApi = ReturnType<typeof useTasks>;
