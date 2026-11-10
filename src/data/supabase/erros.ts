import { MENSAGEM_CLIENTE_DUPLICADO } from "@/domain/cliente";
import { ErroDeConflito, ErroDeValidacao } from "@/domain/erros";
import { MENSAGEM_FERIADO_DUPLICADO } from "@/domain/prazos";
import { MENSAGEM_PROCESSO_DUPLICADO } from "@/domain/processo";

// Erros do Postgres que viram mensagens claras para a tela e para o agente.

export type ErroDoBanco = { message: string; code?: string; details?: string | null };

/** Violação de unicidade (23505) por índice: mensagem que a pessoa entende. */
const DUPLICADOS: Record<string, string> = {
  clientes_usuario_documento_idx: MENSAGEM_CLIENTE_DUPLICADO,
  processo_detalhes_usuario_cnj_idx: MENSAGEM_PROCESSO_DUPLICADO,
  feriados_unico_idx: MENSAGEM_FERIADO_DUPLICADO,
};

export function traduzirErroDoBanco(erro: ErroDoBanco): Error {
  const texto = `${erro.message} ${erro.details ?? ""}`;
  if (erro.code === "23505") {
    for (const [indice, mensagem] of Object.entries(DUPLICADOS)) if (texto.includes(indice)) return new ErroDeConflito(mensagem);
  }
  // Checks de tasks da 0005: campos que não combinam com o tipo da tarefa.
  if (erro.code === "23514" && texto.includes("tasks_prazo_fatal_so_em_prazo")) return new ErroDeValidacao("Só tarefas do tipo prazo têm prazo fatal.");
  if (erro.code === "23514" && texto.includes("tasks_audiencia_so_em_audiencia")) return new ErroDeValidacao("Local e horário só valem para audiência.");
  // Chave composta (cliente_id, user_id): o cliente não existe ou é de outra conta.
  if (erro.code === "23503" && texto.includes("projects_cliente_fk")) return new Error("Cliente não encontrado.");
  return new Error(erro.message);
}
