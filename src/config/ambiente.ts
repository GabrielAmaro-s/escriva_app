import { z } from "zod";

/**
 * Variáveis públicas (NEXT_PUBLIC_*): podem ir para o navegador.
 * O Next só embute no navegador o que é lido literalmente como process.env.NEXT_PUBLIC_X,
 * por isso cada variável é lida pelo nome abaixo.
 *
 * As variáveis só de servidor ficam em ./ambiente-servidor.ts (com "server-only").
 */

/** Trata string vazia como ausente, para um .env.local com linhas em branco não quebrar nada. */
const opcional = <T extends z.ZodType>(esquema: T) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), esquema.optional());

const esquemaPublico = z.object({
  NEXT_PUBLIC_APP_URL: opcional(z.url({ error: "NEXT_PUBLIC_APP_URL precisa ser uma URL (ex.: http://localhost:3000)." })),
  NEXT_PUBLIC_SUPABASE_URL: opcional(z.url({ error: "NEXT_PUBLIC_SUPABASE_URL precisa ser uma URL (ex.: https://SEU-PROJETO.supabase.co)." })),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: opcional(z.string()),
});

export function descreverErros(erro: z.ZodError): string {
  return erro.issues.map((i) => `- ${i.message}`).join("\n");
}

function lerAmbientePublico() {
  const resultado = esquemaPublico.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!resultado.success) {
    throw new Error(`Configuração inválida no .env.local:\n${descreverErros(resultado.error)}`);
  }
  const v = resultado.data;
  const urlSupabase = v.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const chavePublicavelSupabase = v.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? null;
  return {
    urlApp: (v.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
    urlSupabase,
    chavePublicavelSupabase,
    /** Sem URL e chave do Supabase o app roda com os dados no navegador. Não é erro. */
    modoLocal: !(urlSupabase && chavePublicavelSupabase),
  };
}

export const ambientePublico = lerAmbientePublico();

export type AmbientePublico = typeof ambientePublico;
