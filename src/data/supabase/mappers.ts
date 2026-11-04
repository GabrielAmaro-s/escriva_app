import { isColorKey } from "@/domain/project";
import type {
  BoardColumn,
  CampaignDetails,
  Label,
  Project,
  ProjectInput,
  Task,
  TaskPatch,
} from "@/domain/types";

// Conversão entre linhas do banco (snake_case) e objetos de domínio (camelCase).

export type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  kind: Project["kind"];
  status: Project["status"];
  color: string;
  position: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  campaign_details: CampaignRow | CampaignRow[] | null;
};

export type CampaignRow = {
  objective: string | null;
  starts_on: string | null;
  ends_on: string | null;
  channels: string[];
  deliverables: CampaignDetails["deliverables"];
};

export type CountRow = { project_id: string; task_count: number; done_count: number };

export type ColumnRow = { id: string; project_id: string; title: string; kind: BoardColumn["kind"]; position: number };
export type LabelRow = { id: string; project_id: string; name: string; color: string };

export type TaskRow = {
  id: string;
  project_id: string;
  column_id: string;
  title: string;
  description: string | null;
  due_on: string | null;
  priority: Task["priority"];
  label_ids: string[];
  checklist: Task["checklist"];
  links: Task["links"];
  completed: boolean;
  completed_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export function toProject(row: ProjectRow, counts?: CountRow): Project {
  const c = Array.isArray(row.campaign_details) ? row.campaign_details[0] : row.campaign_details;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    kind: row.kind,
    status: row.status,
    color: isColorKey(row.color) ? row.color : "petroleo",
    position: row.position,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    campaign:
      row.kind === "campaign" && c
        ? {
            objective: c.objective,
            startsOn: c.starts_on,
            endsOn: c.ends_on,
            channels: c.channels ?? [],
            deliverables: c.deliverables ?? [],
          }
        : null,
    taskCount: counts?.task_count ?? 0,
    doneCount: counts?.done_count ?? 0,
  };
}

export function fromProjectInput(input: Partial<ProjectInput> & { archivedAt?: string | null }) {
  const row: Record<string, unknown> = {};
  if (input.name !== undefined) row.name = input.name;
  if (input.description !== undefined) row.description = input.description;
  if (input.kind !== undefined) row.kind = input.kind;
  if (input.status !== undefined) row.status = input.status;
  if (input.color !== undefined) row.color = input.color;
  if (input.archivedAt !== undefined) row.archived_at = input.archivedAt;
  return row;
}

export function fromCampaign(projectId: string, c: CampaignDetails) {
  return {
    project_id: projectId,
    objective: c.objective,
    starts_on: c.startsOn,
    ends_on: c.endsOn,
    channels: c.channels,
    deliverables: c.deliverables,
  };
}

export const toColumn = (r: ColumnRow): BoardColumn => ({
  id: r.id,
  projectId: r.project_id,
  title: r.title,
  kind: r.kind,
  position: r.position,
});

export const toLabel = (r: LabelRow): Label => ({
  id: r.id,
  projectId: r.project_id,
  name: r.name,
  color: isColorKey(r.color) ? r.color : "petroleo",
});

export const toTask = (r: TaskRow): Task => ({
  id: r.id,
  projectId: r.project_id,
  columnId: r.column_id,
  title: r.title,
  description: r.description,
  dueOn: r.due_on,
  priority: r.priority,
  labelIds: r.label_ids ?? [],
  checklist: r.checklist ?? [],
  links: r.links ?? [],
  completed: r.completed,
  completedAt: r.completed_at,
  position: r.position,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const TASK_FIELDS: Record<keyof TaskPatch, string> = {
  columnId: "column_id",
  title: "title",
  description: "description",
  dueOn: "due_on",
  priority: "priority",
  labelIds: "label_ids",
  checklist: "checklist",
  links: "links",
  completed: "completed",
  completedAt: "completed_at",
  position: "position",
};

export function fromTaskPatch(patch: TaskPatch) {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const column = TASK_FIELDS[key as keyof TaskPatch];
    if (column && value !== undefined) row[column] = value;
  }
  return row;
}
