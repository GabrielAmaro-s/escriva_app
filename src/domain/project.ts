import type { CampaignDetails, ColorKey, Project, ProjectInput, ProjectStatus } from "./types";

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Ativo",
  paused: "Pausado",
  done: "Concluído",
};

export const COLOR_KEYS: ColorKey[] = [
  "petroleo",
  "salvia",
  "ceu",
  "lavanda",
  "ameixa",
  "rosa",
  "areia",
  "grafite",
];

export const COLOR_NAME: Record<ColorKey, string> = {
  petroleo: "Petróleo",
  salvia: "Sálvia",
  ceu: "Céu",
  lavanda: "Lavanda",
  ameixa: "Ameixa",
  rosa: "Rosa",
  areia: "Areia",
  grafite: "Grafite",
};

export function isColorKey(value: unknown): value is ColorKey {
  return typeof value === "string" && (COLOR_KEYS as string[]).includes(value);
}

export function progressOf(project: Pick<Project, "taskCount" | "doneCount">): number {
  if (project.taskCount === 0) return 0;
  return Math.round((project.doneCount / project.taskCount) * 100);
}

export type ProjectFilter = "all" | ProjectStatus | "archived";

export function filterProjects(projects: Project[], filter: ProjectFilter): Project[] {
  if (filter === "archived") return projects.filter((p) => p.archivedAt);
  const visible = projects.filter((p) => !p.archivedAt);
  if (filter === "all") return visible;
  return visible.filter((p) => p.status === filter);
}

export function emptyCampaign(): CampaignDetails {
  return { objective: null, startsOn: null, endsOn: null, channels: [], deliverables: [] };
}

export function emptyProjectInput(): ProjectInput {
  return {
    name: "",
    description: null,
    kind: "project",
    status: "active",
    color: "petroleo",
    campaign: null,
  };
}

export function toProjectInput(p: Project): ProjectInput {
  return {
    name: p.name,
    description: p.description,
    kind: p.kind,
    status: p.status,
    color: p.color,
    campaign: p.campaign,
  };
}

/** Normaliza e valida a entrada antes de chegar ao repositório. */
export function validateProjectInput(input: ProjectInput): { ok: true; value: ProjectInput } | { ok: false; error: string } {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Dê um nome ao projeto." };
  if (name.length > 120) return { ok: false, error: "O nome pode ter até 120 caracteres." };

  let campaign: CampaignDetails | null = null;
  if (input.kind === "campaign") {
    const c = input.campaign ?? emptyCampaign();
    if (c.startsOn && c.endsOn && c.endsOn < c.startsOn) {
      return { ok: false, error: "A data de término precisa ser depois do início." };
    }
    campaign = {
      objective: c.objective?.trim() || null,
      startsOn: c.startsOn || null,
      endsOn: c.endsOn || null,
      channels: c.channels.map((ch) => ch.trim()).filter(Boolean),
      deliverables: c.deliverables.filter((d) => d.title.trim()),
    };
  }

  return {
    ok: true,
    value: {
      ...input,
      name,
      description: input.description?.trim() || null,
      campaign,
    },
  };
}
