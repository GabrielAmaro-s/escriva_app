import type { SupabaseClient } from "@supabase/supabase-js";
import { positionBetween } from "@/domain/board";
import type { ColumnKind, Tone, ProjectInput, TaskInput, TaskPatch } from "@/domain/types";
import type { Repository } from "../repository";
import {
  type ColumnRow,
  type CountRow,
  type LabelRow,
  type ProjectRow,
  type TaskRow,
  fromCampaign,
  fromProjectInput,
  fromTaskPatch,
  toColumn,
  toLabel,
  toProject,
  toTask,
} from "./mappers";

const PROJECT_SELECT = "*, campaign_details(*)";

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export function createSupabaseRepository(sb: SupabaseClient): Repository {
  async function countsFor(ids?: string[]): Promise<Map<string, CountRow>> {
    let q = sb.from("project_task_counts").select("*");
    if (ids) q = q.in("project_id", ids);
    const rows = check(await q) as CountRow[];
    return new Map(rows.map((r) => [r.project_id, r]));
  }

  async function fetchProject(id: string) {
    const row = check(await sb.from("projects").select(PROJECT_SELECT).eq("id", id).maybeSingle()) as ProjectRow | null;
    if (!row) return null;
    const counts = await countsFor([id]);
    return toProject(row, counts.get(id));
  }

  async function saveCampaign(projectId: string, input: Partial<ProjectInput>) {
    if (input.campaign === undefined && input.kind === undefined) return;
    if (input.kind === "project" || input.campaign === null) {
      check(await sb.from("campaign_details").delete().eq("project_id", projectId));
      return;
    }
    if (input.campaign) {
      check(await sb.from("campaign_details").upsert(fromCampaign(projectId, input.campaign)));
    }
  }

  return {
    mode: "supabase",

    async listProjects() {
      const [rows, counts] = await Promise.all([
        sb.from("projects").select(PROJECT_SELECT).order("position"),
        countsFor(),
      ]);
      return (check(rows) as ProjectRow[]).map((r) => toProject(r, counts.get(r.id)));
    },

    async createProject(input: ProjectInput, columns: { title: string; kind: ColumnKind }[]) {
      const first = check(
        await sb.from("projects").select("position").order("position").limit(1),
      ) as { position: number }[];
      const row = check(
        await sb
          .from("projects")
          .insert({ ...fromProjectInput(input), position: positionBetween(null, first[0]?.position ?? null) })
          .select("id")
          .single(),
      ) as { id: string };

      check(
        await sb
          .from("board_columns")
          .insert(columns.map((c, i) => ({ project_id: row.id, title: c.title, kind: c.kind, position: (i + 1) * 1024 }))),
      );
      if (input.kind === "campaign" && input.campaign) await saveCampaign(row.id, input);

      const project = await fetchProject(row.id);
      if (!project) throw new Error("Não foi possível carregar o projeto criado.");
      return project;
    },

    async updateProject(id, input) {
      const patch = fromProjectInput(input);
      if (Object.keys(patch).length) check(await sb.from("projects").update(patch).eq("id", id));
      await saveCampaign(id, input);
      const project = await fetchProject(id);
      if (!project) throw new Error("Projeto não encontrado.");
      return project;
    },

    async deleteProject(id) {
      check(await sb.from("projects").delete().eq("id", id));
    },

    async getBoard(projectId) {
      const [project, columns, tasks, labels] = await Promise.all([
        fetchProject(projectId),
        sb.from("board_columns").select("*").eq("project_id", projectId).order("position"),
        sb.from("tasks").select("*").eq("project_id", projectId).order("position"),
        sb.from("labels").select("*").eq("project_id", projectId).order("name"),
      ]);
      if (!project) return null;
      return {
        project,
        columns: (check(columns) as ColumnRow[]).map(toColumn),
        tasks: (check(tasks) as TaskRow[]).map(toTask),
        labels: (check(labels) as LabelRow[]).map(toLabel),
      };
    },

    async getWorkspace() {
      const [columns, tasks, labels] = await Promise.all([
        sb.from("board_columns").select("*").order("position"),
        sb.from("tasks").select("*").order("position"),
        sb.from("labels").select("*").order("name"),
      ]);
      return {
        columns: (check(columns) as ColumnRow[]).map(toColumn),
        tasks: (check(tasks) as TaskRow[]).map(toTask),
        labels: (check(labels) as LabelRow[]).map(toLabel),
      };
    },

    async createTask(input: TaskInput) {
      const row = check(
        await sb
          .from("tasks")
          .insert({
            project_id: input.projectId,
            column_id: input.columnId,
            title: input.title,
            description: input.description ?? null,
            due_on: input.dueOn ?? null,
            priority: input.priority ?? "medium",
            label_ids: input.labelIds ?? [],
            position: input.position ?? 1024,
          })
          .select("*")
          .single(),
      ) as TaskRow;
      return toTask(row);
    },

    async updateTask(id, patch: TaskPatch) {
      const row = check(await sb.from("tasks").update(fromTaskPatch(patch)).eq("id", id).select("*").single()) as TaskRow;
      return toTask(row);
    },

    async deleteTask(id) {
      check(await sb.from("tasks").delete().eq("id", id));
    },

    async createLabel(projectId, name, color: Tone) {
      const row = check(
        await sb.from("labels").insert({ project_id: projectId, name, color }).select("*").single(),
      ) as LabelRow;
      return toLabel(row);
    },

    async deleteLabel(id) {
      check(await sb.from("labels").delete().eq("id", id));
    },
  };
}
