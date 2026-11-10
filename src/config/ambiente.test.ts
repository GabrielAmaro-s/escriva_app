import { afterEach, describe, expect, it, vi } from "vitest";

async function carregar(variaveis: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [nome, valor] of Object.entries(variaveis)) vi.stubEnv(nome, valor as string);
  const publico = await import("./ambiente");
  const servidor = await import("./ambiente-servidor");
  return { ...publico, ...servidor };
}

afterEach(() => vi.unstubAllEnvs());

const SUPABASE = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_teste",
};

describe("ambiente", () => {
  it("sem Supabase vira modo local, sem erro", async () => {
    const { ambientePublico, obterAmbienteServidor } = await carregar({ NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", NODE_ENV: "production" });
    expect(ambientePublico.modoLocal).toBe(true);
    expect(obterAmbienteServidor().fusoHorario).toBe("America/Sao_Paulo");
  });

  it("com Supabase, em produção, aponta em português o que falta", async () => {
    const { obterAmbienteServidor } = await carregar({ ...SUPABASE, NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "", SUPABASE_SECRET_KEY: "", MCP_SEGREDO_TOKENS: "troque-por-um-segredo-longo-e-aleatorio" });
    expect(() => obterAmbienteServidor()).toThrow(/Faltam variáveis de ambiente obrigatórias em produção:[\s\S]*SUPABASE_SECRET_KEY[\s\S]*MCP_SEGREDO_TOKENS/);
  });

  it("valida números e fuso", async () => {
    const { obterAmbienteServidor } = await carregar({ ...SUPABASE, NODE_ENV: "development", MCP_LIMITE_ITENS_POR_PEDIDO: "abc" });
    expect(() => obterAmbienteServidor()).toThrow(/MCP_LIMITE_ITENS_POR_PEDIDO precisa ser um número/);
    const outro = await carregar({ ...SUPABASE, NODE_ENV: "development", MYPLAN_FUSO_HORARIO: "Lua/Base" });
    expect(() => outro.obterAmbienteServidor()).toThrow(/fuso IANA/);
  });

  it("fuso: TEMPESTIVO_FUSO_HORARIO tem prioridade e MYPLAN_FUSO_HORARIO continua aceito", async () => {
    const novo = await carregar({ ...SUPABASE, NODE_ENV: "development", TEMPESTIVO_FUSO_HORARIO: "America/Manaus", MYPLAN_FUSO_HORARIO: "America/Recife" });
    expect(novo.obterAmbienteServidor().fusoHorario).toBe("America/Manaus");
    const antigo = await carregar({ ...SUPABASE, NODE_ENV: "development", TEMPESTIVO_FUSO_HORARIO: "", MYPLAN_FUSO_HORARIO: "America/Recife" });
    expect(antigo.obterAmbienteServidor().fusoHorario).toBe("America/Recife");
    const invalido = await carregar({ ...SUPABASE, NODE_ENV: "development", TEMPESTIVO_FUSO_HORARIO: "Lua/Base" });
    expect(() => invalido.obterAmbienteServidor()).toThrow(/TEMPESTIVO_FUSO_HORARIO \(ou MYPLAN_FUSO_HORARIO\)/);
  });

  it("em desenvolvimento, com tudo certo, lê os valores e os padrões", async () => {
    const { ambientePublico, obterAmbienteServidor } = await carregar({
      ...SUPABASE,
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "https://myplan.exemplo.com/",
      MCP_SEGREDO_TOKENS: "x".repeat(40),
      MCP_VALIDADE_TOKEN_DIAS: "30",
    });
    expect(ambientePublico).toMatchObject({ modoLocal: false, urlApp: "https://myplan.exemplo.com" });
    expect(obterAmbienteServidor()).toMatchObject({ validadeTokenDias: 30, limiteItensPorPedido: 10, alertaSemHeartbeatMin: 60 });
  });
});
