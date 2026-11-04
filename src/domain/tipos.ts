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
