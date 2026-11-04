import { ehIconeProjeto, ehTom } from "@/domain/projeto";
import type { AlteracaoLembrete, AlteracaoTarefa, Coluna, DadosProjeto, DetalhesCampanha, Etiqueta, Lembrete, Projeto, RegistroAgente, Tarefa, TokenAgente } from "@/domain/tipos";

// Conversão entre linhas do banco (snake_case) e objetos de domínio.

export type LinhaProjeto = {
  id: string;
  name: string;
  description: string | null;
  kind: Projeto["kind"];
  status: Projeto["status"];
  color: string;
  icon: string | null;
  due_on: string | null;
  position: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  campaign_details: LinhaCampanha | LinhaCampanha[] | null;
};

export type LinhaCampanha = {
  objective: string | null;
  starts_on: string | null;
  ends_on: string | null;
  channels: string[];
  deliverables: DetalhesCampanha["deliverables"];
};

export type LinhaContagem = { project_id: string; task_count: number; done_count: number };

export type LinhaColuna = { id: string; project_id: string; title: string; kind: Coluna["kind"]; position: number };
export type LinhaEtiqueta = { id: string; project_id: string; name: string; color: string };

export type LinhaTarefa = {
  id: string;
  project_id: string;
  column_id: string;
  title: string;
  description: string | null;
  due_on: string | null;
  priority: Tarefa["priority"];
  label_ids: string[];
  checklist: Tarefa["checklist"];
  links: Tarefa["links"];
  completed: boolean;
  completed_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export function paraProjeto(linha: LinhaProjeto, contagem?: LinhaContagem): Projeto {
  const c = Array.isArray(linha.campaign_details) ? linha.campaign_details[0] : linha.campaign_details;
  return {
    id: linha.id,
    name: linha.name,
    description: linha.description,
    kind: linha.kind,
    status: linha.status,
    color: ehTom(linha.color) ? linha.color : "violet",
    icon: ehIconeProjeto(linha.icon) ? linha.icon : linha.kind === "campaign" ? "megaphone" : "folder",
    dueOn: linha.due_on,
    position: linha.position,
    archivedAt: linha.archived_at,
    createdAt: linha.created_at,
    updatedAt: linha.updated_at,
    campaign:
      linha.kind === "campaign" && c
        ? {
            objective: c.objective,
            startsOn: c.starts_on,
            endsOn: c.ends_on,
            channels: c.channels ?? [],
            deliverables: c.deliverables ?? [],
          }
        : null,
    taskCount: contagem?.task_count ?? 0,
    doneCount: contagem?.done_count ?? 0,
  };
}

export function deDadosProjeto(dados: Partial<DadosProjeto> & { archivedAt?: string | null }) {
  const linha: Record<string, unknown> = {};
  if (dados.name !== undefined) linha.name = dados.name;
  if (dados.description !== undefined) linha.description = dados.description;
  if (dados.kind !== undefined) linha.kind = dados.kind;
  if (dados.status !== undefined) linha.status = dados.status;
  if (dados.color !== undefined) linha.color = dados.color;
  if (dados.icon !== undefined) linha.icon = dados.icon;
  if (dados.dueOn !== undefined) linha.due_on = dados.dueOn;
  if (dados.archivedAt !== undefined) linha.archived_at = dados.archivedAt;
  return linha;
}

export function deCampanha(projetoId: string, c: DetalhesCampanha) {
  return {
    project_id: projetoId,
    objective: c.objective,
    starts_on: c.startsOn,
    ends_on: c.endsOn,
    channels: c.channels,
    deliverables: c.deliverables,
  };
}

export const paraColuna = (l: LinhaColuna): Coluna => ({
  id: l.id,
  projectId: l.project_id,
  title: l.title,
  kind: l.kind,
  position: l.position,
});

export const paraEtiqueta = (l: LinhaEtiqueta): Etiqueta => ({
  id: l.id,
  projectId: l.project_id,
  name: l.name,
  color: ehTom(l.color) ? l.color : "gray",
});

export const paraTarefa = (l: LinhaTarefa): Tarefa => ({
  id: l.id,
  projectId: l.project_id,
  columnId: l.column_id,
  title: l.title,
  description: l.description,
  dueOn: l.due_on,
  priority: l.priority,
  labelIds: l.label_ids ?? [],
  checklist: l.checklist ?? [],
  links: l.links ?? [],
  completed: l.completed,
  completedAt: l.completed_at,
  position: l.position,
  createdAt: l.created_at,
  updatedAt: l.updated_at,
});

const CAMPOS_TAREFA: Record<keyof AlteracaoTarefa, string> = {
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

export function deAlteracaoTarefa(alteracao: AlteracaoTarefa) {
  const linha: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(alteracao)) {
    const coluna = CAMPOS_TAREFA[chave as keyof AlteracaoTarefa];
    if (coluna && valor !== undefined) linha[coluna] = valor;
  }
  return linha;
}

// Tabelas novas (lembretes e agente) --------------------------------------------

export type LinhaLembrete = {
  id: string;
  tarefa_id: string | null;
  projeto_id: string | null;
  texto: string;
  quando: string;
  status: Lembrete["status"];
  origem: Lembrete["origem"];
  agendado_em: string | null;
  enviado_em: string | null;
  criado_em: string;
};

export const paraLembrete = (l: LinhaLembrete): Lembrete => ({
  id: l.id,
  tarefaId: l.tarefa_id,
  projetoId: l.projeto_id,
  texto: l.texto,
  quando: new Date(l.quando).toISOString(),
  status: l.status,
  origem: l.origem,
  agendadoEm: l.agendado_em,
  enviadoEm: l.enviado_em,
  criadoEm: l.criado_em,
});

export function deAlteracaoLembrete(a: AlteracaoLembrete) {
  const linha: Record<string, unknown> = {};
  if (a.texto !== undefined) linha.texto = a.texto;
  if (a.quando !== undefined) linha.quando = a.quando;
  if (a.status !== undefined) linha.status = a.status;
  if (a.agendadoEm !== undefined) linha.agendado_em = a.agendadoEm;
  if (a.enviadoEm !== undefined) linha.enviado_em = a.enviadoEm;
  return linha;
}

export type LinhaToken = {
  id: string;
  nome: string;
  escopo: TokenAgente["escopo"];
  expira_em: string;
  ultimo_uso_em: string | null;
  revogado_em: string | null;
  criado_em: string;
};

export const COLUNAS_TOKEN = "id, nome, escopo, expira_em, ultimo_uso_em, revogado_em, criado_em";

export const paraToken = (l: LinhaToken): TokenAgente => ({
  id: l.id,
  nome: l.nome,
  escopo: l.escopo,
  expiraEm: l.expira_em,
  ultimoUsoEm: l.ultimo_uso_em,
  revogadoEm: l.revogado_em,
  criadoEm: l.criado_em,
});

export type LinhaRegistro = {
  id: string;
  token_id: string | null;
  ferramenta: string;
  entrada: unknown;
  resultado: unknown;
  sucesso: boolean;
  desfazer: RegistroAgente["desfazer"];
  desfeito_em: string | null;
  criado_em: string;
};

export const paraRegistro = (l: LinhaRegistro): RegistroAgente => ({
  id: l.id,
  tokenId: l.token_id,
  ferramenta: l.ferramenta,
  entrada: l.entrada,
  resultado: l.resultado,
  sucesso: l.sucesso,
  desfazer: l.desfazer,
  desfeitoEm: l.desfeito_em,
  criadoEm: l.criado_em,
});
