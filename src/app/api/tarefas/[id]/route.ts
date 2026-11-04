import { esquemaAlteracaoTarefa } from "../../esquemas";
import { lerCorpo, rotaDoUsuario } from "../../rotas";

export const dynamic = "force-dynamic";

export const PATCH = rotaDoUsuario<{ id: string }>(async ({ repo, requisicao }, { id }) => repo.atualizarTarefa(id, await lerCorpo(requisicao, esquemaAlteracaoTarefa)));

export const DELETE = rotaDoUsuario<{ id: string }>(async ({ repo }, { id }) => {
  await repo.excluirTarefa(id);
});
