import { describe, expect, it } from "vitest";
import { detalhesProcessoVazios } from "@/domain/processo";
import type { DadosProjeto } from "@/domain/tipos";
import type { Repositorio } from "../repositorio";
import type { RepositorioDjen } from "../repositorio-djen";
import { criarRepositorioDjenDoAgente, criarRepositorioDoAgente } from "./contexto-agente";
import { criarRepositorioDjenSupabase } from "./repositorio-djen";
import { criarRepositorioSupabase } from "./repositorio-supabase";

/**
 * Cliente falso do Supabase: grava cada consulta (tabela, operação, valores, filtros)
 * e responde com linhas plausíveis, para os métodos do repositório irem até o fim.
 */
type Consulta = { tabela: string; operacao: string; valores?: unknown; opcoes?: unknown; filtros: [string, string, unknown][] };

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
    nome: tabela === "clientes" ? "Cliente" : "token",
    tipo: "pf",
    atualizado_em: "2026-11-04T00:00:00.000Z",
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
    const iniciar = (operacao: string, valores?: unknown, opcoes?: unknown) => {
      consulta = { tabela, operacao, valores, opcoes, filtros: [] };
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
      upsert: (v: unknown, o?: unknown) => iniciar("upsert", v, o),
      update: (v: unknown) => iniciar("update", v),
      delete: () => iniciar("delete"),
      eq: filtro("eq"),
      in: filtro("in"),
      is: filtro("is"),
      or: (expressao: string) => {
        consulta!.filtros.push(["or", "", expressao]);
        return construtor;
      },
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
  listarClientes: (r) => r.listarClientes(),
  criarCliente: (r) => r.criarCliente({ nome: "C", tipo: "pf", documento: null, telefone: null, email: null, observacoes: null }),
  atualizarCliente: (r) => r.atualizarCliente("k1", { nome: "D" }),
  excluirCliente: (r) => r.excluirCliente("k1"),
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
  listarFeriados: (r) => r.listarFeriados(),
  criarFeriado: (r) => r.criarFeriado({ data: "2026-02-02", descricao: "Navegantes" }),
  excluirFeriado: (r) => r.excluirFeriado("f1"),
  listarAlteracoesDaTarefa: (r) => r.listarAlteracoesDaTarefa("t1"),
  obterPreferencias: (r) => r.obterPreferencias(),
  salvarPreferencias: (r) => r.salvarPreferencias({ margemPrazoInterno: 3 }),
};

const USUARIO = "0b6f1c1e-4c1a-4f3e-9a51-6f0c2b7d9e10";
/** Feriados: a leitura inclui a carga geral (user_id nulo), e só ela. */
const FILTRO_FERIADOS = `user_id.is.null,user_id.eq.${USUARIO}`;

function semFiltroDoUsuario(c: Consulta): boolean {
  if (c.operacao === "insert" || c.operacao === "upsert") {
    const linhas = Array.isArray(c.valores) ? c.valores : [c.valores];
    return linhas.some((v) => (v as Record<string, unknown>).user_id !== USUARIO);
  }
  if (c.tabela === "feriados" && c.operacao === "select") return !c.filtros.some(([tipo, , valor]) => tipo === "or" && valor === FILTRO_FERIADOS);
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

  it("inserções em clientes e processo_detalhes sempre levam user_id explícito (no agente auth.uid() é nulo)", async () => {
    const processo: DadosProjeto = {
      name: "P",
      description: null,
      kind: "project",
      status: "active",
      color: "violet",
      icon: "scales",
      dueOn: null,
      campaign: null,
      clienteId: "k1",
      processo: { ...detalhesProcessoVazios("civel"), numeroCnj: "00012344720268210001" },
    };
    const chamadas = (r: Repositorio) => [
      r.criarCliente({ nome: "C", tipo: "pj", documento: "11222333000181", telefone: null, email: null, observacoes: null }),
      r.criarProjeto(processo, [{ title: "A fazer", kind: "todo" }]),
      r.atualizarProjeto("p1", { kind: "project", processo: processo.processo }),
    ];
    const gravacoes = (consultas: { tabela: string; operacao: string; valores?: unknown }[]) =>
      consultas
        .filter((c) => ["clientes", "processo_detalhes"].includes(c.tabela) && ["insert", "upsert"].includes(c.operacao))
        .flatMap((c) => (Array.isArray(c.valores) ? c.valores : [c.valores]).map((v) => ({ tabela: c.tabela, linha: v as Record<string, unknown> })));

    const { cliente, consultas } = criarClienteFalso();
    for (const p of chamadas(criarRepositorioDoAgente(USUARIO, cliente))) await p.catch(() => undefined);
    const linhas = gravacoes(consultas);
    expect(new Set(linhas.map((l) => l.tabela))).toEqual(new Set(["clientes", "processo_detalhes"]));
    expect(linhas.filter((l) => !("user_id" in l.linha))).toEqual([]);
    expect(linhas.every((l) => l.linha.user_id === USUARIO)).toBe(true);

    // Controle: o repositório cru não manda user_id (dependeria do default auth.uid(), nulo no agente).
    const cru = criarClienteFalso();
    for (const p of chamadas(criarRepositorioSupabase(cru.cliente))) await p.catch(() => undefined);
    expect(gravacoes(cru.consultas).some((l) => !("user_id" in l.linha))).toBe(true);
  });

  it("controle: sem o embrulho, as mesmas chamadas saem sem filtro (o teste enxerga a falha)", async () => {
    const { cliente, consultas } = criarClienteFalso();
    const cru = criarRepositorioSupabase(cliente);
    for (const chamar of Object.values(CHAMADAS)) await chamar(cru).catch(() => undefined);
    expect(consultas.filter(semFiltroDoUsuario).length).toBeGreaterThan(20);
  });

  it("recusa contexto sem usuário ou com usuário que não é uuid (ele entra no filtro dos feriados)", () => {
    const { cliente } = criarClienteFalso();
    expect(() => criarRepositorioDoAgente("", cliente)).toThrow(/sem usuário/);
    expect(() => criarRepositorioDoAgente("x,user_id.not.is.null", cliente)).toThrow(/usuário inválido/);
  });

  it("feriados: lê a carga geral e os próprios, mas grava e exclui só os próprios", async () => {
    const { cliente, consultas } = criarClienteFalso();
    const repo = criarRepositorioDoAgente(USUARIO, cliente);
    await repo.listarFeriados();
    await repo.criarFeriado({ data: "2026-02-02", descricao: "Navegantes" });
    await repo.excluirFeriado("f1");
    expect(consultas.map((c) => [c.operacao, c.filtros.filter(([t]) => t === "or" || t === "eq").map(([t, col, v]) => `${t} ${col} ${v}`)])).toEqual([
      ["select", [`or  ${FILTRO_FERIADOS}`]],
      ["insert", []],
      ["delete", [`eq user_id ${USUARIO}`, "eq id f1"]],
    ]);
    expect(consultas[1].valores).toMatchObject({ user_id: USUARIO });
  });
});

/** Uma chamada de exemplo para cada método do repositório da captura do DJEN. */
const CHAMADAS_DJEN: Record<keyof RepositorioDjen, (r: RepositorioDjen) => Promise<unknown>> = {
  obterCaptura: (r) => r.obterCaptura(),
  salvarCaptura: (r) => r.salvarCaptura({ ligada: true, numeroOab: "9999991", ufOab: "RS", avisoAceitoEm: "2099-01-01T00:00:00Z" }),
  registrarEstadoDaConsulta: (r) => r.registrarEstadoDaConsulta({ ultimoResultado: "ok", ultimaConsultaOk: "2099-01-01", tentativasNoDia: 1, ultimaTentativaEm: "2099-01-01T10:00:00Z" }),
  inserirSugestoes: (r) =>
    r.inserirSugestoes([
      {
        djenId: 990000001, hash: null, numeroProcesso: "50000010020998210001", dataDisponibilizacao: "2099-03-09", sigiloso: true, tribunal: null, orgao: null,
        classe: null, tipoComunicacao: null, tipoDocumento: null, link: null, trecho: null, diasSituacao: null, dias: null, unidadeDias: null, trechoDias: null, resumoTeor: null,
      },
    ]),
  marcarCanceladas: (r) => r.marcarCanceladas([990000001], "2099-03-10T00:00:00Z"),
  listarSugestoes: (r) => r.listarSugestoes({ status: ["pendente"] }),
  apagarSugestoesPendentes: (r) => r.apagarSugestoesPendentes(),
};

describe("repositório da captura do DJEN no agente", () => {
  it("tem um caso de teste para cada método", () => {
    const { cliente } = criarClienteFalso();
    expect(Object.keys(criarRepositorioDjenDoAgente(USUARIO, cliente)).sort()).toEqual(Object.keys(CHAMADAS_DJEN).sort());
  });

  for (const [nome, chamar] of Object.entries(CHAMADAS_DJEN)) {
    it(`${nome}: nenhuma consulta sai sem o filtro do usuário`, async () => {
      const { cliente, consultas } = criarClienteFalso();
      await chamar(criarRepositorioDjenDoAgente(USUARIO, cliente)).catch(() => undefined);
      expect(consultas.length).toBeGreaterThan(0);
      expect(consultas.filter(semFiltroDoUsuario)).toEqual([]);
    });
  }

  it("controle: sem o embrulho, as mesmas chamadas saem sem filtro", async () => {
    const { cliente, consultas } = criarClienteFalso();
    const cru = criarRepositorioDjenSupabase(cliente);
    for (const chamar of Object.values(CHAMADAS_DJEN)) await chamar(cru).catch(() => undefined);
    expect(consultas.filter(semFiltroDoUsuario).length).toBeGreaterThanOrEqual(7);
  });

  it("inserção sem duplicar: on conflict (user_id, djen_id) do nothing", async () => {
    const { cliente, consultas } = criarClienteFalso();
    await CHAMADAS_DJEN.inserirSugestoes(criarRepositorioDjenDoAgente(USUARIO, cliente));
    expect(consultas[0]).toMatchObject({ tabela: "comunicacoes_djen", operacao: "upsert", opcoes: { onConflict: "user_id,djen_id", ignoreDuplicates: true } });
  });
});
