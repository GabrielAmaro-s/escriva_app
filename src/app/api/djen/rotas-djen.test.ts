import { beforeAll, describe, expect, it, vi } from "vitest";
import pagina from "@/data/djen/exemplos/pagina-1.json";
import { paraComunicacaoRecebida, type ItemDjen } from "@/data/djen/cliente-djen";
import { criarRepositorioDjenEmMemoria } from "@/data/djen/repositorio-djen-memoria";
import { criarRepositorioLocal } from "@/data/local/repositorio-local";
import type { Repositorio } from "@/data/repositorio";
import { CAPTURA_DESLIGADA, type ComunicacaoRecebida } from "@/domain/djen";
import { calcularHashDoToken, gerarToken, type TokenGuardado } from "@/services/tokens";

// As rotas que a VPS chama, com o banco trocado por repositórios em memória:
// um por usuário, para conferir que o token decide de quem são os dados.

const SEGREDO = "segredo-djen-de-teste-".repeat(3);
const USUARIO_A = "usuario-a";
const USUARIO_B = "usuario-b";
let tokens: Repositorio;
const donos = new Map<string, { userId: string; hash: string }>();
const capturas = {
  [USUARIO_A]: criarRepositorioDjenEmMemoria({
    captura: { ...CAPTURA_DESLIGADA, ligada: true, numeroOab: "9999991", ufOab: "RS", avisoAceitoEm: "2099-01-01T00:00:00.000Z" },
  }),
  [USUARIO_B]: criarRepositorioDjenEmMemoria(),
};

vi.mock("@/data/supabase/contexto-agente", () => ({
  criarRepositorioDoAgente: () => tokens,
  criarRepositorioDjenDoAgente: (userId: string) => capturas[userId as keyof typeof capturas],
  buscarTokenPorHash: async (hash: string): Promise<TokenGuardado | null> => {
    const entrada = [...donos].find(([, d]) => d.hash === hash);
    if (!entrada) return null;
    const t = (await tokens.listarTokensAgente()).find((x) => x.id === entrada[0]);
    return t ? { ...t, userId: entrada[1].userId, hash } : null;
  },
}));

let iniciar: (r: Request) => Promise<Response>;
let enviar: (r: Request) => Promise<Response>;
let concluir: (r: Request) => Promise<Response>;
let tokenA: string;
let tokenB: string;
let tokenLeituraA: string;

async function novoToken(userId: string, escopo: "leitura" | "escrita") {
  const { token, registro } = await gerarToken(tokens, { nome: `${userId}-${escopo}`, escopo }, { segredo: SEGREDO, validadeDias: 90 });
  donos.set(registro.id, { userId, hash: calcularHashDoToken(token, SEGREDO) });
  return token;
}

const pedir = (rota: (r: Request) => Promise<Response>, token: string | null, corpo: unknown = {}) =>
  rota(
    new Request("http://localhost:3000/api/djen", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(corpo),
    }),
  );

const itens = (): ComunicacaoRecebida[] =>
  (pagina.items as ItemDjen[]).map((i) => paraComunicacaoRecebida(i, "9999991", "RS")).filter((c): c is ComunicacaoRecebida => c !== null);

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://teste.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_teste");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  vi.stubEnv("MCP_SEGREDO_TOKENS", SEGREDO);
  tokens = criarRepositorioLocal();
  tokenA = await novoToken(USUARIO_A, "escrita");
  tokenB = await novoToken(USUARIO_B, "escrita");
  tokenLeituraA = await novoToken(USUARIO_A, "leitura");
  ({ POST: iniciar } = await import("./consulta/iniciar/route"));
  ({ POST: enviar } = await import("./comunicacoes/route"));
  ({ POST: concluir } = await import("./consulta/concluir/route"));
});

describe("rotas da captura do DJEN", () => {
  it("sem token, com token inválido ou só de leitura: recusa e não grava nada", async () => {
    expect((await pedir(iniciar, null)).status).toBe(401);
    expect((await pedir(iniciar, `tempestivo_${"x".repeat(43)}`)).status).toBe(401);
    expect((await pedir(enviar, tokenLeituraA, { itens: itens() })).status).toBe(403);
    expect(capturas[USUARIO_A].captura()?.tentativasNoDia).toBe(0);
    expect(capturas[USUARIO_A].sugestoes).toHaveLength(0);
  });

  it("captura desligada: não consulta e recusa comunicações", async () => {
    expect(await (await pedir(iniciar, tokenB)).json()).toEqual({ consultar: false, motivo: "desligada" });
    const r = await pedir(enviar, tokenB, { itens: itens() });
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toMatch(/desligada/);
  });

  it("corpo inválido ou lote grande demais: 400", async () => {
    expect((await pedir(enviar, tokenA, { itens: [{ djenId: "x" }] })).status).toBe(400);
    expect((await pedir(enviar, tokenA, { itens: Array(21).fill(itens()[0]) })).status).toBe(400);
    expect((await pedir(concluir, tokenA, { resultado: "talvez", janela: { inicio: "2099-01-01", fim: "2099-01-02" } })).status).toBe(400);
  });

  it("o fluxo da VPS: iniciar, enviar e concluir, só nos dados do dono do token", async () => {
    const plano = await (await pedir(iniciar, tokenA)).json();
    expect(plano).toMatchObject({ consultar: true, tentativa: 1, numeroOab: "9999991", ufOab: "RS" });

    const resumo = await (await pedir(enviar, tokenA, { itens: itens() })).json();
    expect(resumo).toEqual({ recebidas: 5, novas: 4, repetidas: 0, canceladas: 0, invalidas: 0 });

    const fim = await (await pedir(concluir, tokenA, { resultado: "ok", janela: plano.janela })).json();
    expect(fim).toEqual({ ultimaConsultaOk: plano.janela.fim, ultimoResultado: "ok" });

    expect(capturas[USUARIO_A].sugestoes).toHaveLength(4);
    expect(capturas[USUARIO_B].sugestoes).toHaveLength(0);
    expect(capturas[USUARIO_B].captura()).toBeNull();
  });
});
