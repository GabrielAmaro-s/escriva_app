import { describe, expect, it } from "vitest";
import type { Repositorio } from "../repositorio";
import { criarRepositorioDoAgente } from "./contexto-agente";
import { criarRepositorioSupabase } from "./repositorio-supabase";

/**
 * Cliente falso do Supabase: grava cada consulta (tabela, operação, valores, filtros)
 * e responde com linhas plausíveis, para os métodos do repositório irem até o fim.
 */
type Consulta = { tabela: string; operacao: string; valores?: unknown; filtros: [string, string, unknown][] };

function criarClienteFalso() {
  const consultas: Consulta[] = [];
  const linha = (tabela: string) => ({
    id: `${tabela}-1`,
    project_id: "p1",
    column_id: "c1",
    title: "Título",
    name: "Nome",
    kind: "project",
    status: tabela === "lembretes" ? "pendente" : "active",
    color: "violet",
    icon: "folder",
    priority: "medium",
    label_ids: [],
    checklist: [],
    links: [],
    completed: false,
    position: 1024,
    texto: "Lembrete",
    quando: "2026-11-07T18:00:00.000Z",
    origem: "app",
    nome: "token",
    escopo: "escrita",
    expira_em: "2027-01-01T00:00:00.000Z",
    ferramenta: "x",
    sucesso: true,
    criado_em: "2026-11-04T00:00:00.000Z",
    created_at: "2026-11-04T00:00:00.000Z",
    updated_at: "2026-11-04T00:00:00.000Z",
    ultimo_em: "2026-11-04T00:00:00.000Z",
    campaign_details: null,
  });

  const from = (tabela: string) => {
    let consulta: Consulta | null = null;
    let modo: "lista" | "uma" | "talvez" = "lista";
    const iniciar = (operacao: string, valores?: unknown) => {
      consulta = { tabela, operacao, valores, filtros: [] };
      consultas.push(consulta);
      return construtor;
    };
    const filtro = (tipo: string) => (coluna: string, valor: unknown) => {
      consulta!.filtros.push([tipo, coluna, valor]);
      return construtor;
    };
    const construtor: Record<string, unknown> = {
      select: (..._a: unknown[]) => (consulta ? construtor : iniciar("select")),
      insert: (v: unknown) => iniciar("insert", v),
      upsert: (v: unknown) => iniciar("upsert", v),
      update: (v: unknown) => iniciar("update", v),
      delete: () => iniciar("delete"),
      eq: filtro("eq"),
      in: filtro("in"),
      lte: filtro("lte"),
      order: () => construtor,
      limit: () => construtor,
      single: () => ((modo = "uma"), construtor),
      maybeSingle: () => ((modo = "talvez"), construtor),
      then: (resolver: (r: unknown) => void) => resolver({ data: modo === "lista" ? [linha(tabela)] : linha(tabela), error: null }),
    };
    return construtor;
  };

  return { cliente: { from } as never, consultas };
}

/** Uma chamada de exemplo para cada método do repositório. */
const CHAMADAS: Record<keyof Omit<Repositorio, "modo">, (r: Repositorio) => Promise<unknown>> = {
  listarProjetos: (r) => r.listarProjetos(),
  criarProjeto: (r) =>
    r.criarProjeto({ name: "X", description: null, kind: "campaign", status: "active", color: "violet", icon: "folder", dueOn: null, campaign: { objective: null, startsOn: null, endsOn: null, channels: [], deliverables: [] } }, [
      { title: "A fazer", kind: "todo" },
    ]),
  atualizarProjeto: (r) => r.atualizarProjeto("p1", { name: "Y", kind: "project", archivedAt: null }),
  excluirProjeto: (r) => r.excluirProjeto("p1"),
  obterQuadro: (r) => r.obterQuadro("p1"),
  obterEspacoDeTrabalho: (r) => r.obterEspacoDeTrabalho(),
  criarTarefa: (r) => r.criarTarefa({ projectId: "p1", columnId: "c1", title: "T" }),
  atualizarTarefa: (r) => r.atualizarTarefa("t1", { title: "U" }),
  excluirTarefa: (r) => r.excluirTarefa("t1"),
  criarEtiqueta: (r) => r.criarEtiqueta("p1", "E", "gray"),
  excluirEtiqueta: (r) => r.excluirEtiqueta("e1"),
  listarLembretes: (r) => r.listarLembretes({ status: ["pendente"], tarefaId: "t1", ate: "2026-12-01T00:00:00Z" }),
  criarLembrete: (r) => r.criarLembrete({ texto: "L", quando: "2026-11-07T18:00:00.000Z" }),
  atualizarLembrete: (r) => r.atualizarLembrete("l1", { status: "agendado" }),
  excluirLembrete: (r) => r.excluirLembrete("l1"),
  listarTokensAgente: (r) => r.listarTokensAgente(),
  criarTokenAgente: (r) => r.criarTokenAgente({ nome: "n", escopo: "leitura", hash: "h", expiraEm: "2027-01-01T00:00:00Z" }),
  atualizarTokenAgente: (r) => r.atualizarTokenAgente("k1", { ultimoUsoEm: "2026-11-04T00:00:00Z" }),
  listarRegistroAgente: (r) => r.listarRegistroAgente(20),
  obterRegistroAgente: (r) => r.obterRegistroAgente("g1"),
  registrarAtividadeAgente: (r) => r.registrarAtividadeAgente({ tokenId: "k1", ferramenta: "x", entrada: {}, resultado: {}, sucesso: true, desfazer: null }),
  marcarRegistroDesfeito: (r) => r.marcarRegistroDesfeito("g1", "2026-11-04T00:00:00Z"),
  obterHeartbeatAgente: (r) => r.obterHeartbeatAgente(),
  registrarHeartbeatAgente: (r) => r.registrarHeartbeatAgente("2026-11-04T00:00:00Z"),
};

const USUARIO = "usuario-a";

function semFiltroDoUsuario(c: Consulta): boolean {
  if (c.operacao === "insert" || c.operacao === "upsert") {
    const linhas = Array.isArray(c.valores) ? c.valores : [c.valores];
    return linhas.some((v) => (v as Record<string, unknown>).user_id !== USUARIO);
  }
  return !c.filtros.some(([tipo, coluna, valor]) => tipo === "eq" && coluna === "user_id" && valor === USUARIO);
}

describe("repositório do agente", () => {
  it("tem um caso de teste para cada método do repositório", () => {
    const { cliente } = criarClienteFalso();
    const metodos = Object.keys(criarRepositorioDoAgente(USUARIO, cliente)).filter((k) => k !== "modo").sort();
    expect(metodos).toEqual(Object.keys(CHAMADAS).sort());
  });

  for (const [nome, chamar] of Object.entries(CHAMADAS)) {
    it(`${nome}: nenhuma consulta sai sem o filtro do usuário`, async () => {
      const { cliente, consultas } = criarClienteFalso();
      await chamar(criarRepositorioDoAgente(USUARIO, cliente)).catch(() => undefined);
      expect(consultas.length).toBeGreaterThan(0);
      expect(consultas.filter(semFiltroDoUsuario)).toEqual([]);
    });
  }

  it("não deixa uma alteração trocar o dono da linha", async () => {
    const { cliente, consultas } = criarClienteFalso();
    const repo = criarRepositorioDoAgente(USUARIO, cliente);
    await repo.atualizarTarefa("t1", { title: "x", user_id: "usuario-b" } as never).catch(() => undefined);
    const update = consultas.find((c) => c.operacao === "update")!;
    expect(update.valores).not.toHaveProperty("user_id");
    expect(update.filtros).toContainEqual(["eq", "user_id", USUARIO]);
  });

  it("controle: sem o embrulho, as mesmas chamadas saem sem filtro (o teste enxerga a falha)", async () => {
    const { cliente, consultas } = criarClienteFalso();
    const cru = criarRepositorioSupabase(cliente);
    for (const chamar of Object.values(CHAMADAS)) await chamar(cru).catch(() => undefined);
    expect(consultas.filter(semFiltroDoUsuario).length).toBeGreaterThan(20);
  });

  it("recusa contexto sem usuário", () => {
    const { cliente } = criarClienteFalso();
    expect(() => criarRepositorioDoAgente("", cliente)).toThrow(/sem usuário/);
  });
});
