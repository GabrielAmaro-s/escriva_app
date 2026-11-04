// Tipos de domínio. Não dependem de React, Supabase ou do navegador,
// o que permite reaproveitá-los em agentes de IA ou em uma API no futuro.

export type ProjectKind = "project" | "campaign";
export type ProjectStatus = "active" | "paused" | "done";
export type ColumnKind = "todo" | "doing" | "waiting" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

/** Tons do design. Projetos usam os seis primeiros; etiquetas podem usar "gray". */
export type Tone = "violet" | "blue" | "green" | "amber" | "red" | "pink" | "gray";

export type ProjectIcon = "folder" | "monitor" | "box" | "calendar" | "chart" | "check" | "gift" | "megaphone" | "star" | "target";

export interface Deliverable {
  id: string;
  title: string;
  done: boolean;
}

export interface CampaignDetails {
  objective: string | null;
  startsOn: string | null; // AAAA-MM-DD
  endsOn: string | null;
  channels: string[];
  deliverables: Deliverable[];
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  kind: ProjectKind;
  status: ProjectStatus;
  color: Tone;
  icon: ProjectIcon;
  /** Prazo do projeto. Em campanhas o período fica em `campaign`. */
  dueOn: string | null;
  position: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  campaign: CampaignDetails | null;
  taskCount: number;
  doneCount: number;
}

export interface ProjectInput {
  name: string;
  description: string | null;
  kind: ProjectKind;
  status: ProjectStatus;
  color: Tone;
  icon: ProjectIcon;
  dueOn: string | null;
  campaign: CampaignDetails | null;
}

export interface BoardColumn {
  id: string;
  projectId: string;
  title: string;
  kind: ColumnKind;
  position: number;
}

export interface Label {
  id: string;
  projectId: string;
  name: string;
  color: Tone;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface TaskLink {
  id: string;
  /** Pode ficar vazio quando a referência é só um título (ex.: "Briefing do projeto"). */
  url: string;
  title: string | null;
}

export interface Task {
  id: string;
  projectId: string;
  columnId: string;
  title: string;
  description: string | null;
  dueOn: string | null; // AAAA-MM-DD
  priority: TaskPriority;
  labelIds: string[];
  checklist: ChecklistItem[];
  links: TaskLink[];
  completed: boolean;
  completedAt: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export type TaskInput = Pick<Task, "projectId" | "columnId" | "title"> &
  Partial<Pick<Task, "description" | "dueOn" | "priority" | "labelIds" | "position">>;

export type TaskPatch = Partial<
  Omit<Task, "id" | "projectId" | "createdAt" | "updatedAt">
>;

export interface Board {
  project: Project;
  columns: BoardColumn[];
  tasks: Task[];
  labels: Label[];
}

/** Tarefas, colunas e etiquetas de um conjunto de projetos (um quadro ou todos). */
export interface Workspace {
  columns: BoardColumn[];
  tasks: Task[];
  labels: Label[];
}
