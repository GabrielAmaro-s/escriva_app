import { revogarToken } from "@/services/tokens";
import { rotaDoUsuario } from "../../../rotas";

export const dynamic = "force-dynamic";
// server-only, cliente admin e AsyncLocalStorage precisam do runtime Node.js.
export const runtime = "nodejs";

/** Revoga (não apaga): o histórico do registro continua apontando para o token. */
export const DELETE = rotaDoUsuario<{ id: string }>(async ({ repo }, { id }) => {
  await revogarToken(repo, id);
});
