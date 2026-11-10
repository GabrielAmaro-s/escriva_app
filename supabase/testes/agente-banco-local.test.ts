// Ferramentas jurídicas do agente (etapa 4) contra o Supabase local, pelo repositório do agente
// (cliente admin com user_id forçado), como roda no servidor MCP. Rode com: npm run test:banco-local
// (precisa de `npx supabase start`). Cria dois usuários novos a cada rodada.
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { criarRepositorioDoAgente } from "@/data/supabase/contexto-agente";
import { AVISO_CONTAGEM_EM_VALIDACAO } from "@/domain/prazos";
import type { ContextoAgente } from "@/services/agente/auxiliares";
import { executarFerramenta } from "@/services/agente/executar";
import { criarFerramentas } from "@/services/agente/ferramentas";

const URL = process.env.SB_URL!;
const SERVICO = process.env.SB_SERVICE!;
if (!URL || !SERVICO) throw new Error("Rode com npm run test:banco-local (o script lê as chaves de `supabase status`).");
// O teste grava e apaga dados: só no Supabase local.
if (!["127.0.0.1", "localhost", "[::1]"].includes(new globalThis.URL(URL).hostname)) throw new Error(`Recusado: ${URL} não é o Supabase local.`);

const admin = createClient(URL, SERVICO, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const ferramentas = criarFerramentas({ limiteItens: 10 });
const AGORA = new Date("2026-11-10T12:00:00.000Z"); // 9h em São Paulo

async function usuario(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({ email, password: "senha-de-teste-123", email_confirm: true });
  if (error) throw error;
  return data.user.id;
}

const contexto = (userId: string): ContextoAgente => ({
  repo: criarRepositorioDoAgente(userId, admin),
  fuso: "America/Sao_Paulo",
  urlApp: "https://myplan.teste",
  limiteItens: 10,
  agora: () => AGORA,
});

async function chamar(ctx: ContextoAgente, nome: string, entrada: Record<string, unknown>, escopo: "leitura" | "escrita" = "escrita") {
  const f = ferramentas.find((x) => x.nome === nome)!;
  return executarFerramenta(f, ctx, entrada, { tokenId: null, escopo });
}

const marca = Date.now();
const CNJ_TJRS = "0001234-47.2026.8.21.0001"; // fictício, só para o teste
const CNJ_TRT4 = "0000555-40.2026.5.04.0011"; // fictício, só para o teste
const INTIMACAO = { processo: CNJ_TJRS, disponibilizacao: "2026-11-06", meio: "dje", dias: 15, texto_original: "Manifeste-se em 15 dias sobre a contestação." };
let A: string;
let B: string;
let ctxA: ContextoAgente;
let ctxB: ContextoAgente;

beforeAll(async () => {
  A = await usuario(`ga-${marca}@teste.local`);
  B = await usuario(`gb-${marca}@teste.local`);
  ctxA = contexto(A);
  ctxB = contexto(B);
});

describe("criar_processo pelo agente", () => {
  it("cria processo, detalhes e cliente com o user_id certo", async () => {
    const r = await chamar(ctxA, "criar_processo", { nome: "Cobrança no JEC", numero_cnj: CNJ_TJRS, area: "civel", orgao: "Juizado Especial Cível", cliente: "Cliente de Teste" });
    expect(r.erro).toBe(false);
    expect(r.corpo).toMatchObject({ cliente_cadastrado: true, processo: { numero_cnj: CNJ_TJRS, tribunal: "TJRS", cliente: "Cliente de Teste" } });
    const p = (await admin.from("projects").select("id, user_id, icon, cliente_id").eq("name", "Cobrança no JEC").eq("user_id", A).single()).data!;
    expect(p).toMatchObject({ user_id: A, icon: "scales" });
    const d = (await admin.from("processo_detalhes").select("user_id, numero_cnj, orgao").eq("project_id", p.id).single()).data!;
    expect(d).toEqual({ user_id: A, numero_cnj: "00012344720268210001", orgao: "Juizado Especial Cível" });
    const c = (await admin.from("clientes").select("user_id, nome").eq("id", p.cliente_id).single()).data!;
    expect(c).toEqual({ user_id: A, nome: "Cliente de Teste" });
  });

  it("número repetido na mesma conta é recusado; em outra conta é aceito", async () => {
    expect((await chamar(ctxA, "criar_processo", { nome: "Outro", numero_cnj: CNJ_TJRS })).corpo.erro).toBe("Já existe um processo com esse número. Nada foi registrado.");
    expect((await chamar(ctxB, "criar_processo", { nome: "Processo de B", numero_cnj: CNJ_TJRS })).erro).toBe(false);
  });
});

describe("registrar_intimacao pelo agente", () => {
  it("prévia sem gravar; com o sim e o prazo da prévia, cria o prazo, os 3 lembretes e o histórico como agente", async () => {
    const previa = await chamar(ctxA, "registrar_intimacao", INTIMACAO);
    expect(previa.corpo).toMatchObject({ precisa_confirmacao: true, aviso: AVISO_CONTAGEM_EM_VALIDACAO, prazo: { prazo_fatal: "2026-12-01", regra_codigo: "juizado", tribunal: "TJRS" } });
    const antes = (await admin.from("tasks").select("id").eq("user_id", A)).data!.length;
    expect(antes).toBe(0);

    const feito = await chamar(ctxA, "registrar_intimacao", { ...INTIMACAO, titulo: "Manifestação", confirmado: true, prazo_fatal_esperado: "2026-12-01" });
    expect(feito.erro).toBe(false);
    const t = (await admin.from("tasks").select("id, user_id, tipo, prazo_fatal, due_on, description").eq("user_id", A).eq("title", "Manifestação").single()).data!;
    expect(t).toMatchObject({ user_id: A, tipo: "prazo", prazo_fatal: "2026-12-01", description: INTIMACAO.texto_original });
    const lembretes = (await admin.from("lembretes").select("user_id, automatico, status").eq("tarefa_id", t.id)).data!;
    expect(lembretes.map((l) => l.automatico).sort()).toEqual(["d-1", "d-3", "dia"]);
    expect(lembretes.every((l) => l.user_id === A && l.status === "pendente")).toBe(true);
    const historico = (await admin.from("registro_alteracoes").select("origem, user_id").eq("entidade_id", t.id)).data ?? [];
    expect(historico.length).toBeGreaterThan(0);
    expect(historico.every((h) => h.origem === "agente" && h.user_id === A)).toBe(true);
  });

  it("a segunda intimação igual avisa que parece repetida", async () => {
    const r = await chamar(ctxA, "registrar_intimacao", INTIMACAO);
    expect(r.corpo.mensagem).toContain("Parece repetido:");
  });

  it("o número de A não existe para o agente de B (que tem um processo com o mesmo número, mas só seu)", async () => {
    await chamar(ctxA, "criar_processo", { nome: "Só de A", numero_cnj: CNJ_TRT4, area: "trabalhista" });
    const r = await chamar(ctxB, "registrar_intimacao", { ...INTIMACAO, processo: CNJ_TRT4 });
    expect(r.corpo.erro).toBe(`Não achei o processo ${CNJ_TRT4} na sua conta. Nada foi registrado. Quer que eu cadastre o processo?`);
  });

  it("prazo do TRT4 que atravessa o recesso, com a carga de feriados do banco", async () => {
    const r = await chamar(ctxA, "registrar_intimacao", { ...INTIMACAO, processo: CNJ_TRT4, disponibilizacao: "2026-12-15", dias: 8 });
    expect(r.corpo).toMatchObject({ precisa_confirmacao: true, prazo: { prazo_fatal: "2027-01-28", tribunal: "TRT4", regra_codigo: "trabalhista" } });
    expect((r.corpo.prazo as { memoria: string }).memoria).toContain("recesso");
  });
});

describe("leitura pelo agente", () => {
  it("prazos_proximos traz o prazo de A só para A, inclusive com token de leitura", async () => {
    const a = await chamar(ctxA, "prazos_proximos", { dias: 30 }, "leitura");
    expect(a.erro).toBe(false);
    expect((a.corpo.prazos as { titulo: string }[]).map((p) => p.titulo)).toContain("Manifestação");
    const b = await chamar(ctxB, "prazos_proximos", { dias: 30 }, "leitura");
    expect(b.corpo.prazos).toEqual([]);
  });

  it("audiencias_proximas lê a coluna nova sem erro", async () => {
    const r = await chamar(ctxA, "audiencias_proximas", { dias: 7 }, "leitura");
    expect(r).toMatchObject({ erro: false, corpo: { mensagem: "Nenhuma audiência até 17/11." } });
  });

  it("as chamadas ficam no registro do agente de cada um", async () => {
    const deA = (await admin.from("registro_agente").select("ferramenta").eq("user_id", A)).data!.map((l) => l.ferramenta);
    expect(deA).toEqual(expect.arrayContaining(["criar_processo", "registrar_intimacao", "prazos_proximos"]));
  });
});
