import { rotaDoUsuario } from "../../rotas";

export const dynamic = "force-dynamic";

export const DELETE = rotaDoUsuario<{ id: string }>(async ({ repo }, { id }) => {
  await repo.excluirEtiqueta(id);
});
