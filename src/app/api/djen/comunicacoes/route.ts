import { receberComunicacoes } from "@/services/captura-djen";
import { esquemaComunicacoesDjen } from "../../esquemas";
import { lerCorpo } from "../../rotas";
import { rotaComToken } from "../rota-com-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Comunicações trazidas pela VPS: viram sugestões pendentes, sem duplicar. */
export const POST = rotaComToken("escrita", async ({ repo, requisicao, fuso }) => {
  const { itens } = await lerCorpo(requisicao, esquemaComunicacoesDjen);
  return receberComunicacoes(repo, itens, { fuso });
});
