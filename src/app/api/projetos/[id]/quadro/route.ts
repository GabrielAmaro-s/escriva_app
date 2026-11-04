import { ErroNaoEncontrado, rotaDoUsuario } from "../../../rotas";

export const dynamic = "force-dynamic";

export const GET = rotaDoUsuario<{ id: string }>(async ({ repo }, { id }) => {
  const quadro = await repo.obterQuadro(id);
  if (!quadro) throw new ErroNaoEncontrado("Projeto não encontrado.");
  return quadro;
});
