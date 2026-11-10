import type { CapturaDjen, NovaSugestaoDjen, ResultadoConsulta, StatusSugestaoDjen, SugestaoDjen } from "@/domain/djen";

/**
 * Dados da captura do DJEN de uma pessoa. Fica fora do `Repositorio` principal porque
 * só existe com Supabase: o modo local e o navegador não consultam o DJEN.
 *
 * Com a sessão do app (RLS e grants por coluna), só valem `salvarCaptura`, as leituras,
 * `apagarSugestoesPendentes` e a troca de status. O estado da consulta e as sugestões
 * novas são gravados pelo servidor, com o repositório do agente (user_id forçado).
 */
export interface RepositorioDjen {
  /** Sem linha gravada, devolve null. */
  obterCaptura(): Promise<CapturaDjen | null>;
  /** Liga, desliga ou troca a OAB. Trocar a OAB zera a última consulta boa (gatilho no banco). */
  salvarCaptura(dados: Pick<CapturaDjen, "ligada" | "numeroOab" | "ufOab" | "avisoAceitoEm">): Promise<CapturaDjen>;
  /** Estado da consulta. Só o servidor grava. */
  registrarEstadoDaConsulta(estado: Partial<{ ultimaConsultaOk: string; ultimaTentativaEm: string; tentativasNoDia: number; ultimoResultado: ResultadoConsulta }>): Promise<void>;

  /** Insere sem duplicar: um djen_id que já existe na conta é ignorado. Devolve quantas entraram. */
  inserirSugestoes(linhas: NovaSugestaoDjen[]): Promise<number>;
  /** Marca o cancelamento pelo tribunal; as pendentes viram "cancelada". Devolve quantas mudaram de status. */
  marcarCanceladas(djenIds: number[], quando: string): Promise<number>;
  listarSugestoes(filtro?: { status?: StatusSugestaoDjen[] }): Promise<SugestaoDjen[]>;
  /** Ao desligar a captura (ou trocar a OAB). Devolve quantas apagou. */
  apagarSugestoesPendentes(): Promise<number>;
}
