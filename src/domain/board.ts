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

/** Cor da bandeira de prioridade (variável CSS). */
export const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: "var(--ink3)",
  medium: "var(--s-blue)",
  high: "var(--s-amber)",
  urgent: "var(--s-red)",
};

/** Cor do marcador de cada coluna. */
export const COLUMN_DOT: Record<ColumnKind, string> = {
  todo: "var(--s-gray)",
  doing: "var(--s-violet)",
  waiting: "var(--s-amber)",
  done: "var(--s-green)",
};

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

/** Cor da data de entrega: vermelho se atrasada, âmbar se é hoje. */
export function dueColor(dueOn: string, completed: boolean, today = todayIso()): string {
  if (completed) return "var(--ink3)";
  if (dueOn < today) return "var(--s-red)";
  if (dueOn === today) return "var(--s-amber)";
  return "var(--ink3)";
}

export function positionAtTop(tasks: Task[], columnId: string): number {
  const first = tasksInColumn(tasks, columnId)[0];
  return positionBetween(null, first?.position ?? null);
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function todayIso(now = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

/** "28 de nov", ou "Hoje". */
export function formatDate(iso: string, today = todayIso()): string {
  if (iso === today) return "Hoje";
  const [, m, d] = iso.split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]}`;
}

function short(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** Período de campanha: "1 dez – 15 fev 2027". O ano aparece quando não é o atual. */
export function formatRange(start: string | null, end: string | null, today = todayIso()): string {
  const year = today.slice(0, 4);
  const withYear = (iso: string) => short(iso) + (iso.slice(0, 4) !== year ? ` ${iso.slice(0, 4)}` : "");
  if (!start && !end) return "Sem período";
  if (!start) return `Até ${withYear(end!)}`;
  if (!end) return `Desde ${withYear(start)}`;
  return `${short(start)} – ${withYear(end)}`;
}

export function newId(): string {
  return crypto.randomUUID();
}
