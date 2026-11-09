import type {
  AlteracaoLembrete,
  AlteracaoRegistrada,
  AlteracaoTarefa,
  Cliente,
  DadosCliente,
  DadosNovaColuna,
  DadosNovaTarefa,
  DadosNovoFeriado,
  DadosNovoLembrete,
  DadosNovoRegistro,
  DadosNovoToken,
  DadosProjeto,
  EspacoDeTrabalho,
  Etiqueta,
  Feriado,
  FiltroLembretes,
  Lembrete,
  Preferencias,
  Projeto,
  Quadro,
  RegistroAgente,
  Tarefa,
  TokenAgente,
  Tom,
} from "@/domain/tipos";

/**
 * Contrato único de acesso aos dados de uma pessoa.
 * A interface não sabe se os dados vêm do Supabase, da API ou do navegador,
 * e é por aqui que o agente também opera (com criarRepositorioDoAgente).
 */
export interface Repositorio {
  readonly modo: "supabase" | "local" | "http";

  /** Os detalhes do processo e o cliente vão junto com o projeto (como os da campanha). */
  listarProjetos(): Promise<Projeto[]>;
  criarProjeto(dados: DadosProjeto, colunas: DadosNovaColuna[]): Promise<Projeto>;
  atualizarProjeto(id: string, dados: Partial<DadosProjeto> & { archivedAt?: string | null }): Promise<Projeto>;
  excluirProjeto(id: string): Promise<void>;

  obterQuadro(projetoId: string): Promise<Quadro | null>;
  /** Colunas, tarefas e etiquetas de todos os projetos (Visão geral e Tarefas). */
  obterEspacoDeTrabalho(): Promise<EspacoDeTrabalho>;

  criarTarefa(dados: DadosNovaTarefa): Promise<Tarefa>;
  atualizarTarefa(id: string, alteracao: AlteracaoTarefa): Promise<Tarefa>;
  excluirTarefa(id: string): Promise<void>;

  criarEtiqueta(projetoId: string, nome: string, cor: Tom): Promise<Etiqueta>;
  excluirEtiqueta(id: string): Promise<void>;

  // Clientes. CPF/CNPJ repetido na conta lança ErroDeConflito; excluir deixa os processos sem cliente.
  listarClientes(): Promise<Cliente[]>;
  criarCliente(dados: DadosCliente): Promise<Cliente>;
  atualizarCliente(id: string, dados: Partial<DadosCliente>): Promise<Cliente>;
  excluirCliente(id: string): Promise<void>;

  // Lembretes
  listarLembretes(filtro?: FiltroLembretes): Promise<Lembrete[]>;
  criarLembrete(dados: DadosNovoLembrete): Promise<Lembrete>;
  atualizarLembrete(id: string, alteracao: AlteracaoLembrete): Promise<Lembrete>;
  excluirLembrete(id: string): Promise<void>;

  // Feriados: a carga geral dos tribunais (só leitura) e os feriados locais da pessoa.
  // Feriado local repetido na mesma data lança ErroDeConflito.
  listarFeriados(): Promise<Feriado[]>;
  criarFeriado(dados: DadosNovoFeriado): Promise<Feriado>;
  excluirFeriado(id: string): Promise<void>;

  /** Histórico do prazo interno e do prazo fatal de uma tarefa, do mais novo para o mais antigo. */
  listarAlteracoesDaTarefa(tarefaId: string): Promise<AlteracaoRegistrada[]>;

  /** Sem linha gravada, devolve os padrões. */
  obterPreferencias(): Promise<Preferencias>;
  salvarPreferencias(preferencias: Preferencias): Promise<Preferencias>;

  // Tokens do agente (o hash é calculado no servidor, em services/tokens.ts)
  listarTokensAgente(): Promise<TokenAgente[]>;
  criarTokenAgente(dados: DadosNovoToken): Promise<TokenAgente>;
  atualizarTokenAgente(id: string, alteracao: { revogadoEm?: string; ultimoUsoEm?: string }): Promise<void>;

  // Registro do que o agente fez e último sinal de vida
  listarRegistroAgente(limite: number): Promise<RegistroAgente[]>;
  obterRegistroAgente(id: string): Promise<RegistroAgente | null>;
  registrarAtividadeAgente(dados: DadosNovoRegistro): Promise<RegistroAgente>;
  marcarRegistroDesfeito(id: string, quando: string): Promise<void>;
  obterHeartbeatAgente(): Promise<string | null>;
  registrarHeartbeatAgente(quando: string): Promise<void>;
}
