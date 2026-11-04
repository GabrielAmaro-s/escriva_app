import type {
  Board,
  BoardColumn,
  ColumnKind,
  Label,
  Project,
  ProjectInput,
  Task,
  TaskInput,
  TaskPatch,
  Tone,
  Workspace,
} from "@/domain/types";

/**
 * Contrato único de acesso aos dados.
 * A interface não sabe se os dados vêm do Supabase ou do navegador,
 * e é por aqui que um agente de IA também vai operar no futuro.
 */
export interface Repository {
  readonly mode: "supabase" | "local";

  listProjects(): Promise<Project[]>;
  createProject(input: ProjectInput, columns: { title: string; kind: ColumnKind }[]): Promise<Project>;
  updateProject(id: string, input: Partial<ProjectInput> & { archivedAt?: string | null }): Promise<Project>;
  deleteProject(id: string): Promise<void>;

  getBoard(projectId: string): Promise<Board | null>;
  /** Colunas, tarefas e etiquetas de todos os projetos (Visão geral e Tarefas). */
  getWorkspace(): Promise<Workspace>;

  createTask(input: TaskInput): Promise<Task>;
  updateTask(id: string, patch: TaskPatch): Promise<Task>;
  deleteTask(id: string): Promise<void>;

  createLabel(projectId: string, name: string, color: Tone): Promise<Label>;
  deleteLabel(id: string): Promise<void>;
}

export type { BoardColumn };
