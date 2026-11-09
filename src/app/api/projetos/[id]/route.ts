import { validarDetalhesProcesso } from "@/domain/processo";
import { esquemaAlteracaoProjeto } from "../../esquemas";
import { ErroDeEntrada, lerCorpo, rotaDoUsuario } from "../../rotas";

export const dynamic = "force-dynamic";
// server-only, cliente admin e AsyncLocalStorage precisam do runtime Node.js.
export const runtime = "nodejs";

export const PATCH = rotaDoUsuario<{ id: string }>(async ({ repo, requisicao }, { id }) => {
  const alteracao = await lerCorpo(requisicao, esquemaAlteracaoProjeto);
  if (alteracao.processo) {
    const processo = validarDetalhesProcesso(alteracao.processo);
    if (!processo.ok) throw new ErroDeEntrada(processo.erro);
    alteracao.processo = processo.valor;
  }
  return repo.atualizarProjeto(id, alteracao);
});

export const DELETE = rotaDoUsuario<{ id: string }>(async ({ repo }, { id }) => {
  await repo.excluirProjeto(id);
});
