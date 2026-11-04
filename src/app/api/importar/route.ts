import { z } from "zod";
import { importarDados } from "@/services/importacao";
import { lerCorpo, rotaDoUsuario } from "../rotas";

export const dynamic = "force-dynamic";

/** Recebe um arquivo exportado (do navegador ou de outra conta) e cria tudo na conta logada. */
export const POST = rotaDoUsuario(async ({ repo, requisicao }) => {
  const dados = await lerCorpo(requisicao, z.unknown());
  return importarDados(repo, dados);
});
