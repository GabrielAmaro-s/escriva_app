import { revogarToken } from "@/services/tokens";
import { rotaDoUsuario } from "../../../rotas";

export const dynamic = "force-dynamic";

/** Revoga (não apaga): o histórico do registro continua apontando para o token. */
export const DELETE = rotaDoUsuario<{ id: string }>(async ({ repo }, { id }) => {
  await revogarToken(repo, id);
});
