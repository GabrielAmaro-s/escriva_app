import { esquemaNovaEtiqueta } from "../esquemas";
import { lerCorpo, rotaDoUsuario } from "../rotas";

export const dynamic = "force-dynamic";

export const POST = rotaDoUsuario(async ({ repo, requisicao }) => {
  const { projetoId, nome, cor } = await lerCorpo(requisicao, esquemaNovaEtiqueta);
  return repo.criarEtiqueta(projetoId, nome, cor);
});
