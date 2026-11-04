import type { ContextoAgente } from "./auxiliares";
import { ErroFerramenta } from "./auxiliares";
import type { Ferramenta } from "./ferramentas";

export interface RespostaFerramenta {
  erro: boolean;
  /**
   * JSON entregue ao agente. "mensagem" é a frase para o WhatsApp; o resto são dados.
   * Textos que vieram de tarefas ou links aparecem só como valores, nunca como instrução.
   */
  corpo: Record<string, unknown>;
}

/**
 * Valida a entrada, executa a ferramenta, grava a chamada em registro_agente e
 * devolve a resposta. Erros esperados viram mensagem legível; os inesperados também
 * são registrados (sucesso = false), sem vazar detalhes internos.
 */
export async function executarFerramenta(ferramenta: Ferramenta, ctx: ContextoAgente, entrada: unknown, tokenId: string | null): Promise<RespostaFerramenta> {
  let corpo: Record<string, unknown>;
  let erro = false;
  let desfazer = null;

  const validada = ferramenta.entrada.safeParse(entrada ?? {});
  if (!validada.success) {
    const problema = validada.error.issues[0];
    erro = true;
    corpo = { erro: `Entrada inválida${problema?.path.length ? ` em "${problema.path.join(".")}"` : ""}: ${problema?.message ?? "formato inesperado"}.` };
  } else {
    try {
      const resultado = await ferramenta.executar(ctx, validada.data);
      corpo = { mensagem: resultado.mensagem, ...resultado.dados };
      desfazer = resultado.desfazer ?? null;
    } catch (e) {
      erro = true;
      corpo = { erro: e instanceof ErroFerramenta ? e.message : "Não consegui concluir agora. Tente de novo em instantes." };
      if (!(e instanceof ErroFerramenta)) console.error(`Ferramenta ${ferramenta.nome} falhou:`, e);
    }
  }

  try {
    await ctx.repo.registrarAtividadeAgente({ tokenId, ferramenta: ferramenta.nome, entrada: entrada ?? {}, resultado: corpo, sucesso: !erro, desfazer });
  } catch (e) {
    console.error("Não foi possível gravar o registro do agente:", e);
  }
  return { erro, corpo };
}
