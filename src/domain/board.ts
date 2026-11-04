import type { BoardColumn, ColumnKind, Task, TaskPatch, TaskPriority } from "./types";

export const DEFAULT_COLUMNS: { title: string; kind: ColumnKind }[] = [
  { title: "A fazer", kind: "todo" },
  { title: "Em andamento", kind: "doing" },
  { title: "Aguardando", kind: "waiting" },
  { title: "Concluído", kind: "done" },
];

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

export const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];

const GAP = 1024;

/** Posição para inserir entre dois vizinhos (posições fracionárias: um único update por movimento). */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return GAP;
  if (before === null) return (after as number) - GAP;
  if (after === null) return before + GAP;
  return (before + after) / 2;
}

export function sortByPosition<T extends { position: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.position - b.position);
}

export function tasksInColumn(tasks: Task[], columnId: string): Task[] {
  return sortByPosition(tasks.filter((t) => t.columnId === columnId));
}

export function nextPositionInColumn(tasks: Task[], columnId: string): number {
  const list = tasksInColumn(tasks, columnId);
  return positionBetween(list.at(-1)?.position ?? null, null);
}

/**
 * Regra de conclusão: a coluna "Concluído" e o campo `completed` andam juntos.
 * Ao entrar na coluna de conclusão a tarefa fica concluída; ao sair, volta a ficar aberta.
 */
export function patchForColumnChange(task: Task, target: BoardColumn): TaskPatch {
  const completed = target.kind === "done";
  if (completed === task.completed) return { columnId: target.id };
  return {
    columnId: target.id,
    completed,
    completedAt: completed ? new Date().toISOString() : null,
  };
}

/** Marcar/desmarcar como concluída move a tarefa para a coluna correspondente. */
export function patchForCompletionToggle(task: Task, columns: BoardColumn[], tasks: Task[]): TaskPatch {
  const completed = !task.completed;
  const target = completed
    ? columns.find((c) => c.kind === "done")
    : columns.find((c) => c.kind === "todo");
  if (!target) return { completed, completedAt: completed ? new Date().toISOString() : null };
  return {
    completed,
    completedAt: completed ? new Date().toISOString() : null,
    columnId: target.id,
    position: nextPositionInColumn(tasks.filter((t) => t.id !== task.id), target.id),
  };
}

export function checklistProgress(task: Pick<Task, "checklist">): { done: number; total: number } {
  return { done: task.checklist.filter((i) => i.done).length, total: task.checklist.length };
}

export type DueState = "overdue" | "today" | "soon" | "later";

export function dueState(dueOn: string, today = new Date()): DueState {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const [y, m, d] = dueOn.split("-").map(Number);
  const due = new Date(y, m - 1, d).getTime();
  const days = Math.round((due - t) / 86_400_000);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 3) return "soon";
  return "later";
}

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return shortDate.format(new Date(y, m - 1, d)).replace(".", "");
}

export function newId(): string {
  return crypto.randomUUID();
}
