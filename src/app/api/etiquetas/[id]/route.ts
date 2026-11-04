import { rotaDoUsuario } from "../../rotas";

export const dynamic = "force-dynamic";
// server-only, cliente admin e AsyncLocalStorage precisam do runtime Node.js.
export const runtime = "nodejs";

export const DELETE = rotaDoUsuario<{ id: string }>(async ({ repo }, { id }) => {
  await repo.excluirEtiqueta(id);
});
