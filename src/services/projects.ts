import { DEFAULT_COLUMNS } from "@/domain/board";
import { validateProjectInput } from "@/domain/project";
import type { Project, ProjectInput, ProjectStatus } from "@/domain/types";
import type { Repository } from "@/data/repository";

// Casos de uso de projetos. A interface chama estas funções, nunca o repositório direto.
// Um agente de IA poderá chamar as mesmas funções.

export async function createProject(repo: Repository, input: ProjectInput): Promise<Project> {
  const result = validateProjectInput(input);
  if (!result.ok) throw new Error(result.error);
  return repo.createProject(result.value, DEFAULT_COLUMNS);
}

export async function updateProject(repo: Repository, id: string, input: ProjectInput): Promise<Project> {
  const result = validateProjectInput(input);
  if (!result.ok) throw new Error(result.error);
  return repo.updateProject(id, result.value);
}

export function setProjectStatus(repo: Repository, id: string, status: ProjectStatus) {
  return repo.updateProject(id, { status });
}

export function archiveProject(repo: Repository, id: string) {
  return repo.updateProject(id, { archivedAt: new Date().toISOString() });
}

export function restoreProject(repo: Repository, id: string) {
  return repo.updateProject(id, { archivedAt: null });
}

export function deleteProject(repo: Repository, id: string) {
  return repo.deleteProject(id);
}
