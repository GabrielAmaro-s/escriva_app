import type { CampaignDetails, Project, ProjectIcon, ProjectInput, ProjectStatus, Tone } from "./types";

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Ativo",
  paused: "Pausado",
  done: "Concluído",
};

/** Tom do selo de status. */
export const STATUS_TONE: Record<ProjectStatus, Tone> = {
  active: "green",
  paused: "amber",
  done: "blue",
};

export const PROJECT_TONES: Tone[] = ["violet", "blue", "green", "amber", "red", "pink"];
const ALL_TONES: Tone[] = [...PROJECT_TONES, "gray"];

export const TONE_NAME: Record<Tone, string> = {
  violet: "Violeta",
  blue: "Azul",
  green: "Verde",
  amber: "Âmbar",
  red: "Vermelho",
  pink: "Rosa",
  gray: "Cinza",
};

export const PROJECT_ICONS: ProjectIcon[] = ["folder", "monitor", "box", "calendar", "chart", "check", "gift", "megaphone", "star", "target"];

export const CHANNEL_SUGGESTIONS = ["Instagram", "YouTube", "Ads", "E-mail", "LinkedIn", "Blog"];

export function isTone(value: unknown): value is Tone {
  return typeof value === "string" && (ALL_TONES as string[]).includes(value);
}

export function isProjectIcon(value: unknown): value is ProjectIcon {
  return typeof value === "string" && (PROJECT_ICONS as string[]).includes(value);
}

export function progressOf(project: Pick<Project, "taskCount" | "doneCount">): number {
  if (project.taskCount === 0) return 0;
  return Math.round((project.doneCount / project.taskCount) * 100);
}

/** Data final que vale para o projeto: prazo do projeto ou fim da campanha. */
export function deadlineOf(p: Pick<Project, "kind" | "dueOn" | "campaign">): string | null {
  return p.kind === "campaign" ? p.campaign?.endsOn ?? p.dueOn : p.dueOn;
}

export type ProjectFilter = "all" | ProjectStatus | "archived";

export function filterProjects(projects: Project[], filter: ProjectFilter, query = ""): Project[] {
  const q = query.trim().toLowerCase();
  const matches = (p: Project) => !q || `${p.name} ${p.description ?? ""}`.toLowerCase().includes(q);
  if (filter === "archived") return projects.filter((p) => p.archivedAt && matches(p));
  return projects.filter((p) => !p.archivedAt && (filter === "all" || p.status === filter) && matches(p));
}

export function emptyCampaign(): CampaignDetails {
  return { objective: null, startsOn: null, endsOn: null, channels: [], deliverables: [] };
}

export function emptyProjectInput(kind: Project["kind"] = "project"): ProjectInput {
  return {
    name: "",
    description: null,
    kind,
    status: "active",
    color: kind === "campaign" ? "red" : "violet",
    icon: kind === "campaign" ? "megaphone" : "folder",
    dueOn: null,
    campaign: kind === "campaign" ? emptyCampaign() : null,
  };
}

export function toProjectInput(p: Project): ProjectInput {
  return {
    name: p.name,
    description: p.description,
    kind: p.kind,
    status: p.status,
    color: p.color,
    icon: p.icon,
    dueOn: p.dueOn,
    campaign: p.campaign,
  };
}

/** Normaliza e valida a entrada antes de chegar ao repositório. */
export function validateProjectInput(
  input: ProjectInput,
): { ok: true; value: ProjectInput } | { ok: false; error: string } {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Dê um nome para continuar." };
  if (name.length > 120) return { ok: false, error: "O nome pode ter até 120 caracteres." };

  let campaign: CampaignDetails | null = null;
  if (input.kind === "campaign") {
    const c = input.campaign ?? emptyCampaign();
    if (c.startsOn && c.endsOn && c.endsOn < c.startsOn) {
      return { ok: false, error: "A data de fim precisa ser depois do início." };
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
      dueOn: input.kind === "campaign" ? null : input.dueOn || null,
      campaign,
    },
  };
}
