import { nextPositionInColumn } from "@/domain/board";
import type { BoardColumn, Task } from "@/domain/types";
import type { Repository } from "@/data/repository";

// Casos de uso de tarefas.

export async function addTask(
  repo: Repository,
  column: BoardColumn,
  title: string,
  existing: Task[],
): Promise<Task> {
  const clean = title.trim();
  if (!clean) throw new Error("Escreva um título para a tarefa.");
  const task = await repo.createTask({
    projectId: column.projectId,
    columnId: column.id,
    title: clean.slice(0, 200),
    position: nextPositionInColumn(existing, column.id),
  });
  if (column.kind === "done" && !task.completed) {
    return repo.updateTask(task.id, { completed: true, completedAt: new Date().toISOString() });
  }
  return task;
}
