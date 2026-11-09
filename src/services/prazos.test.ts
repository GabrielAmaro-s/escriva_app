import { describe, expect, it } from "vitest";
import { armazenamentoVazio, criarRepositorioLocal } from "@/data/local/repositorio-local";
import type { Repositorio } from "@/data/repositorio";
import { ErroDeConflito, ErroDeValidacao } from "@/domain/erros";
import { detalhesProcessoVazios } from "@/domain/processo";
import { dadosProjetoVazios } from "@/domain/projeto";
import type { AlteracaoTarefa, Tarefa } from "@/domain/tipos";
import { lembretesProximos } from "./lembretes";
import {
  alteracaoDePrazo,
  alterarTarefa,
  calcularPrazoDaTarefa,
  criarFeriadoLocal,
  salvarPreferencias,
} from "./prazos";

const SP = "America/Sao_Paulo";
const CNJ_TJRS = "00012344720268210001"; // fictício
const ctx = (agora: string) => ({ fuso: SP, agora: new Date(agora) });

async function cenario() {
  const repo = criarRepositorioLocal({ dados: armazenamentoVazio(), persistir: false });
  // Conta as gravações de tarefa, para conferir "na mesma gravação".
  const gravacoes: AlteracaoTarefa[] = [];
  const atualizar = repo.atualizarTarefa.bind(repo);
  repo.atualizarTarefa = (id, alteracao) => (gravacoes.push(alteracao), atualizar(id, alteracao));
  const projeto = await repo.criarProjeto({ ...dadosProjetoVazios(), name: "Processo", processo: { ...detalhesProcessoVazios("civel"), numeroCnj: CNJ_TJRS } }, [
    { title: "A fazer", kind: "todo" },
  ]);
  const quadro = (await repo.obterQuadro(projeto.id))!;
  const tarefa = await repo.criarTarefa({ projectId: projeto.id, columnId: quadro.colunas[0].id, title: "Contestação" });
  return { repo, projeto, tarefa, gravacoes };
}

const ativos = async (repo: Repositorio, tarefaId: string) =>
  (await repo.listarLembretes({ tarefaId, status: ["pendente", "agendado"] })).map((l) => ({ automatico: l.automatico, quando: l.quando, texto: l.texto }));

async function virarPrazo(repo: Repositorio, tarefa: Tarefa, agora = "2026-11-10T12:00:00Z") {
  const { contagem, prazoInterno } = await calcularPrazoDaTarefa(repo, tarefa.projectId, { inicio: "2026-11-09", meio: "dje", dias: 15, regra: "civel" });
  return alterarTarefa(repo, tarefa, alteracaoDePrazo(contagem, prazoInterno), ctx(agora));
}

describe("prazo da tarefa", () => {
  it("calcula pelo tribunal do processo (TJRS pelo número) e pela margem das Configurações", async () => {
    const { repo, tarefa } = await cenario();
    const r = await calcularPrazoDaTarefa(repo, tarefa.projectId, { inicio: "2026-11-09", meio: "dje", dias: 15, regra: "civel" });
    expect(r.contagem).toMatchObject({ tribunal: "TJRS", vencimento: "2026-12-02", margem: 2 });
    expect(r.prazoInterno).toBe("2026-11-30");
    await salvarPreferencias(repo, { margemPrazoInterno: 3 });
    expect((await calcularPrazoDaTarefa(repo, tarefa.projectId, { inicio: "2026-11-09", meio: "dje", dias: 15, regra: "civel" })).prazoInterno).toBe("2026-11-27");
    // A margem editada na tarefa vale sobre a padrão.
    expect((await calcularPrazoDaTarefa(repo, tarefa.projectId, { inicio: "2026-11-09", meio: "dje", dias: 15, regra: "civel", margem: 0 })).prazoInterno).toBe(
      "2026-12-02",
    );
  });

  it("feriado local entra na conta", async () => {
    const { repo, tarefa } = await cenario();
    await criarFeriadoLocal(repo, { data: "2026-11-25", descricao: "Feriado municipal" });
    const r = await calcularPrazoDaTarefa(repo, tarefa.projectId, { inicio: "2026-11-09", meio: "dje", dias: 15, regra: "civel" });
    expect(r.contagem.vencimento).toBe("2026-12-03");
    expect(r.contagem.memoria).toContain("25/11 (Feriado municipal)");
  });

  it("dados inválidos: ErroDeValidacao", async () => {
    const { repo, tarefa } = await cenario();
    await expect(calcularPrazoDaTarefa(repo, tarefa.projectId, { inicio: "ontem", meio: "dje", dias: 15, regra: "civel" })).rejects.toBeInstanceOf(ErroDeValidacao);
  });

  it("grava prazo fatal, prazo interno e contagem numa gravação, e o histórico registra", async () => {
    const { repo, tarefa, gravacoes } = await cenario();
    const t = await virarPrazo(repo, tarefa);
    expect(t).toMatchObject({ tipo: "prazo", prazoFatal: "2026-12-02", dueOn: "2026-11-30" });
    expect(t.contagem?.memoria).toContain("Vence em 02/12/2026.");
    expect(gravacoes).toHaveLength(1);
    const historico = (await repo.listarAlteracoesDaTarefa(t.id)).map((a) => [a.campo, a.antes, a.depois, a.origem]);
    expect(historico).toHaveLength(2);
    expect(historico).toEqual(
      expect.arrayContaining([
        ["due_on", null, "2026-11-30", "app"],
        ["prazo_fatal", null, "2026-12-02", "app"],
      ]),
    );
  });
});

describe("lembretes automáticos", () => {
  it("D-3, D-1 e no dia, às 09:00, contados do prazo fatal em dias com expediente", async () => {
    const { repo, tarefa } = await cenario();
    await virarPrazo(repo, tarefa);
    expect(await ativos(repo, tarefa.id)).toEqual([
      { automatico: "d-3", quando: "2026-11-27T12:00:00.000Z", texto: "Prazo fatal em 02/12: Contestação" },
      { automatico: "d-1", quando: "2026-12-01T12:00:00.000Z", texto: "Prazo fatal em 02/12: Contestação" },
      { automatico: "dia", quando: "2026-12-02T12:00:00.000Z", texto: "Prazo fatal hoje: Contestação" },
    ]);
  });

  it("os que já passaram não são criados", async () => {
    const { repo, tarefa } = await cenario();
    await virarPrazo(repo, tarefa, "2026-11-30T12:00:00Z");
    expect((await ativos(repo, tarefa.id)).map((l) => l.automatico)).toEqual(["d-1", "dia"]);
  });

  it("mudar o prazo fatal troca os automáticos e não mexe no lembrete feito à mão", async () => {
    const { repo, tarefa } = await cenario();
    const t = await virarPrazo(repo, tarefa);
    await repo.criarLembrete({ tarefaId: t.id, texto: "Ligar para o cliente", quando: "2026-11-20T13:00:00.000Z" });
    await alterarTarefa(repo, t, { prazoFatal: "2026-12-04" }, ctx("2026-11-10T12:00:00Z"));
    const lista = await ativos(repo, t.id);
    expect(lista.filter((l) => l.automatico).map((l) => l.quando)).toEqual(["2026-12-01T12:00:00.000Z", "2026-12-03T12:00:00.000Z", "2026-12-04T12:00:00.000Z"]);
    expect(lista.filter((l) => !l.automatico)).toHaveLength(1);
    const cancelados = (await repo.listarLembretes({ tarefaId: t.id, status: ["cancelado"] })).length;
    expect(cancelados).toBe(3);
  });

  it("mudar só o prazo interno não mexe nos lembretes", async () => {
    const { repo, tarefa } = await cenario();
    const t = await virarPrazo(repo, tarefa);
    await alterarTarefa(repo, t, { dueOn: "2026-11-25" }, ctx("2026-11-10T12:00:00Z"));
    expect((await repo.listarLembretes({ tarefaId: t.id, status: ["cancelado"] })).length).toBe(0);
  });

  it("concluir cancela os automáticos; reabrir recria os que ainda estão no futuro", async () => {
    const { repo, tarefa } = await cenario();
    const t = await virarPrazo(repo, tarefa);
    const concluida = await alterarTarefa(repo, t, { completed: true, completedAt: "2026-11-20T12:00:00Z" }, ctx("2026-11-20T12:00:00Z"));
    expect(await ativos(repo, t.id)).toEqual([]);
    await alterarTarefa(repo, concluida, { completed: false, completedAt: null }, ctx("2026-11-28T12:00:00Z"));
    expect((await ativos(repo, t.id)).map((l) => l.automatico)).toEqual(["d-1", "dia"]);
  });

  it("concluída por outro caminho (agente): lembretesProximos cancela em vez de devolver", async () => {
    const { repo, tarefa } = await cenario();
    const t = await virarPrazo(repo, tarefa);
    await repo.atualizarTarefa(t.id, { completed: true, completedAt: "2026-11-26T12:00:00Z" });
    const manual = await repo.criarLembrete({ tarefaId: t.id, texto: "Arquivar cópia", quando: "2026-11-27T11:00:00.000Z" });
    // Janela de 24 h: entra o D-3 (27/11) e o manual. O D-3 é cancelado; o manual vai.
    const proximos = await lembretesProximos(repo, 24, new Date("2026-11-26T13:00:00Z"));
    expect(proximos.map((l) => l.id)).toEqual([manual.id]);
    expect((await ativos(repo, t.id)).filter((l) => l.automatico).map((l) => l.automatico)).toEqual(["d-1", "dia"]);
    // Os seguintes são cancelados quando chegam na janela, antes de qualquer envio.
    // (o manual atrasado continua vindo, como antes)
    expect((await lembretesProximos(repo, 48, new Date("2026-12-01T00:00:00Z"))).map((l) => l.id)).toEqual([manual.id]);
    expect((await ativos(repo, t.id)).filter((l) => l.automatico)).toEqual([]);
  });

  it("audiência: D-3 e D-1 às 09:00 e, no dia, 2 h antes do horário", async () => {
    const { repo, tarefa } = await cenario();
    await alterarTarefa(
      repo,
      tarefa,
      { tipo: "audiencia", horarioAudiencia: "2026-12-03T17:00:00.000Z", localAudiencia: "Sala 3, Foro de Pelotas" },
      ctx("2026-11-10T12:00:00Z"),
    );
    expect(await ativos(repo, tarefa.id)).toEqual([
      { automatico: "d-3", quando: "2026-11-30T12:00:00.000Z", texto: "Audiência em 03/12 às 14:00: Contestação (Sala 3, Foro de Pelotas)" },
      { automatico: "d-1", quando: "2026-12-02T12:00:00.000Z", texto: "Audiência em 03/12 às 14:00: Contestação (Sala 3, Foro de Pelotas)" },
      { automatico: "dia", quando: "2026-12-03T15:00:00.000Z", texto: "Audiência hoje às 14:00: Contestação (Sala 3, Foro de Pelotas)" },
    ]);
  });
});

describe("trocar o tipo", () => {
  it("de prazo para providência: limpa prazo fatal e contagem na mesma gravação e cancela os lembretes", async () => {
    const { repo, tarefa, gravacoes } = await cenario();
    const t = await virarPrazo(repo, tarefa);
    gravacoes.length = 0;
    const depois = await alterarTarefa(repo, t, { tipo: "providencia" }, ctx("2026-11-10T12:00:00Z"));
    expect(gravacoes).toEqual([{ tipo: "providencia", prazoFatal: null, contagem: null }]);
    expect(depois).toMatchObject({ tipo: "providencia", prazoFatal: null, contagem: null, dueOn: "2026-11-30" });
    expect(await ativos(repo, t.id)).toEqual([]);
  });

  it("de audiência para prazo: limpa local e horário na mesma gravação", async () => {
    const { repo, tarefa, gravacoes } = await cenario();
    const a = await alterarTarefa(repo, tarefa, { tipo: "audiencia", horarioAudiencia: "2026-12-03T17:00:00.000Z", localAudiencia: "Sala 3" }, ctx("2026-11-10T12:00:00Z"));
    gravacoes.length = 0;
    const p = await alterarTarefa(repo, a, { tipo: "prazo", prazoFatal: "2026-12-10" }, ctx("2026-11-10T12:00:00Z"));
    expect(gravacoes).toEqual([{ tipo: "prazo", prazoFatal: "2026-12-10", localAudiencia: null, horarioAudiencia: null }]);
    expect(p).toMatchObject({ tipo: "prazo", localAudiencia: null, horarioAudiencia: null });
    expect((await ativos(repo, p.id)).every((l) => l.texto.startsWith("Prazo fatal"))).toBe(true);
  });

  it("o repositório recusa prazo fatal fora do tipo prazo (como o check da 0005)", async () => {
    const { repo, tarefa } = await cenario();
    await expect(repo.atualizarTarefa(tarefa.id, { prazoFatal: "2026-12-10" })).rejects.toThrow("Só tarefas do tipo prazo têm prazo fatal.");
  });
});

describe("feriados locais e preferências", () => {
  it("valida e recusa repetido", async () => {
    const { repo } = await cenario();
    await expect(criarFeriadoLocal(repo, { data: "2026-02-30", descricao: "X" })).rejects.toBeInstanceOf(ErroDeValidacao);
    await expect(criarFeriadoLocal(repo, { data: "2026-02-02", descricao: " " })).rejects.toBeInstanceOf(ErroDeValidacao);
    await expect(criarFeriadoLocal(repo, { data: "2026-05-08", ate: "2026-05-04", descricao: "Enchente" })).rejects.toBeInstanceOf(ErroDeValidacao);
    const f = await criarFeriadoLocal(repo, { data: "2026-02-02", descricao: " Navegantes ", tribunal: "tjrs" });
    expect(f).toMatchObject({ descricao: "Navegantes", tribunal: "TJRS", ate: null, tipo: "feriado" });
    await expect(criarFeriadoLocal(repo, { data: "2026-02-02", descricao: "De novo", tribunal: "TJRS" })).rejects.toBeInstanceOf(ErroDeConflito);
  });

  it("a lista traz a carga dos tribunais e os locais", async () => {
    const { repo } = await cenario();
    await criarFeriadoLocal(repo, { data: "2026-03-10", descricao: "eproc fora do ar", tipo: "expediente_reduzido" });
    const lista = await repo.listarFeriados();
    expect(lista.some((f) => f.userId === null && f.tribunal === "TJRS")).toBe(true);
    expect(lista.find((f) => f.userId !== null)).toMatchObject({ tipo: "expediente_reduzido" });
  });

  it("margem fora de 0 a 30 é recusada", async () => {
    const { repo } = await cenario();
    await expect(salvarPreferencias(repo, { margemPrazoInterno: 31 })).rejects.toBeInstanceOf(ErroDeValidacao);
    await expect(salvarPreferencias(repo, { margemPrazoInterno: 1.5 })).rejects.toBeInstanceOf(ErroDeValidacao);
    expect(await salvarPreferencias(repo, { margemPrazoInterno: 0 })).toEqual({ margemPrazoInterno: 0 });
  });
});
