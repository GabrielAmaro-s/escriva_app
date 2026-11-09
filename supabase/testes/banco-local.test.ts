// Teste da migração 0004 contra o Supabase local. Rode com: npm run test:banco-local
// (precisa de `npx supabase start`; para começar limpo, `npx supabase db reset`).
// Usa o código real do app: repositório Supabase, repositório do agente e serviços.
// Cria dois usuários novos a cada rodada, então pode rodar de novo sem reset.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { criarRepositorioDoAgente } from "@/data/supabase/contexto-agente";
import { traduzirErroDoBanco } from "@/data/supabase/erros";
import { criarRepositorioSupabase } from "@/data/supabase/repositorio-supabase";
import { ErroDeConflito } from "@/domain/erros";
import { detalhesProcessoVazios } from "@/domain/processo";
import { dadosProjetoVazios } from "@/domain/projeto";
import { criarCliente } from "@/services/clientes";
import { criarProjeto } from "@/services/projetos";

const URL = process.env.SB_URL!;
const ANON = process.env.SB_ANON!;
const SERVICO = process.env.SB_SERVICE!;
if (!URL || !ANON || !SERVICO) throw new Error("Rode com npm run test:banco-local (o script lê as chaves de `supabase status`).");
// O teste grava e apaga dados: só no Supabase local.
if (!["127.0.0.1", "localhost", "[::1]"].includes(new globalThis.URL(URL).hostname)) throw new Error(`Recusado: ${URL} não é o Supabase local.`);

const sem = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(URL, SERVICO, sem);

async function usuario(email: string): Promise<{ id: string; sb: SupabaseClient }> {
  const { data, error } = await admin.auth.admin.createUser({ email, password: "senha-de-teste-123", email_confirm: true });
  if (error) throw error;
  const sb = createClient(URL, ANON, sem);
  const login = await sb.auth.signInWithPassword({ email, password: "senha-de-teste-123" });
  if (login.error) throw login.error;
  return { id: data.user.id, sb };
}

const marca = Date.now();
let A: { id: string; sb: SupabaseClient };
let B: { id: string; sb: SupabaseClient };
let clienteA: string;
let clienteB: string;
let projetoA: string;

const CNJ = "00012344720268210001"; // fictício, só para o teste

beforeAll(async () => {
  A = await usuario(`a-${marca}@teste.local`);
  B = await usuario(`b-${marca}@teste.local`);
  const repoA = criarRepositorioSupabase(A.sb);
  const repoB = criarRepositorioSupabase(B.sb);
  clienteA = (await criarCliente(repoA, { nome: "Cliente de A", tipo: "pj", documento: "12.ABC.345/01DE-35", telefone: null, email: null, observacoes: null })).id;
  clienteB = (await criarCliente(repoB, { nome: "Cliente de B", tipo: "pf", documento: "529.982.247-25", telefone: null, email: null, observacoes: null })).id;
  const p = await criarProjeto(
    repoA,
    { ...dadosProjetoVazios(), name: "Processo de A", clienteId: clienteA, processo: { ...detalhesProcessoVazios("trabalhista"), numeroCnj: CNJ, valorCausa: 18500.5, segredoJustica: true } },
    "trabalhista",
  );
  projetoA = p.id;
});

describe("app contra o banco", () => {
  it("criar processo devolve cliente e detalhes (embutido processo_detalhes pela chave composta)", async () => {
    const lista = await criarRepositorioSupabase(A.sb).listarProjetos();
    const p = lista.find((x) => x.id === projetoA)!;
    expect(p).toMatchObject({ clienteId: clienteA, processo: { numeroCnj: CNJ, area: "trabalhista", valorCausa: 18500.5, segredoJustica: true } });
    const quadro = await criarRepositorioSupabase(A.sb).obterQuadro(projetoA);
    expect(quadro!.colunas.map((c) => c.title)).toEqual(["A fazer", "Em andamento", "Aguardando audiência", "Concluído"]);
  });

  it("CNPJ alfanumérico gravado sem pontuação", async () => {
    const [c] = await criarRepositorioSupabase(A.sb).listarClientes();
    expect(c.documento).toBe("12ABC34501DE35");
  });

  it("número repetido: ErroDeConflito com a mensagem e nenhum processo pela metade", async () => {
    const repoA = criarRepositorioSupabase(A.sb);
    const dados = { ...dadosProjetoVazios(), name: "Repetido", processo: { ...detalhesProcessoVazios("civel"), numeroCnj: CNJ } };
    const erro = await criarProjeto(repoA, dados).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroDeConflito);
    expect(erro.message).toBe("Já existe um processo com esse número.");
    expect((await repoA.listarProjetos()).some((p) => p.name === "Repetido")).toBe(false);
  });

  it("o mesmo número em outra conta é permitido (único por conta)", async () => {
    const p = await criarProjeto(criarRepositorioSupabase(B.sb), { ...dadosProjetoVazios(), name: "Processo de B", processo: { ...detalhesProcessoVazios("civel"), numeroCnj: CNJ } });
    expect(p.processo?.numeroCnj).toBe(CNJ);
  });

  it("CPF/CNPJ repetido: ErroDeConflito com a mensagem", async () => {
    const erro = await criarCliente(criarRepositorioSupabase(A.sb), { nome: "Outro", tipo: "pj", documento: "12ABC34501DE35", telefone: null, email: null, observacoes: null }).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroDeConflito);
    expect(erro.message).toBe("Já existe um cliente com esse CPF/CNPJ.");
  });

  it("atualizado_em muda no update (gatilho set_atualizado_em)", async () => {
    const antes = (await admin.from("clientes").select("atualizado_em").eq("id", clienteA).single()).data!.atualizado_em;
    await new Promise((r) => setTimeout(r, 20));
    const depois = await criarRepositorioSupabase(A.sb).atualizarCliente(clienteA, { telefone: "53 99999-0000" });
    expect(new Date(depois.atualizadoEm).getTime()).toBeGreaterThan(new Date(antes).getTime());
  });

  it("caso consultivo com tipo de serviço", async () => {
    const c = await criarProjeto(criarRepositorioSupabase(A.sb), { ...dadosProjetoVazios("campaign"), name: "Parecer de A", clienteId: clienteA, campaign: { objective: "Pedido", startsOn: "2026-11-01", endsOn: "2026-11-30", channels: [], deliverables: [], tipoServico: "Parecer" } });
    expect(c).toMatchObject({ kind: "campaign", clienteId: clienteA, processo: null, campaign: { tipoServico: "Parecer", endsOn: "2026-11-30" } });
  });
});

describe("RLS com dois usuários", () => {
  it("B não lê clientes nem processo_detalhes de A", async () => {
    expect((await B.sb.from("clientes").select("id")).data!.map((c) => c.id)).toEqual([clienteB]);
    expect((await B.sb.from("processo_detalhes").select("project_id").eq("project_id", projetoA)).data).toEqual([]);
    expect((await B.sb.from("clientes").select("id").eq("id", clienteA)).data).toEqual([]);
  });

  it("B não altera nem exclui clientes e processo_detalhes de A", async () => {
    const upd = await B.sb.from("clientes").update({ nome: "Invadido" }).eq("id", clienteA).select();
    expect(upd.data).toEqual([]);
    await B.sb.from("clientes").delete().eq("id", clienteA);
    const upd2 = await B.sb.from("processo_detalhes").update({ parte_contraria: "Invadido" }).eq("project_id", projetoA).select();
    expect(upd2.data).toEqual([]);
    await B.sb.from("processo_detalhes").delete().eq("project_id", projetoA);
    const cliente = (await admin.from("clientes").select("nome").eq("id", clienteA).single()).data!;
    const detalhes = (await admin.from("processo_detalhes").select("parte_contraria").eq("project_id", projetoA).single()).data!;
    expect(cliente.nome).toBe("Cliente de A");
    expect(detalhes.parte_contraria).toBeNull();
  });

  it("B não grava linhas em nome de A", async () => {
    const c = await B.sb.from("clientes").insert({ nome: "Falso", user_id: A.id });
    expect(c.error?.code).toBe("42501");
    const d = await B.sb.from("processo_detalhes").upsert({ project_id: projetoA, user_id: A.id, tribunal: "X" });
    expect(d.error).not.toBeNull();
  });

  it("B não liga o processo dele ao cliente de A, nem detalhes ao processo de A", async () => {
    const [pB] = await criarRepositorioSupabase(B.sb).listarProjetos();
    const e1 = await criarRepositorioSupabase(B.sb).atualizarProjeto(pB.id, { clienteId: clienteA }).catch((e) => e);
    expect(e1.message).toBe("Cliente não encontrado.");
    const e2 = await B.sb.from("processo_detalhes").insert({ project_id: projetoA, user_id: B.id });
    expect(e2.error).not.toBeNull();
  });
});

describe("chave composta com a chave de serviço (ignora o RLS)", () => {
  it("recusa cliente_id de outra conta", async () => {
    const r = await admin.from("projects").update({ cliente_id: clienteB }).eq("id", projetoA);
    expect(r.error?.code).toBe("23503");
    expect(traduzirErroDoBanco(r.error!).message).toBe("Cliente não encontrado.");
    expect((await admin.from("projects").select("cliente_id").eq("id", projetoA).single()).data!.cliente_id).toBe(clienteA);
  });

  it("recusa processo_detalhes com user_id diferente do dono do projeto (inserir e trocar o dono)", async () => {
    // Projeto novo de B, sem detalhes e sem número (o índice único não entra no caminho).
    const pB = (await admin.from("projects").insert({ user_id: B.id, name: "Outro de B", kind: "project" }).select("id").single()).data!;
    const inserir = await admin.from("processo_detalhes").insert({ project_id: pB.id, user_id: A.id });
    expect(inserir.error?.code).toBe("23503");
    expect((await admin.from("processo_detalhes").insert({ project_id: pB.id, user_id: B.id })).error).toBeNull();
    const trocar = await admin.from("processo_detalhes").update({ user_id: A.id }).eq("project_id", pB.id);
    expect(trocar.error?.code).toBe("23503");
    expect((await admin.from("processo_detalhes").select("user_id").eq("project_id", pB.id).single()).data!.user_id).toBe(B.id);
  });

  it("sem user_id explícito a inserção falha (auth.uid() é nulo com a chave de serviço)", async () => {
    const r = await admin.from("clientes").insert({ nome: "Sem dono" });
    expect(r.error?.code).toBe("23502");
  });

  it("o repositório do agente grava com user_id e funciona", async () => {
    const agente = criarRepositorioDoAgente(A.id, admin);
    const c = await agente.criarCliente({ nome: "Cliente pelo agente", tipo: "pf", documento: null, telefone: null, email: null, observacoes: null });
    const p = await agente.criarProjeto({ ...dadosProjetoVazios(), name: "Processo pelo agente", clienteId: c.id, processo: detalhesProcessoVazios("familia") }, [{ title: "A fazer", kind: "todo" }]);
    expect(p).toMatchObject({ clienteId: c.id, processo: { area: "familia" } });
    const dono = (await admin.from("processo_detalhes").select("user_id").eq("project_id", p.id).single()).data!;
    expect(dono.user_id).toBe(A.id);
    // e o agente de A não enxerga nada de B
    expect((await agente.listarClientes()).some((x) => x.id === clienteB)).toBe(false);
  });
});

describe("excluir cliente", () => {
  it("deixa cliente_id nulo e mantém o projeto e o user_id", async () => {
    await criarRepositorioSupabase(A.sb).excluirCliente(clienteA);
    const p = (await admin.from("projects").select("id, user_id, cliente_id").eq("id", projetoA).single()).data!;
    expect(p).toEqual({ id: projetoA, user_id: A.id, cliente_id: null });
    expect((await criarRepositorioSupabase(A.sb).listarProjetos()).find((x) => x.id === projetoA)?.processo?.numeroCnj).toBe(CNJ);
  });

  it("excluir o projeto apaga os detalhes em cascata", async () => {
    await criarRepositorioSupabase(A.sb).excluirProjeto(projetoA);
    expect((await admin.from("processo_detalhes").select("project_id").eq("project_id", projetoA)).data).toEqual([]);
  });
});
