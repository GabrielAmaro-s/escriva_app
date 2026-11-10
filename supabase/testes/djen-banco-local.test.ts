// ============================================================================================
// NÃO EXECUTADO. Escrito na etapa 5, fatia 1 (10/11/2026), sem Docker na máquina de trabalho.
// Ele precisa passar no Supabase local, com a 0006 aplicada, antes do merge da branch
// juridico/etapa-5-captura:
//   npx supabase start && npx supabase db reset && npm run test:banco-local
// A lista dos testes que faltam rodar está em docs/relatorios/etapa-5-fatia-1.md (seção 6).
// ============================================================================================
//
// Teste da migração 0006 (captura do DJEN) contra o Supabase local.
// Cria dois usuários novos a cada rodada, então pode rodar de novo sem reset.
// Todos os dados são fictícios (OAB 9999991/RS, processos de 2099).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import pagina from "@/data/djen/exemplos/pagina-1.json";
import { paraComunicacaoRecebida, type ItemDjen } from "@/data/djen/cliente-djen";
import type { RepositorioDjen } from "@/data/repositorio-djen";
import { criarRepositorioDjenDoAgente } from "@/data/supabase/contexto-agente";
import { criarRepositorioDjenSupabase } from "@/data/supabase/repositorio-djen";
import type { ComunicacaoRecebida } from "@/domain/djen";
import { concluirConsulta, desligarCaptura, iniciarConsulta, ligarCaptura, obterCaptura, receberComunicacoes } from "@/services/captura-djen";

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

const FUSO = "America/Sao_Paulo";
const as = (dia: string, hora: string) => ({ fuso: FUSO, agora: new Date(`${dia}T${hora}:00-03:00`) });
const recebidas = (): ComunicacaoRecebida[] =>
  (pagina.items as ItemDjen[]).map((i) => paraComunicacaoRecebida(i, "9999991", "RS")).filter((c): c is ComunicacaoRecebida => c !== null);

const marca = Date.now();
let A: { id: string; sb: SupabaseClient };
let B: { id: string; sb: SupabaseClient };
/** Sessão do app (RLS e grants por coluna). */
let appA: RepositorioDjen;
let appB: RepositorioDjen;
/** O servidor, chamado pela VPS com o token (chave de serviço com user_id forçado). */
let servidorA: RepositorioDjen;
let servidorB: RepositorioDjen;

/** Linha válida de comunicacoes_djen para inserir direto com a chave de serviço. */
const linha = (userId: string, djenId: number, mudar: Record<string, unknown> = {}) => ({
  user_id: userId,
  djen_id: djenId,
  numero_processo: "50000010020998210001",
  data_disponibilizacao: "2099-03-09",
  sigiloso: false,
  dias_situacao: "nao_identificados",
  ...mudar,
});

beforeAll(async () => {
  A = await usuario(`djen-a-${marca}@teste.local`);
  B = await usuario(`djen-b-${marca}@teste.local`);
  appA = criarRepositorioDjenSupabase(A.sb);
  appB = criarRepositorioDjenSupabase(B.sb);
  servidorA = criarRepositorioDjenDoAgente(A.id, admin);
  servidorB = criarRepositorioDjenDoAgente(B.id, admin);
});

describe("captura_djen", () => {
  it("começa sem linha (desligada) e liga pela sessão do app, com o user_id do dono", async () => {
    expect(await appA.obterCaptura()).toBeNull();
    const c = await ligarCaptura(appA, { numeroOab: "9999991", ufOab: "RS", avisoAceito: true }, as("2099-03-01", "10:00"));
    expect(c).toMatchObject({ ligada: true, numeroOab: "9999991", ufOab: "RS", tentativasNoDia: 0, ultimaConsultaOk: null });
    const { data } = await admin.from("captura_djen").select("user_id").eq("user_id", A.id).single();
    expect(data?.user_id).toBe(A.id);
  });

  it("ligada exige OAB, UF e aceite; OAB e UF seguem o formato", async () => {
    expect((await admin.from("captura_djen").insert({ user_id: B.id, ligada: true })).error?.code).toBe("23514");
    expect((await admin.from("captura_djen").insert({ user_id: B.id, numero_oab: "012345", uf_oab: "RS" })).error?.code).toBe("23514");
    expect((await admin.from("captura_djen").insert({ user_id: B.id, numero_oab: "12345", uf_oab: "XX" })).error?.code).toBe("23514");
  });

  it("o advogado não grava o estado da consulta (grants por coluna)", async () => {
    expect((await A.sb.from("captura_djen").update({ ultima_consulta_ok: "2099-03-19" }).eq("user_id", A.id)).error?.code).toBe("42501");
    expect((await A.sb.from("captura_djen").update({ tentativas_no_dia: 0 }).eq("user_id", A.id)).error?.code).toBe("42501");
    expect((await B.sb.from("captura_djen").insert({ ultimo_resultado: "ok" })).error?.code).toBe("42501");
    await expect(appA.registrarEstadoDaConsulta({ ultimoResultado: "ok" })).rejects.toThrow();
  });

  it("o servidor grava o estado; trocar a OAB zera a última consulta boa (gatilho)", async () => {
    await servidorA.registrarEstadoDaConsulta({ ultimaConsultaOk: "2099-03-19", ultimoResultado: "ok" });
    expect(await obterCaptura(appA)).toMatchObject({ ultimaConsultaOk: "2099-03-19", ultimoResultado: "ok" });
    await ligarCaptura(appA, { numeroOab: "9999991", ufOab: "RS", avisoAceito: true }, as("2099-03-19", "20:00"));
    expect((await obterCaptura(appA)).ultimaConsultaOk).toBe("2099-03-19"); // mesma OAB: mantém
    await ligarCaptura(appA, { numeroOab: "9999992", ufOab: "RS", avisoAceito: true }, as("2099-03-19", "20:00"));
    expect((await obterCaptura(appA)).ultimaConsultaOk).toBeNull();
    await ligarCaptura(appA, { numeroOab: "9999991", ufOab: "RS", avisoAceito: true }, as("2099-03-19", "20:00"));
  });

  it("isolamento: B não lê nem altera a captura de A", async () => {
    expect(await appB.obterCaptura()).toBeNull();
    const r = await B.sb.from("captura_djen").update({ ligada: false }).eq("user_id", A.id).select("user_id");
    expect(r.data).toEqual([]);
    expect((await obterCaptura(appA)).ligada).toBe(true);
    expect(await servidorB.obterCaptura()).toBeNull();
  });
});

describe("comunicacoes_djen", () => {
  it("o fluxo da VPS grava as sugestões de A pelo servidor, sem duplicar", async () => {
    const plano = await iniciarConsulta(servidorA, as("2099-03-20", "07:00"));
    expect(plano).toMatchObject({ consultar: true, tentativa: 1 });
    expect(await receberComunicacoes(servidorA, recebidas(), as("2099-03-20", "07:00"))).toMatchObject({ novas: 4 });
    expect(await receberComunicacoes(servidorA, recebidas(), as("2099-03-20", "07:01"))).toMatchObject({ novas: 0, repetidas: 5 });
    if (plano.consultar) await concluirConsulta(servidorA, { resultado: "ok", janela: plano.janela }, as("2099-03-20", "07:02"));
    expect(await obterCaptura(appA)).toMatchObject({ ultimaConsultaOk: "2099-03-20", ultimoResultado: "ok", tentativasNoDia: 1 });
    const lista = await appA.listarSugestoes();
    expect(lista.map((s) => s.djenId).sort()).toEqual([990000001, 990000002, 990000003, 990000004]);
    expect(lista.find((s) => s.djenId === 990000001)).toMatchObject({ dias: 15, diasSituacao: "identificados", status: "pendente" });
  });

  it("o mesmo djen_id em outra conta é outra sugestão", async () => {
    await ligarCaptura(appB, { numeroOab: "9999991", ufOab: "RS", avisoAceito: true }, as("2099-03-20", "08:00"));
    expect(await receberComunicacoes(servidorB, recebidas().slice(0, 1), as("2099-03-20", "08:00"))).toMatchObject({ novas: 1 });
  });

  it("isolamento: B só enxerga e mexe nas próprias", async () => {
    expect((await appB.listarSugestoes()).map((s) => s.djenId)).toEqual([990000001]);
    const idDeA = (await appA.listarSugestoes()).find((s) => s.djenId === 990000002)!.id;
    expect((await B.sb.from("comunicacoes_djen").update({ status: "descartada" }).eq("id", idDeA).select("id")).data).toEqual([]);
    expect((await B.sb.from("comunicacoes_djen").delete().eq("id", idDeA).select("id")).data).toEqual([]);
    expect((await servidorB.listarSugestoes()).map((s) => s.djenId)).toEqual([990000001]);
    expect((await appA.listarSugestoes()).find((s) => s.id === idDeA)?.status).toBe("pendente");
  });

  it("pela sessão, o advogado não insere sugestão nem muda o conteúdo; só o status", async () => {
    expect((await A.sb.from("comunicacoes_djen").insert(linha(A.id, 990009001))).error?.code).toBe("42501");
    const id = (await appA.listarSugestoes()).find((s) => s.djenId === 990000002)!.id;
    expect((await A.sb.from("comunicacoes_djen").update({ trecho: "outro" }).eq("id", id)).error?.code).toBe("42501");
    expect((await A.sb.from("comunicacoes_djen").update({ status: "descartada" }).eq("id", id).select("status")).data).toEqual([{ status: "descartada" }]);
    expect((await A.sb.from("comunicacoes_djen").update({ status: "outro" }).eq("id", id)).error?.code).toBe("23514");
  });

  it("checks: sigiloso sem teor, dias coerentes, número com 20 dígitos", async () => {
    const tentar = async (mudar: Record<string, unknown>, id: number) => (await admin.from("comunicacoes_djen").insert(linha(A.id, id, mudar))).error?.code;
    expect(await tentar({ sigiloso: true, dias_situacao: null, orgao: "Vara" }, 990009101)).toBe("23514");
    expect(await tentar({ sigiloso: true, dias_situacao: null }, 990009102)).toBeUndefined();
    expect(await tentar({ dias_situacao: null }, 990009103)).toBe("23514");
    expect(await tentar({ dias_situacao: "identificados" }, 990009104)).toBe("23514");
    expect(await tentar({ dias_situacao: "identificados", dias: 15 }, 990009105)).toBe("23514");
    expect(await tentar({ dias_situacao: "identificados", dias: 15, trecho_dias: "no prazo de 15 dias" }, 990009106)).toBeUndefined();
    expect(await tentar({ dias_situacao: "nao_identificados", dias: 15, trecho_dias: "x" }, 990009107)).toBe("23514");
    expect(await tentar({ numero_processo: "5000001-00.2099.8.21.0001" }, 990009108)).toBe("23514");
    expect(await tentar({ trecho: "x".repeat(601) }, 990009109)).toBe("23514");
    expect(await tentar({ djen_id: 0 }, 990009110)).toBe("23514");
    expect(await tentar({}, 990009106)).toBe("23505"); // mesmo (user_id, djen_id)
  });

  it("cancelada pelo tribunal: pendente vira cancelada; registrada só ganha a marca", async () => {
    const id3 = (await appA.listarSugestoes()).find((s) => s.djenId === 990000003)!.id;
    await admin.from("comunicacoes_djen").update({ status: "registrada" }).eq("id", id3);
    const [, , c3] = recebidas();
    const c1 = recebidas()[0];
    expect(await receberComunicacoes(servidorA, [{ ...c1, ativa: false }, { ...c3, ativa: false }], as("2099-03-21", "07:00"))).toMatchObject({ canceladas: 1 });
    const lista = await appA.listarSugestoes();
    expect(lista.find((s) => s.djenId === 990000001)).toMatchObject({ status: "cancelada" });
    expect(lista.find((s) => s.djenId === 990000003)).toMatchObject({ status: "registrada" });
    expect(lista.find((s) => s.djenId === 990000003)!.canceladaNoDjenEm).not.toBeNull();
  });

  it("desligar apaga só as pendentes da própria conta", async () => {
    const antesB = (await appB.listarSugestoes()).length;
    const { apagadas } = await desligarCaptura(appA);
    expect(apagadas).toBeGreaterThan(0);
    expect((await appA.listarSugestoes({ status: ["pendente"] })).length).toBe(0);
    expect((await appA.listarSugestoes({ status: ["registrada"] })).length).toBe(1);
    expect((await appB.listarSugestoes()).length).toBe(antesB);
  });
});

describe("retenção", () => {
  it("só o servidor roda a limpeza", async () => {
    expect((await A.sb.rpc("limpar_comunicacoes_djen", { hoje: "2099-12-31" })).error?.code).toBe("42501");
    expect((await createClient(URL, ANON, sem).rpc("limpar_comunicacoes_djen")).error?.code).toBe("42501");
  });

  it("30 dias para as não registradas e as sigilosas; 1 ano para as registradas", async () => {
    const hoje = "2099-06-30";
    const linhas = [
      linha(B.id, 990008001, { data_disponibilizacao: "2099-05-31" }), // 30 dias: fica
      linha(B.id, 990008002, { data_disponibilizacao: "2099-05-30" }), // 31 dias: sai
      linha(B.id, 990008003, { data_disponibilizacao: "2099-05-30", status: "descartada" }), // sai
      linha(B.id, 990008004, { data_disponibilizacao: "2099-05-30", sigiloso: true, dias_situacao: null }), // sai
      linha(B.id, 990008005, { data_disponibilizacao: "2098-06-30", status: "registrada" }), // 365 dias: fica
      linha(B.id, 990008006, { data_disponibilizacao: "2098-06-29", status: "registrada" }), // 366 dias: sai
      linha(B.id, 990008007, { data_disponibilizacao: "2099-05-30", status: "registrada" }), // registrada recente: fica
    ];
    expect((await admin.from("comunicacoes_djen").insert(linhas)).error).toBeNull();
    const r = await admin.rpc("limpar_comunicacoes_djen", { hoje });
    expect(r.error).toBeNull();
    const ficaram = (await admin.from("comunicacoes_djen").select("djen_id").eq("user_id", B.id).gte("djen_id", 990008000).lte("djen_id", 990008999)).data!.map((l) => Number(l.djen_id)).sort();
    expect(ficaram).toEqual([990008001, 990008005, 990008007]);
  });
});

describe("sem login (anon)", () => {
  it("não lê nem grava nada da captura", async () => {
    const anon = createClient(URL, ANON, sem);
    for (const tabela of ["captura_djen", "comunicacoes_djen"]) {
      expect((await anon.from(tabela).select("*").limit(1)).error?.code).toBe("42501");
    }
    expect((await anon.from("captura_djen").insert({ ligada: false })).error?.code).toBe("42501");
  });
});
