import { obterAmbienteServidor } from "@/config/ambiente-servidor";
import { calcularSituacaoAgente } from "@/domain/lembrete";
import { rotaDoUsuario } from "../../rotas";

export const dynamic = "force-dynamic";

/** "Ativo" ou "sem sinal há X min", a partir do último heartbeat do agente. */
export const GET = rotaDoUsuario(async ({ repo }) => {
  const limiteMin = obterAmbienteServidor().alertaSemHeartbeatMin;
  return { ...calcularSituacaoAgente(await repo.obterHeartbeatAgente(), limiteMin), limiteMin };
});
