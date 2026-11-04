/**
 * Roda uma vez quando o servidor sobe. Valida as variáveis de ambiente
 * para que uma configuração incompleta em produção apareça na hora, e não no primeiro pedido.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { obterAmbienteServidor } = await import("./config/ambiente-servidor");
  obterAmbienteServidor();
}
