import "server-only";
import { z } from "zod";
import { ambientePublico, descreverErros } from "./ambiente";

/**
 * Variáveis só de servidor. Nunca importe este arquivo em componentes de navegador
 * (o pacote "server-only" faz o build falhar se isso acontecer).
 *
 * A validação acontece no primeiro acesso e também na inicialização do servidor
 * (src/instrumentation.ts), assim uma variável obrigatória faltando em produção
 * aparece logo, com uma mensagem clara.
 */

const vazioComoAusente = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const texto = () => z.preprocess(vazioComoAusente, z.string().optional());
const inteiro = (nome: string, padrao: number, minimo = 1) =>
  z.preprocess(
    vazioComoAusente,
    z.coerce
      .number({ error: `${nome} precisa ser um número.` })
      .int({ error: `${nome} precisa ser um número inteiro.` })
      .min(minimo, { error: `${nome} precisa ser no mínimo ${minimo}.` })
      .default(padrao),
  );

const ehFusoValido = (fuso: string) => {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: fuso });
    return true;
  } catch {
    return false;
  }
};

const esquemaServidor = z.object({
  MYPLAN_FUSO_HORARIO: z.preprocess(
    vazioComoAusente,
    z.string().refine(ehFusoValido, { error: "MYPLAN_FUSO_HORARIO precisa ser um fuso IANA válido (ex.: America/Sao_Paulo)." }).default("America/Sao_Paulo"),
  ),
  SUPABASE_SECRET_KEY: texto(),
  SUPABASE_PROJECT_REF: texto(),
  DATABASE_URL: texto(),
  DIRECT_URL: texto(),
  MCP_SEGREDO_TOKENS: texto(),
  MCP_VALIDADE_TOKEN_DIAS: inteiro("MCP_VALIDADE_TOKEN_DIAS", 90),
  MCP_LIMITE_ITENS_POR_PEDIDO: inteiro("MCP_LIMITE_ITENS_POR_PEDIDO", 10),
  AGENTE_ALERTA_SEM_HEARTBEAT_MIN: inteiro("AGENTE_ALERTA_SEM_HEARTBEAT_MIN", 60),
});

const SEGREDO_DE_EXEMPLO = "troque-por-um-segredo-longo-e-aleatorio";

function lerAmbienteServidor() {
  const resultado = esquemaServidor.safeParse(process.env);
  if (!resultado.success) {
    throw new Error(`Configuração inválida no .env.local:\n${descreverErros(resultado.error)}`);
  }
  const v = resultado.data;
  const producao = process.env.NODE_ENV === "production";

  // Em produção, com Supabase, estas variáveis são obrigatórias.
  if (producao && !ambientePublico.modoLocal) {
    const faltando: string[] = [];
    if (!process.env.NEXT_PUBLIC_APP_URL) faltando.push("NEXT_PUBLIC_APP_URL (endereço público do app, usado nos links que o agente envia)");
    if (!v.SUPABASE_SECRET_KEY) faltando.push("SUPABASE_SECRET_KEY (chave secreta do Supabase, usada pelo servidor MCP)");
    if (!v.MCP_SEGREDO_TOKENS || v.MCP_SEGREDO_TOKENS === SEGREDO_DE_EXEMPLO) {
      faltando.push("MCP_SEGREDO_TOKENS (gere com: openssl rand -base64 48)");
    }
    if (faltando.length) {
      throw new Error(`Faltam variáveis de ambiente obrigatórias em produção:\n${faltando.map((f) => `- ${f}`).join("\n")}\nPreencha no .env.local (ou no painel da hospedagem) e reinicie o servidor.`);
    }
  }
  if (v.MCP_SEGREDO_TOKENS && v.MCP_SEGREDO_TOKENS.length < 32) {
    throw new Error("MCP_SEGREDO_TOKENS precisa ter pelo menos 32 caracteres. Gere com: openssl rand -base64 48");
  }

  return {
    fusoHorario: v.MYPLAN_FUSO_HORARIO,
    chaveSecretaSupabase: v.SUPABASE_SECRET_KEY ?? null,
    refProjetoSupabase: v.SUPABASE_PROJECT_REF ?? null,
    urlBanco: v.DATABASE_URL ?? null,
    urlBancoDireta: v.DIRECT_URL ?? null,
    segredoTokens: v.MCP_SEGREDO_TOKENS ?? null,
    validadeTokenDias: v.MCP_VALIDADE_TOKEN_DIAS,
    limiteItensPorPedido: v.MCP_LIMITE_ITENS_POR_PEDIDO,
    alertaSemHeartbeatMin: v.AGENTE_ALERTA_SEM_HEARTBEAT_MIN,
  };
}

export type AmbienteServidor = ReturnType<typeof lerAmbienteServidor>;

let cache: AmbienteServidor | null = null;

/** Lê e valida uma vez; as chamadas seguintes usam o resultado guardado. */
export function obterAmbienteServidor(): AmbienteServidor {
  cache ??= lerAmbienteServidor();
  return cache;
}

/** Atalho: `ambienteServidor.fusoHorario` valida no primeiro acesso. */
export const ambienteServidor: AmbienteServidor = new Proxy({} as AmbienteServidor, {
  get: (_alvo, chave) => obterAmbienteServidor()[chave as keyof AmbienteServidor],
});
