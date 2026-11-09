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

export type IconeProjeto =
  | "folder"
  | "monitor"
  | "box"
  | "calendar"
  | "chart"
  | "check"
  | "gift"
  | "megaphone"
  | "star"
  | "target"
  // Ícones jurídicos (etapa 2)
  | "scales"
  | "briefcase"
  | "gavel"
  | "file";

export interface Entrega {
  id: string;
  title: string;
  done: boolean;
}

/**
 * Detalhes do caso consultivo (campanha no banco). Na tela: objective é "Pedido do cliente",
 * startsOn é "Recebido em", endsOn é "Prazo de entrega" e tipoServico é "Tipo de serviço".
 */
export interface DetalhesCampanha {
  objective: string | null;
  startsOn: string | null; // AAAA-MM-DD
  endsOn: string | null;
  /** Não aparece mais na tela; continua guardado. */
  channels: string[];
  deliverables: Entrega[];
  /** Opcional na entrada: sem ele, vale o primeiro de channels (ver validarDadosProjeto). */
  tipoServico?: string | null;
}

// Processos e clientes (etapa 2) ---------------------------------------------------

export type AreaProcesso = "civel" | "consumidor" | "trabalhista" | "previdenciario" | "familia" | "criminal" | "tributario" | "administrativo" | "outra";
export type FaseProcesso = "administrativa" | "inicial" | "instrucao" | "sentenca" | "recurso" | "execucao";
export type PoloProcesso = "autor" | "reu" | "terceiro";

export interface DetalhesProcesso {
  /** Só os 20 dígitos. */
  numeroCnj: string | null;
  tribunal: string | null;
  orgao: string | null;
  area: AreaProcesso | null;
  fase: FaseProcesso | null;
  polo: PoloProcesso | null;
  parteContraria: string | null;
  valorCausa: number | null;
  segredoJustica: boolean;
  linkAutos: string | null;
}

export type TipoCliente = "pf" | "pj";

export interface Cliente {
  id: string;
  nome: string;
  tipo: TipoCliente;
  /** CPF ou CNPJ, só os dígitos. */
  documento: string | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export type DadosCliente = Pick<Cliente, "nome" | "tipo" | "documento" | "telefone" | "email" | "observacoes">;

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
  /** Cliente do processo ou do caso consultivo. */
  clienteId: string | null;
  /** Só em processos (kind = project); null quando ainda não há detalhes. */
  processo: DetalhesProcesso | null;
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
  /** Ausente: não mexe (na atualização) ou sem cliente (na criação). */
  clienteId?: string | null;
  /** Ausente: não mexe (na atualização) ou sem detalhes (na criação). */
  processo?: DetalhesProcesso | null;
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
  /** Documento que o cliente precisa entregar (aparece em "Documentos pendentes"). */
  doCliente?: boolean;
}

export interface LinkTarefa {
  id: string;
  /** Pode ficar vazio quando a referência é só um título (ex.: "Briefing do projeto"). */
  url: string;
  title: string | null;
}

export type TipoTarefa = "prazo" | "providencia" | "audiencia";

export type RegraPrazo = "civel" | "trabalhista" | "juizado" | "penal";
export type UnidadePrazo = "uteis" | "corridos";
export type MeioIntimacao = "dje" | "portal" | "pessoal";

/** Dia (ou período) fora da contagem, com o motivo, para a memória do cálculo. */
export interface DiaExcluido {
  data: string;
  /** Último dia, quando são vários dias seguidos com o mesmo motivo. */
  ate?: string;
  motivo: string;
}

/** O que o advogado informou e o que o motor calculou. Fica em tasks.contagem. */
export interface ContagemPrazo {
  /** Data da disponibilização (DJe), da ciência (portal) ou da intimação pessoal. */
  inicio: string;
  meio: MeioIntimacao;
  dias: number;
  regra: RegraPrazo;
  unidade: UnidadePrazo;
  emDobro: boolean;
  suspenderNoRecesso: boolean;
  /** Sigla usada para os feriados (TJRS, TRT4...), ou null quando não foi identificada. */
  tribunal: string | null;
  /** Margem do prazo interno, em dias úteis antes do vencimento. */
  margem: number;
  /** Dia do começo: excluído da contagem. */
  comeco: string;
  vencimento: string;
  excluidos: DiaExcluido[];
  memoria: string;
}

export interface Tarefa {
  id: string;
  projectId: string;
  columnId: string;
  title: string;
  description: string | null;
  /** No tipo prazo, guarda o prazo interno. */
  dueOn: string | null; // AAAA-MM-DD
  tipo: TipoTarefa;
  /** Data limite (só no tipo prazo). */
  prazoFatal: string | null;
  contagem: ContagemPrazo | null;
  localAudiencia: string | null;
  /** Instante em ISO 8601 (só no tipo audiência). */
  horarioAudiencia: string | null;
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
  Partial<
    Pick<Tarefa, "description" | "dueOn" | "priority" | "labelIds" | "position" | "tipo" | "prazoFatal" | "contagem" | "localAudiencia" | "horarioAudiencia">
  >;

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
/** Lembrete criado pelo prazo ou pela audiência. */
export type LembreteAutomatico = "d-3" | "d-1" | "dia";

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
  /** D-3, D-1 ou no dia, quando foi criado pelo prazo ou pela audiência; null quando foi feito à mão. */
  automatico: LembreteAutomatico | null;
  criadoEm: string;
}

export type DadosNovoLembrete = Pick<Lembrete, "texto" | "quando"> & Partial<Pick<Lembrete, "tarefaId" | "projetoId" | "origem" | "automatico">>;

export type AlteracaoLembrete = Partial<Pick<Lembrete, "texto" | "quando" | "status" | "agendadoEm" | "enviadoEm">>;

export interface FiltroLembretes {
  status?: StatusLembrete[];
  tarefaId?: string;
  /** Só lembretes com `quando` até este instante (ISO). */
  ate?: string;
}

// Feriados, histórico de prazos e preferências ----------------------------------

export type TipoFeriado = "feriado" | "suspensao" | "expediente_reduzido";

export interface Feriado {
  id: string;
  /** null: carga geral do tribunal. Preenchido: feriado local do advogado. */
  userId: string | null;
  /** Sigla (TJRS, TRT4...). Num feriado local, null vale para todos os tribunais. */
  tribunal: string | null;
  data: string;
  /** Último dia de um período (null quando é um dia só). */
  ate: string | null;
  tipo: TipoFeriado;
  descricao: string;
  fonte: string | null;
}

export type DadosNovoFeriado = Pick<Feriado, "data" | "descricao"> & Partial<Pick<Feriado, "tribunal" | "ate" | "tipo">>;

export interface AlteracaoRegistrada {
  id: string;
  entidadeId: string;
  campo: "due_on" | "prazo_fatal";
  antes: string | null;
  depois: string | null;
  origem: OrigemLembrete;
  criadoEm: string;
}

export interface Preferencias {
  /** Dias úteis entre o prazo interno e o vencimento. */
  margemPrazoInterno: number;
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
