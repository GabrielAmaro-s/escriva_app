import { concluirConsulta } from "@/services/captura-djen";
import { esquemaConclusaoDjen } from "../../../esquemas";
import { lerCorpo } from "../../../rotas";
import { rotaComToken } from "../../rota-com-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Resultado do dia: só "ok" avança a data da última consulta boa. */
export const POST = rotaComToken("escrita", async ({ repo, requisicao, fuso }) => {
  const dados = await lerCorpo(requisicao, esquemaConclusaoDjen);
  const captura = await concluirConsulta(repo, dados, { fuso });
  return { ultimaConsultaOk: captura.ultimaConsultaOk, ultimoResultado: captura.ultimoResultado };
});
