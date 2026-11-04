import type { Coluna, Tarefa } from "@/domain/tipos";
import type { Repositorio } from "@/data/repositorio";

// Casos de uso de tarefas.

export async function adicionarTarefa(repo: Repositorio, coluna: Coluna, titulo: string, posicao: number): Promise<Tarefa> {
  const limpo = titulo.trim();
  if (!limpo) throw new Error("Escreva um título para a tarefa.");
  const tarefa = await repo.criarTarefa({
    projectId: coluna.projectId,
    columnId: coluna.id,
    title: limpo.slice(0, 200),
    position: posicao,
  });
  if (coluna.kind === "done" && !tarefa.completed) {
    return repo.atualizarTarefa(tarefa.id, { completed: true, completedAt: new Date().toISOString() });
  }
  return tarefa;
}
