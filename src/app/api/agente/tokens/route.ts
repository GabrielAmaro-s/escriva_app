import { obterAmbienteServidor } from "@/config/ambiente-servidor";
import { gerarToken } from "@/services/tokens";
import { esquemaNovoToken } from "../../esquemas";
import { lerCorpo, rotaDoUsuario } from "../../rotas";

export const dynamic = "force-dynamic";
// server-only, cliente admin e AsyncLocalStorage precisam do runtime Node.js.
export const runtime = "nodejs";

export const GET = rotaDoUsuario(({ repo }) => repo.listarTokensAgente());

/** Devolve o token em texto puro uma única vez. Depois disso só existe o hash. */
export const POST = rotaDoUsuario(async ({ repo, requisicao }) => {
  const dados = await lerCorpo(requisicao, esquemaNovoToken);
  const { segredoTokens, validadeTokenDias } = obterAmbienteServidor();
  return gerarToken(repo, dados, { segredo: segredoTokens ?? "", validadeDias: validadeTokenDias });
});
