// Tipos de domínio. Não dependem de React, Supabase ou do navegador,
// o que permite reaproveitá-los no servidor, na API e no agente.
//
// Os campos das entidades (title, dueOn, projectId...) seguem os nomes das colunas
// do banco e do formato já salvo no navegador, por isso continuam como estão.

export type TipoProjeto = "project" | "campaign";
export type StatusProjeto = "active" | "paused" | "done";
export type TipoColuna = "todo" | "doing" | "waiting" | "done";
export type PrioridadeTarefa = "low" | "medium" | "high" | "urgent";

/** Tons do design. Projetos usam os seis primeiros; etiquetas podem usar "gray". */
export type Tom = "violet" | "blue" | "green" | "amber" | "red" | "pink" | "gray";

export type IconeProjeto = "folder" | "monitor" | "box" | "calendar" | "chart" | "check" | "gift" | "megaphone" | "star" | "target";

export interface Entrega {
  id: string;
  title: string;
  done: boolean;
}

export interface DetalhesCampanha {
  objective: string | null;
  startsOn: string | null; // AAAA-MM-DD
  endsOn: string | null;
  channels: string[];
  deliverables: Entrega[];
}

export interface Projeto {
  id: string;
  name: string;
  description: string | null;
  kind: TipoProjeto;
  status: StatusProjeto;
  color: Tom;
  icon: IconeProjeto;
  /** Prazo do projeto. Em campanhas o período fica em `campaign`. */
  dueOn: string | null;
  position: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  campaign: DetalhesCampanha | null;
  taskCount: number;
  doneCount: number;
}

export interface DadosProjeto {
  name: string;
  description: string | null;
  kind: TipoProjeto;
  status: StatusProjeto;
  color: Tom;
  icon: IconeProjeto;
  dueOn: string | null;
  campaign: DetalhesCampanha | null;
}

export interface Coluna {
  id: string;
  projectId: string;
  title: string;
  kind: TipoColuna;
  position: number;
}

/** Coluna a criar junto com um projeto. */
export interface DadosNovaColuna {
  title: string;
  kind: TipoColuna;
  position?: number;
}

export interface Etiqueta {
  id: string;
  projectId: string;
  name: string;
  color: Tom;
}

export interface ItemChecklist {
  id: string;
  text: string;
  done: boolean;
}

export interface LinkTarefa {
  id: string;
  /** Pode ficar vazio quando a referência é só um título (ex.: "Briefing do projeto"). */
  url: string;
  title: string | null;
}

export interface Tarefa {
  id: string;
  projectId: string;
  columnId: string;
  title: string;
  description: string | null;
  dueOn: string | null; // AAAA-MM-DD
  priority: PrioridadeTarefa;
  labelIds: string[];
  checklist: ItemChecklist[];
  links: LinkTarefa[];
  completed: boolean;
  completedAt: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export type DadosNovaTarefa = Pick<Tarefa, "projectId" | "columnId" | "title"> &
  Partial<Pick<Tarefa, "description" | "dueOn" | "priority" | "labelIds" | "position">>;

export type AlteracaoTarefa = Partial<Omit<Tarefa, "id" | "projectId" | "createdAt" | "updatedAt">>;

export interface Quadro {
  projeto: Projeto;
  colunas: Coluna[];
  tarefas: Tarefa[];
  etiquetas: Etiqueta[];
}

/** Tarefas, colunas e etiquetas de um conjunto de projetos (um quadro ou todos). */
export interface EspacoDeTrabalho {
  colunas: Coluna[];
  tarefas: Tarefa[];
  etiquetas: Etiqueta[];
}

// Lembretes e agente --------------------------------------------------------------
// Tabelas novas: os campos seguem o português das colunas (em camelCase).

export type StatusLembrete = "pendente" | "agendado" | "enviado" | "cancelado";
export type OrigemLembrete = "app" | "agente";

export interface Lembrete {
  id: string;
  tarefaId: string | null;
  projetoId: string | null;
  texto: string;
  /** Instante em ISO 8601 (UTC). */
  quando: string;
  status: StatusLembrete;
  origem: OrigemLembrete;
  agendadoEm: string | null;
  enviadoEm: string | null;
  criadoEm: string;
}

export type DadosNovoLembrete = Pick<Lembrete, "texto" | "quando"> & Partial<Pick<Lembrete, "tarefaId" | "projetoId" | "origem">>;

export type AlteracaoLembrete = Partial<Pick<Lembrete, "texto" | "quando" | "status" | "agendadoEm" | "enviadoEm">>;

export interface FiltroLembretes {
  status?: StatusLembrete[];
  tarefaId?: string;
  /** Só lembretes com `quando` até este instante (ISO). */
  ate?: string;
}

export type EscopoToken = "leitura" | "escrita";

/** Token do agente como a interface enxerga: sem o hash. */
export interface TokenAgente {
  id: string;
  nome: string;
  escopo: EscopoToken;
  expiraEm: string;
  ultimoUsoEm: string | null;
  revogadoEm: string | null;
  criadoEm: string;
}

export interface DadosNovoToken {
  nome: string;
  escopo: EscopoToken;
  hash: string;
  expiraEm: string;
}

/** Instrução para reverter o que uma ferramenta do agente fez. */
export type Desfazer =
  | { tipo: "excluir_tarefas"; ids: string[] }
  | { tipo: "restaurar_tarefas"; tarefas: { id: string; alteracao: AlteracaoTarefa }[] }
  | { tipo: "recriar_tarefa"; tarefa: Tarefa }
  | { tipo: "excluir_lembretes"; ids: string[] }
  | { tipo: "restaurar_lembrete"; id: string; alteracao: AlteracaoLembrete }
  | { tipo: "recriar_lembrete"; lembrete: Lembrete }
  | { tipo: "excluir_projeto"; id: string };

export interface RegistroAgente {
  id: string;
  tokenId: string | null;
  ferramenta: string;
  entrada: unknown;
  resultado: unknown;
  sucesso: boolean;
  desfazer: Desfazer | null;
  desfeitoEm: string | null;
  criadoEm: string;
}

export type DadosNovoRegistro = Pick<RegistroAgente, "tokenId" | "ferramenta" | "entrada" | "resultado" | "sucesso" | "desfazer">;
