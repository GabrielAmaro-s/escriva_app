import { criarCliente, listarClientes } from "@/services/clientes";
import { esquemaDadosCliente } from "../esquemas";
import { lerCorpo, rotaDoUsuario } from "../rotas";

export const dynamic = "force-dynamic";
// server-only, cliente admin e AsyncLocalStorage precisam do runtime Node.js.
export const runtime = "nodejs";

export const GET = rotaDoUsuario(({ repo }) => listarClientes(repo));

export const POST = rotaDoUsuario(async ({ repo, requisicao }) => {
  const dados = await lerCorpo(requisicao, esquemaDadosCliente);
  return criarCliente(repo, dados);
});
