import { esquemaAlteracaoProjeto } from "../../esquemas";
import { lerCorpo, rotaDoUsuario } from "../../rotas";

export const dynamic = "force-dynamic";
// server-only, cliente admin e AsyncLocalStorage precisam do runtime Node.js.
export const runtime = "nodejs";

export const PATCH = rotaDoUsuario<{ id: string }>(async ({ repo, requisicao }, { id }) => {
  const alteracao = await lerCorpo(requisicao, esquemaAlteracaoProjeto);
  return repo.atualizarProjeto(id, alteracao);
});

export const DELETE = rotaDoUsuario<{ id: string }>(async ({ repo }, { id }) => {
  await repo.excluirProjeto(id);
});
