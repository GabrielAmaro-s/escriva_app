import { newId, positionBetween } from "@/domain/board";
import type {
  Board,
  BoardColumn,
  CampaignDetails,
  ColumnKind,
  Label,
  Project,
  ProjectInput,
  Task,
  TaskInput,
  TaskPatch,
  Tone,
} from "@/domain/types";
import type { Repository } from "../repository";
import { seedStore } from "./seed";

/**
 * Repositório no navegador (localStorage). Usado quando o Supabase não está
 * configurado, para experimentar o app sem backend.
 */

const KEY = "myplan:v2";

type StoredProject = Omit<Project, "campaign" | "taskCount" | "doneCount">;

export interface Store {
  projects: StoredProject[];
  campaigns: Record<string, CampaignDetails>;
  columns: BoardColumn[];
  labels: Label[];
  tasks: Task[];
}

function load(): Store {
  if (typeof window === "undefined") return { projects: [], campaigns: {}, columns: [], labels: [], tasks: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    // dados corrompidos: recomeça com o exemplo
  }
  const seeded = seedStore();
  save(seeded);
  return seeded;
}

function save(store: Store) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // sem armazenamento disponível: segue em memória
  }
}

function hydrate(store: Store, p: StoredProject): Project {
  const tasks = store.tasks.filter((t) => t.projectId === p.id);
  return {
    ...p,
    campaign: p.kind === "campaign" ? store.campaigns[p.id] ?? null : null,
    taskCount: tasks.length,
    doneCount: tasks.filter((t) => t.completed).length,
  };
}

const now = () => new Date().toISOString();

export function createLocalRepository(): Repository {
  let store: Store | null = null;
  const db = () => (store ??= load());
  const commit = () => save(db());

  return {
    mode: "local",

    async listProjects() {
      const s = db();
      return structuredClone([...s.projects].sort((a, b) => a.position - b.position).map((p) => hydrate(s, p)));
    },

    async createProject(input: ProjectInput, columns: { title: string; kind: ColumnKind }[]) {
      const s = db();
      const id = newId();
      const first = Math.min(0, ...s.projects.map((p) => p.position));
      const project: StoredProject = {
        id,
        name: input.name,
        description: input.description,
        kind: input.kind,
        status: input.status,
        color: input.color,
        icon: input.icon,
        dueOn: input.dueOn,
        position: positionBetween(null, s.projects.length ? first : null),
        archivedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };
      s.projects.push(project);
      if (input.kind === "campaign" && input.campaign) s.campaigns[id] = structuredClone(input.campaign);
      columns.forEach((c, i) =>
        s.columns.push({ id: newId(), projectId: id, title: c.title, kind: c.kind, position: (i + 1) * 1024 }),
      );
      commit();
      return structuredClone(hydrate(s, project));
    },

    async updateProject(id, input) {
      const s = db();
      const p = s.projects.find((x) => x.id === id);
      if (!p) throw new Error("Projeto não encontrado.");
      const { campaign, ...rest } = input;
      Object.assign(p, rest, { updatedAt: now() });
      if (campaign !== undefined) {
        if (campaign && p.kind === "campaign") s.campaigns[id] = structuredClone(campaign);
        else delete s.campaigns[id];
      }
      if (p.kind !== "campaign") delete s.campaigns[id];
      commit();
      return structuredClone(hydrate(s, p));
    },

    async deleteProject(id) {
      const s = db();
      s.projects = s.projects.filter((p) => p.id !== id);
      s.columns = s.columns.filter((c) => c.projectId !== id);
      s.labels = s.labels.filter((l) => l.projectId !== id);
      s.tasks = s.tasks.filter((t) => t.projectId !== id);
      delete s.campaigns[id];
      commit();
    },

    async getBoard(projectId): Promise<Board | null> {
      const s = db();
      const p = s.projects.find((x) => x.id === projectId);
      if (!p) return null;
      return structuredClone({
        project: hydrate(s, p),
        columns: s.columns.filter((c) => c.projectId === projectId),
        tasks: s.tasks.filter((t) => t.projectId === projectId),
        labels: s.labels.filter((l) => l.projectId === projectId),
      });
    },

    async getWorkspace() {
      const s = db();
      return structuredClone({ columns: s.columns, tasks: s.tasks, labels: s.labels });
    },

    async createTask(input: TaskInput) {
      const s = db();
      const column = s.columns.find((c) => c.id === input.columnId);
      const completed = column?.kind === "done";
      const task: Task = {
        id: newId(),
        projectId: input.projectId,
        columnId: input.columnId,
        title: input.title,
        description: input.description ?? null,
        dueOn: input.dueOn ?? null,
        priority: input.priority ?? "medium",
        labelIds: input.labelIds ?? [],
        checklist: [],
        links: [],
        completed,
        completedAt: completed ? now() : null,
        position: input.position ?? 1024,
        createdAt: now(),
        updatedAt: now(),
      };
      s.tasks.push(task);
      commit();
      return structuredClone(task);
    },

    async updateTask(id, patch: TaskPatch) {
      const s = db();
      const t = s.tasks.find((x) => x.id === id);
      if (!t) throw new Error("Tarefa não encontrada.");
      Object.assign(t, structuredClone(patch), { updatedAt: now() });
      commit();
      return structuredClone(t);
    },

    async deleteTask(id) {
      const s = db();
      s.tasks = s.tasks.filter((t) => t.id !== id);
      commit();
    },

    async createLabel(projectId, name, color: Tone) {
      const s = db();
      const label: Label = { id: newId(), projectId, name, color };
      s.labels.push(label);
      commit();
      return label;
    },

    async deleteLabel(id) {
      const s = db();
      s.labels = s.labels.filter((l) => l.id !== id);
      s.tasks.forEach((t) => (t.labelIds = t.labelIds.filter((l) => l !== id)));
      commit();
    },
  };
}
