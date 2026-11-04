import { validarDadosProjeto } from "@/domain/projeto";
import { esquemaNovoProjeto } from "../esquemas";
import { ErroDeEntrada, lerCorpo, rotaDoUsuario } from "../rotas";

export const dynamic = "force-dynamic";
// server-only, cliente admin e AsyncLocalStorage precisam do runtime Node.js.
export const runtime = "nodejs";

export const GET = rotaDoUsuario(({ repo }) => repo.listarProjetos());

export const POST = rotaDoUsuario(async ({ repo, requisicao }) => {
  const { dados, colunas } = await lerCorpo(requisicao, esquemaNovoProjeto);
  const resultado = validarDadosProjeto(dados);
  if (!resultado.ok) throw new ErroDeEntrada(resultado.erro);
  return repo.criarProjeto(resultado.valor, colunas);
});
