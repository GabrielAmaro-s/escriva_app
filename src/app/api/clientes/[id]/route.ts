import { atualizarCliente, excluirCliente } from "@/services/clientes";
import { esquemaDadosCliente } from "../../esquemas";
import { lerCorpo, rotaDoUsuario } from "../../rotas";

export const dynamic = "force-dynamic";
// server-only, cliente admin e AsyncLocalStorage precisam do runtime Node.js.
export const runtime = "nodejs";

export const PATCH = rotaDoUsuario<{ id: string }>(async ({ repo, requisicao }, { id }) => {
  const dados = await lerCorpo(requisicao, esquemaDadosCliente);
  return atualizarCliente(repo, id, dados);
});

export const DELETE = rotaDoUsuario<{ id: string }>(async ({ repo }, { id }) => {
  await excluirCliente(repo, id);
});
