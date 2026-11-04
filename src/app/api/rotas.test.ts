import { beforeAll, describe, expect, it, vi } from "vitest";
import { armazenamentoVazio, criarRepositorioLocal } from "@/data/local/repositorio-local";
import type { Repositorio } from "@/data/repositorio";
import { COLUNAS_PADRAO } from "@/domain/quadro";
import { dadosProjetoVazios } from "@/domain/projeto";

// Teste de integração do caminho navegador -> /api -> services -> repositório.
// O Supabase é trocado por um repositório em memória; todo o resto é o código real.

const SEGREDO = "segredo-de-teste-".repeat(4);
let repoServidor: Repositorio;

vi.mock("@/data/supabase/usuario-servidor", () => ({
  ErroNaoAutenticado: class extends Error {},
  obterRepositorioDoUsuario: async () => ({ repo: repoServidor, userId: "usuario-a" }),
}));

type Modulo = Record<string, (r: Request, e: { params: Promise<Record<string, string>> }) => Promise<Response>>;
const ROTAS: [RegExp, string[], () => Promise<unknown>][] = [
  [/^\/api\/projetos$/, [], () => import("./projetos/route")],
  [/^\/api\/projetos\/([^/]+)$/, ["id"], () => import("./projetos/[id]/route")],
  [/^\/api\/projetos\/([^/]+)\/quadro$/, ["id"], () => import("./projetos/[id]/quadro/route")],
  [/^\/api\/espaco-de-trabalho$/, [], () => import("./espaco-de-trabalho/route")],
  [/^\/api\/tarefas$/, [], () => import("./tarefas/route")],
  [/^\/api\/tarefas\/([^/]+)$/, ["id"], () => import("./tarefas/[id]/route")],
  [/^\/api\/etiquetas$/, [], () => import("./etiquetas/route")],
  [/^\/api\/etiquetas\/([^/]+)$/, ["id"], () => import("./etiquetas/[id]/route")],
  [/^\/api\/lembretes$/, [], () => import("./lembretes/route")],
  [/^\/api\/lembretes\/([^/]+)$/, ["id"], () => import("./lembretes/[id]/route")],
  [/^\/api\/agente\/tokens$/, [], () => import("./agente/tokens/route")],
  [/^\/api\/agente\/tokens\/([^/]+)$/, ["id"], () => import("./agente/tokens/[id]/route")],
  [/^\/api\/agente\/registro$/, [], () => import("./agente/registro/route")],
  [/^\/api\/agente\/registro\/([^/]+)\/desfazer$/, ["id"], () => import("./agente/registro/[id]/desfazer/route")],
  [/^\/api\/agente\/estado$/, [], () => import("./agente/estado/route")],
  [/^\/api\/importar$/, [], () => import("./importar/route")],
];

async function fetchFalso(entrada: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = new URL(String(entrada), "http://localhost");
  for (const [padrao, nomes, carregar] of ROTAS) {
    const m = url.pathname.match(padrao);
    if (!m) continue;
    const modulo = (await carregar()) as Modulo;
    const metodo = (init?.method ?? "GET").toUpperCase();
    const manipulador = modulo[metodo];
    if (!manipulador) return new Response(null, { status: 405 });
    const params = Object.fromEntries(nomes.map((n, i) => [n, m[i + 1]]));
    return manipulador(new Request(url, init), { params: Promise.resolve(params) });
  }
  return new Response(JSON.stringify({ erro: "rota inexistente" }), { status: 404 });
}

let http: Repositorio;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://teste.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_teste");
  vi.stubEnv("MCP_SEGREDO_TOKENS", SEGREDO);
  vi.stubGlobal("fetch", fetchFalso);
  repoServidor = criarRepositorioLocal({ dados: armazenamentoVazio() });
  http = (await import("@/data/http/repositorio-http")).criarRepositorioHttp();
});

describe("telas gravando pela API", () => {
  it("projeto, quadro, tarefas e etiquetas vão e voltam pelo servidor", async () => {
    const projeto = await http.criarProjeto({ ...dadosProjetoVazios(), name: "Novo site" }, COLUNAS_PADRAO);
    expect((await repoServidor.listarProjetos()).map((p) => p.name)).toEqual(["Novo site"]);

    const quadro = (await http.obterQuadro(projeto.id))!;
    expect(quadro.colunas.map((c) => c.title)).toEqual(["A fazer", "Em andamento", "Aguardando", "Concluído"]);

    const etiqueta = await http.criarEtiqueta(projeto.id, "Design", "red");
    const tarefa = await http.criarTarefa({ projectId: projeto.id, columnId: quadro.colunas[0].id, title: "Layout da home", labelIds: [etiqueta.id] });
    const atualizada = await http.atualizarTarefa(tarefa.id, { priority: "high", checklist: [{ id: "1", text: "Rascunho", done: true }] });
    expect(atualizada).toMatchObject({ priority: "high", labelIds: [etiqueta.id] });

    expect((await http.obterEspacoDeTrabalho()).tarefas).toHaveLength(1);
    await http.excluirTarefa(tarefa.id);
    expect((await repoServidor.obterEspacoDeTrabalho()).tarefas).toHaveLength(0);
    expect(await http.obterQuadro("00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("o servidor recusa entrada inválida com mensagem em português", async () => {
    await expect(http.criarTarefa({ projectId: "nao-e-uuid", columnId: "x", title: "" })).rejects.toThrow(/Projeto inválido|título/);
    await expect(http.criarProjeto({ ...dadosProjetoVazios(), name: "   " }, COLUNAS_PADRAO)).rejects.toThrow("Dê um nome para continuar.");
  });

  it("lembrete criado na janela da tarefa: cria, remarca (volta a pendente) e cancela", async () => {
    const [projeto] = await http.listarProjetos();
    const quadro = (await http.obterQuadro(projeto.id))!;
    const tarefa = await http.criarTarefa({ projectId: projeto.id, columnId: quadro.colunas[0].id, title: "Ligar para o cliente" });

    const lembrete = await http.criarLembrete({ texto: tarefa.title, quando: "2026-11-07T18:00:00.000Z", tarefaId: tarefa.id, projetoId: projeto.id });
    expect(lembrete).toMatchObject({ status: "pendente", origem: "app", tarefaId: tarefa.id });
    expect(await http.listarLembretes({ status: ["pendente", "agendado"] })).toHaveLength(1);

    await repoServidor.atualizarLembrete(lembrete.id, { status: "agendado", agendadoEm: "2026-11-06T00:00:00.000Z" });
    const remarcado = await http.atualizarLembrete(lembrete.id, { quando: "2026-11-08T18:00:00.000Z", status: "pendente" });
    expect(remarcado).toMatchObject({ status: "pendente", agendadoEm: null, quando: "2026-11-08T18:00:00.000Z" });

    await http.atualizarLembrete(lembrete.id, { status: "cancelado" });
    expect(await http.listarLembretes({ status: ["pendente", "agendado"] })).toHaveLength(0);
  });

  it("token gerado pela tela funciona e, revogado, deixa de funcionar", async () => {
    const { chamarApi } = await import("@/lib/chamar-api");
    const { validarToken, calcularHashDoToken } = await import("@/services/tokens");
    const { token, registro } = await chamarApi<{ token: string; registro: { id: string } }>("/api/agente/tokens", { metodo: "POST", corpo: { nome: "nanobot", escopo: "escrita" } });

    const hash = calcularHashDoToken(token, SEGREDO);
    const buscarPorHash = async (h: string) => {
      const t = (await repoServidor.listarTokensAgente()).find((x) => x.id === registro.id);
      return h === hash && t ? { ...t, userId: "usuario-a", hash } : null;
    };
    expect((await validarToken(token, { segredo: SEGREDO, buscarPorHash })).ok).toBe(true);

    await http.atualizarTokenAgente(registro.id, { revogadoEm: new Date().toISOString() });
    expect(await validarToken(token, { segredo: SEGREDO, buscarPorHash })).toEqual({ ok: false, motivo: "revogado" });
    expect((await http.listarTokensAgente())[0].revogadoEm).not.toBeNull();
  });

  it("desfazer uma ação do agente pela tela", async () => {
    const [projeto] = await http.listarProjetos();
    const quadro = (await http.obterQuadro(projeto.id))!;
    const criada = await repoServidor.criarTarefa({ projectId: projeto.id, columnId: quadro.colunas[0].id, title: "Criada pelo agente" });
    const linha = await repoServidor.registrarAtividadeAgente({ tokenId: null, ferramenta: "criar_tarefas", entrada: {}, resultado: {}, sucesso: true, desfazer: { tipo: "excluir_tarefas", ids: [criada.id] } });

    const { chamarApi } = await import("@/lib/chamar-api");
    expect(await chamarApi(`/api/agente/registro/${linha.id}/desfazer`, { metodo: "POST" })).toEqual({ mensagem: "Tarefa removida." });
    expect((await repoServidor.obterEspacoDeTrabalho()).tarefas.find((t) => t.id === criada.id)).toBeUndefined();
    await expect(chamarApi(`/api/agente/registro/${linha.id}/desfazer`, { metodo: "POST" })).rejects.toThrow("Esta ação já foi desfeita.");
  });

  it("estado do agente a partir do último sinal", async () => {
    const { chamarApi } = await import("@/lib/chamar-api");
    expect(await chamarApi("/api/agente/estado")).toMatchObject({ situacao: "nunca", limiteMin: 60 });
    await repoServidor.registrarHeartbeatAgente(new Date().toISOString());
    expect(await chamarApi("/api/agente/estado")).toMatchObject({ situacao: "ativo", minutosSemSinal: 0 });
  });
});
