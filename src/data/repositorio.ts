import type {
  AlteracaoTarefa,
  DadosNovaColuna,
  DadosNovaTarefa,
  DadosProjeto,
  EspacoDeTrabalho,
  Etiqueta,
  Projeto,
  Quadro,
  Tarefa,
  Tom,
} from "@/domain/tipos";

/**
 * Contrato único de acesso aos dados.
 * A interface não sabe se os dados vêm do Supabase, da API ou do navegador,
 * e é por aqui que o agente também opera.
 */
export interface Repositorio {
  readonly modo: "supabase" | "local" | "http";

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
}
