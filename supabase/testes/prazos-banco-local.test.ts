// Teste da migração 0005 contra o Supabase local. Rode com: npm run test:banco-local
// (precisa de `npx supabase start`; para começar limpo, `npx supabase db reset`).
// Cria dois usuários novos a cada rodada, então pode rodar de novo sem reset.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

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

/** Projeto com uma coluna, gravado pela sessão do usuário. */
async function quadro(sb: SupabaseClient, nome: string): Promise<{ projeto: string; coluna: string }> {
  const p = await sb.from("projects").insert({ name: nome }).select("id").single();
  if (p.error) throw p.error;
  const c = await sb.from("board_columns").insert({ project_id: p.data.id, title: "A fazer", kind: "todo" }).select("id").single();
  if (c.error) throw c.error;
  return { projeto: p.data.id, coluna: c.data.id };
}

const marca = Date.now();
let A: { id: string; sb: SupabaseClient };
let B: { id: string; sb: SupabaseClient };
let quadroA: { projeto: string; coluna: string };
let feriadoA: string;

beforeAll(async () => {
  A = await usuario(`pa-${marca}@teste.local`);
  B = await usuario(`pb-${marca}@teste.local`);
  quadroA = await quadro(A.sb, "Processo de A");
  const f = await A.sb.from("feriados").insert({ data: "2026-02-02", descricao: "Navegantes (Porto Alegre)" }).select("id, user_id").single();
  if (f.error) throw f.error;
  expect(f.data.user_id).toBe(A.id); // default auth.uid()
  feriadoA = f.data.id;
});

describe("tarefas", () => {
  it("tarefa sem tipo fica como providência, sem prazo fatal nem contagem", async () => {
    const t = await A.sb.from("tasks").insert({ project_id: quadroA.projeto, column_id: quadroA.coluna, title: "Ligar para o cliente" }).select().single();
    expect(t.error).toBeNull();
    expect(t.data).toMatchObject({ tipo: "providencia", prazo_fatal: null, contagem: null, local_audiencia: null, horario_audiencia: null });
  });

  it("prazo fatal só em prazo, e local e horário só em audiência", async () => {
    const base = { project_id: quadroA.projeto, column_id: quadroA.coluna, title: "Inválida" };
    const r1 = await A.sb.from("tasks").insert({ ...base, tipo: "providencia", prazo_fatal: "2026-12-01" });
    expect(r1.error?.code).toBe("23514");
    const r2 = await A.sb.from("tasks").insert({ ...base, tipo: "prazo", local_audiencia: "Sala 3" });
    expect(r2.error?.code).toBe("23514");
    const r3 = await A.sb.from("tasks").insert({ ...base, tipo: "outro" });
    expect(r3.error?.code).toBe("23514");
    const ok = await A.sb.from("tasks").insert({ ...base, title: "Audiência", tipo: "audiencia", local_audiencia: "Sala 3", horario_audiencia: "2026-12-03T14:00:00-03:00" });
    expect(ok.error).toBeNull();
  });
});

describe("feriados: RLS com dois usuários", () => {
  it("A e B leem a carga geral (TJRS, TRT4 e TRF4)", async () => {
    for (const u of [A, B]) {
      const { data } = await u.sb.from("feriados").select("tribunal, data").is("user_id", null);
      const chaves = data!.map((f) => `${f.tribunal} ${f.data}`);
      expect(chaves).toContain("TJRS 2026-09-20");
      expect(chaves).toContain("TRT4 2026-08-11");
      expect(chaves).toContain("TRF4 2026-12-08");
    }
  });

  it("a carga não traz a Data Magna para o TRF4, nem datas inventadas para o TJRS", async () => {
    const { data } = await A.sb.from("feriados").select("tribunal, data").is("user_id", null);
    expect(data!.filter((f) => f.tribunal === "TRF4" && f.data.endsWith("-09-20"))).toEqual([]);
    expect(data!.filter((f) => f.tribunal === "TJRS").map((f) => f.data).sort()).toEqual(["2026-09-20", "2027-09-20"]);
  });

  it("B não lê o feriado local de A", async () => {
    expect((await B.sb.from("feriados").select("id").eq("id", feriadoA)).data).toEqual([]);
    expect((await A.sb.from("feriados").select("id").eq("id", feriadoA)).data).toHaveLength(1);
  });

  it("B não altera nem exclui o feriado de A", async () => {
    const upd = await B.sb.from("feriados").update({ descricao: "Invadido" }).eq("id", feriadoA).select();
    expect(upd.data).toEqual([]);
    await B.sb.from("feriados").delete().eq("id", feriadoA);
    const f = (await admin.from("feriados").select("descricao").eq("id", feriadoA).single()).data!;
    expect(f.descricao).toBe("Navegantes (Porto Alegre)");
  });

  it("ninguém grava feriado geral nem em nome de outro", async () => {
    const geral = await B.sb.from("feriados").insert({ user_id: null, tribunal: "TJRS", data: "2026-03-03", descricao: "Falso" });
    expect(geral.error?.code).toBe("42501");
    const deA = await B.sb.from("feriados").insert({ user_id: A.id, data: "2026-03-04", descricao: "Falso" });
    expect(deA.error?.code).toBe("42501");
  });

  it("ninguém altera nem exclui a carga geral", async () => {
    const [geral] = (await admin.from("feriados").select("id").is("user_id", null).eq("tribunal", "TJRS").limit(1)).data!;
    expect((await A.sb.from("feriados").update({ descricao: "Mudado" }).eq("id", geral.id).select()).data).toEqual([]);
    await A.sb.from("feriados").delete().eq("id", geral.id);
    expect((await admin.from("feriados").select("descricao").eq("id", geral.id).single()).data!.descricao).toBe("Data Magna do Rio Grande do Sul");
  });

  it("expediente reduzido e período aceitos; período invertido recusado; repetido recusado", async () => {
    const r = await A.sb.from("feriados").insert({ data: "2026-03-10", tipo: "expediente_reduzido", descricao: "eproc fora do ar" });
    expect(r.error).toBeNull();
    const p = await A.sb.from("feriados").insert({ data: "2026-05-04", ate: "2026-05-08", tipo: "suspensao", descricao: "Enchente" });
    expect(p.error).toBeNull();
    const inv = await A.sb.from("feriados").insert({ data: "2026-05-10", ate: "2026-05-09", descricao: "Invertido" });
    expect(inv.error?.code).toBe("23514");
    const rep = await A.sb.from("feriados").insert({ data: "2026-02-02", descricao: "De novo" });
    expect(rep.error?.code).toBe("23505");
    // O mesmo dia em outra conta é aceito.
    expect((await B.sb.from("feriados").insert({ data: "2026-02-02", descricao: "Navegantes" })).error).toBeNull();
  });
});

describe("histórico de alterações de prazo", () => {
  let tarefa: string;

  it("o gatilho registra a criação e cada mudança de prazo, com origem app pela sessão", async () => {
    const t = await A.sb
      .from("tasks")
      .insert({ project_id: quadroA.projeto, column_id: quadroA.coluna, title: "Contestação", tipo: "prazo", due_on: "2026-11-27", prazo_fatal: "2026-12-01" })
      .select("id")
      .single();
    tarefa = t.data!.id;
    await A.sb.from("tasks").update({ prazo_fatal: "2026-12-02" }).eq("id", tarefa);
    await A.sb.from("tasks").update({ title: "Contestação (revisada)" }).eq("id", tarefa); // não é prazo: não registra
    const { data } = await A.sb.from("registro_alteracoes").select("campo, antes, depois, origem").eq("entidade_id", tarefa).order("criado_em");
    expect(data).toEqual([
      { campo: "due_on", antes: null, depois: "2026-11-27", origem: "app" },
      { campo: "prazo_fatal", antes: null, depois: "2026-12-01", origem: "app" },
      { campo: "prazo_fatal", antes: "2026-12-01", depois: "2026-12-02", origem: "app" },
    ]);
  });

  it("com a chave de serviço (agente) a origem é agente", async () => {
    await admin.from("tasks").update({ due_on: "2026-11-30" }).eq("id", tarefa).eq("user_id", A.id);
    const { data } = await A.sb.from("registro_alteracoes").select("campo, antes, depois, origem").eq("entidade_id", tarefa).eq("origem", "agente");
    expect(data).toEqual([{ campo: "due_on", antes: "2026-11-27", depois: "2026-11-30", origem: "agente" }]);
  });

  it("o app não insere, não altera e não apaga o histórico diretamente", async () => {
    const ins = await A.sb.from("registro_alteracoes").insert({ entidade: "tarefa", entidade_id: tarefa, campo: "due_on", depois: "2030-01-01" });
    expect(ins.error?.code).toBe("42501");
    const upd = await A.sb.from("registro_alteracoes").update({ depois: "2030-01-01" }).eq("entidade_id", tarefa);
    expect(upd.error?.code).toBe("42501");
    const del = await A.sb.from("registro_alteracoes").delete().eq("entidade_id", tarefa);
    expect(del.error?.code).toBe("42501");
    const { count } = await admin.from("registro_alteracoes").select("id", { count: "exact", head: true }).eq("entidade_id", tarefa);
    expect(count).toBe(4);
  });

  it("B não lê o histórico de A", async () => {
    expect((await B.sb.from("registro_alteracoes").select("id").eq("entidade_id", tarefa)).data).toEqual([]);
  });

  it("o histórico continua depois de excluir a tarefa", async () => {
    await A.sb.from("tasks").delete().eq("id", tarefa);
    const { count } = await A.sb.from("registro_alteracoes").select("id", { count: "exact", head: true }).eq("entidade_id", tarefa);
    expect(count).toBe(4);
  });
});

describe("lembretes automáticos", () => {
  it("não há dois D-1 ativos na mesma tarefa; cancelado não conta", async () => {
    const t = await A.sb
      .from("tasks")
      .insert({ project_id: quadroA.projeto, column_id: quadroA.coluna, title: "Réplica", tipo: "prazo", prazo_fatal: "2026-12-10" })
      .select("id")
      .single();
    const l = { tarefa_id: t.data!.id, texto: "Prazo amanhã: Réplica", quando: "2026-12-09T12:00:00Z", automatico: "d-1" };
    const primeiro = await A.sb.from("lembretes").insert(l).select("id").single();
    expect(primeiro.error).toBeNull();
    expect((await A.sb.from("lembretes").insert(l)).error?.code).toBe("23505");
    await A.sb.from("lembretes").update({ status: "cancelado" }).eq("id", primeiro.data!.id);
    expect((await A.sb.from("lembretes").insert(l)).error).toBeNull();
    expect((await A.sb.from("lembretes").insert({ ...l, automatico: "d-2" })).error?.code).toBe("23514");
  });
});

describe("sem login (anon)", () => {
  it("não lê nem grava feriados, histórico e preferências", async () => {
    const anon = createClient(URL, ANON, sem);
    for (const tabela of ["feriados", "registro_alteracoes", "preferencias"]) {
      expect((await anon.from(tabela).select("*").limit(1)).error?.code).toBe("42501");
    }
    expect((await anon.from("feriados").insert({ tribunal: "TJRS", data: "2026-03-05", descricao: "Falso" })).error?.code).toBe("42501");
  });
});

describe("preferências", () => {
  it("margem padrão 2, só o dono lê e grava, e o limite é 0 a 30", async () => {
    const p = await A.sb.from("preferencias").insert({}).select().single();
    expect(p.data).toMatchObject({ user_id: A.id, margem_prazo_interno: 2 });
    expect((await B.sb.from("preferencias").select("user_id").eq("user_id", A.id)).data).toEqual([]);
    expect((await B.sb.from("preferencias").update({ margem_prazo_interno: 9 }).eq("user_id", A.id).select()).data).toEqual([]);
    expect((await A.sb.from("preferencias").update({ margem_prazo_interno: 31 }).eq("user_id", A.id)).error?.code).toBe("23514");
    expect((await B.sb.from("preferencias").insert({ user_id: A.id })).error?.code).toBe("42501");
  });
});
