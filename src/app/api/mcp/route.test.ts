import { beforeAll, describe, expect, it, vi } from "vitest";
import { criarDadosDeExemplo } from "@/data/local/exemplo";
import { criarRepositorioLocal } from "@/data/local/repositorio-local";
import type { Repositorio } from "@/data/repositorio";
import { calcularHashDoToken, gerarToken, revogarToken, type TokenGuardado } from "@/services/tokens";

// A rota MCP de verdade (mcp-handler + SDK), com o banco trocado pelo repositório em memória.

const SEGREDO = "segredo-mcp-de-teste-".repeat(3);
let repo: Repositorio;
const hashes = new Map<string, string>();

vi.mock("@/data/supabase/contexto-agente", () => ({
  criarRepositorioDoAgente: () => repo,
  buscarTokenPorHash: async (hash: string): Promise<TokenGuardado | null> => {
    const id = [...hashes].find(([, h]) => h === hash)?.[0];
    const t = (await repo.listarTokensAgente()).find((x) => x.id === id);
    return t ? { ...t, userId: "usuario-a", hash } : null;
  },
}));

let POST: (r: Request) => Promise<Response>;
let tokenEscrita: string;
let tokenLeitura: string;
let idEscrita: string;

async function novoToken(escopo: "leitura" | "escrita") {
  const { token, registro } = await gerarToken(repo, { nome: escopo, escopo }, { segredo: SEGREDO, validadeDias: 90 });
  hashes.set(registro.id, calcularHashDoToken(token, SEGREDO));
  return { token, id: registro.id };
}

async function rpc(token: string | null, metodo: string, params: Record<string, unknown> = {}) {
  const resposta = await POST(
    new Request("http://localhost:3000/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": "2025-06-18",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: metodo, params }),
    }),
  );
  const texto = await resposta.text();
  // A resposta pode vir como JSON ou como evento SSE ("data: {...}").
  const json = texto.trim().startsWith("{") ? texto : (texto.split("\n").find((l) => l.startsWith("data:"))?.slice(5) ?? "null");
  return { status: resposta.status, corpo: JSON.parse(json) as { result?: Record<string, unknown>; error?: unknown } };
}

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://teste.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_teste");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  vi.stubEnv("MCP_SEGREDO_TOKENS", SEGREDO);
  repo = criarRepositorioLocal({ dados: criarDadosDeExemplo() });
  ({ token: tokenEscrita, id: idEscrita } = await novoToken("escrita"));
  ({ token: tokenLeitura } = await novoToken("leitura"));
  ({ POST } = await import("./route"));
});

describe("servidor MCP", () => {
  it("sem token, com token inválido ou malformado: 401", async () => {
    expect((await rpc(null, "tools/list")).status).toBe(401);
    expect((await rpc(`myplan_${"x".repeat(43)}`, "tools/list")).status).toBe(401);
    expect((await rpc("qualquer-coisa", "tools/list")).status).toBe(401);
  });

  it("initialize responde com o nome do servidor", async () => {
    const r = await rpc(tokenEscrita, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "teste", version: "1" } });
    expect(r.status).toBe(200);
    expect(r.corpo.result).toMatchObject({ serverInfo: { name: "escriva" } });
  });

  it("token de escrita lista as 19 ferramentas; de leitura, só as 7 sem escrita", async () => {
    const escrita = await rpc(tokenEscrita, "tools/list");
    const nomes = (escrita.corpo.result!.tools as { name: string }[]).map((t) => t.name);
    expect(nomes).toHaveLength(19);
    const leitura = await rpc(tokenLeitura, "tools/list");
    expect((leitura.corpo.result!.tools as { name: string }[]).map((t) => t.name)).toEqual([
      "listar_projetos",
      "ver_quadro",
      "buscar_tarefas",
      "resumir_projeto",
      "lembretes_proximos",
      "prazos_proximos",
      "audiencias_proximas",
    ]);
  });

  it("chamar uma ferramenta grava o registro e atualiza o último uso do token", async () => {
    const r = await rpc(tokenEscrita, "tools/call", {
      name: "criar_tarefas",
      arguments: { projeto: "Cobrança de aluguéis", tarefas: [{ titulo: "Testar formulário" }] },
    });
    const conteudo = (r.corpo.result!.content as { text: string }[])[0].text;
    expect(JSON.parse(conteudo)).toMatchObject({ mensagem: "Criei “Testar formulário” em Cobrança de aluguéis." });
    expect((await repo.listarRegistroAgente(1))[0]).toMatchObject({ ferramenta: "criar_tarefas", tokenId: idEscrita, sucesso: true });
    expect((await repo.listarTokensAgente()).find((t) => t.id === idEscrita)?.ultimoUsoEm).not.toBeNull();
  });

  it("token de leitura não consegue chamar ferramenta de escrita", async () => {
    const r = await rpc(tokenLeitura, "tools/call", { name: "excluir_tarefa", arguments: { tarefa: "Conferir custas iniciais", confirmado: true } });
    expect(JSON.stringify(r.corpo)).toMatch(/not found|não|unknown|error/i);
    expect((await repo.obterEspacoDeTrabalho()).tarefas.some((t) => t.title === "Conferir custas iniciais")).toBe(true);
  });

  it("token de leitura chamando escrita direto: erro claro, nada muda e a tentativa fica registrada", async () => {
    const antes = JSON.stringify(await repo.obterEspacoDeTrabalho()) + JSON.stringify(await repo.listarLembretes());
    const tentativas: [string, Record<string, unknown>][] = [
      ["criar_tarefas", { projeto: "Cobrança de aluguéis", tarefas: [{ titulo: "Não deveria existir" }] }],
      ["mover_tarefa", { tarefa: "Conferir custas iniciais", coluna: "concluido" }],
      ["criar_lembrete", { texto: "Não deveria existir", quando: "2026-12-01T10:00" }],
      ["excluir_tarefa", { tarefa: "Conferir custas iniciais", confirmado: true }],
    ];
    for (const [nome, argumentos] of tentativas) {
      const r = await rpc(tokenLeitura, "tools/call", { name: nome, arguments: argumentos });
      expect(r.status).toBe(200);
      expect(r.corpo.result).toMatchObject({ isError: true });
      const texto = (r.corpo.result!.content as { text: string }[])[0].text;
      expect(JSON.parse(texto)).toEqual({ erro: "Este token só permite leitura." });
      const [linha] = await repo.listarRegistroAgente(1);
      expect(linha).toMatchObject({ ferramenta: nome, sucesso: false, desfazer: null });
    }
    expect(JSON.stringify(await repo.obterEspacoDeTrabalho()) + JSON.stringify(await repo.listarLembretes())).toBe(antes);
  });

  it("token revogado volta a dar 401", async () => {
    await revogarToken(repo, idEscrita);
    expect((await rpc(tokenEscrita, "tools/list")).status).toBe(401);
  });
});
