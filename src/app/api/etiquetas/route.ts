import { esquemaNovaEtiqueta } from "../esquemas";
import { lerCorpo, rotaDoUsuario } from "../rotas";

export const dynamic = "force-dynamic";
// server-only, cliente admin e AsyncLocalStorage precisam do runtime Node.js.
export const runtime = "nodejs";

export const POST = rotaDoUsuario(async ({ repo, requisicao }) => {
  const { projetoId, nome, cor } = await lerCorpo(requisicao, esquemaNovaEtiqueta);
  return repo.criarEtiqueta(projetoId, nome, cor);
});
