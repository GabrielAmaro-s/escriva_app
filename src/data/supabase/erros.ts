import { MENSAGEM_CLIENTE_DUPLICADO } from "@/domain/cliente";
import { ErroDeConflito } from "@/domain/erros";
import { MENSAGEM_PROCESSO_DUPLICADO } from "@/domain/processo";

// Erros do Postgres que viram mensagens claras para a tela e para o agente.

export type ErroDoBanco = { message: string; code?: string; details?: string | null };

/** Violação de unicidade (23505) por índice: mensagem que a pessoa entende. */
const DUPLICADOS: Record<string, string> = {
  clientes_usuario_documento_idx: MENSAGEM_CLIENTE_DUPLICADO,
  processo_detalhes_usuario_cnj_idx: MENSAGEM_PROCESSO_DUPLICADO,
};

export function traduzirErroDoBanco(erro: ErroDoBanco): Error {
  const texto = `${erro.message} ${erro.details ?? ""}`;
  if (erro.code === "23505") {
    for (const [indice, mensagem] of Object.entries(DUPLICADOS)) if (texto.includes(indice)) return new ErroDeConflito(mensagem);
  }
  // Chave composta (cliente_id, user_id): o cliente não existe ou é de outra conta.
  if (erro.code === "23503" && texto.includes("projects_cliente_fk")) return new Error("Cliente não encontrado.");
  return new Error(erro.message);
}
