import { beforeEach, describe, expect, it } from "vitest";
import { criarDadosDeExemplo } from "@/data/local/exemplo";
import { criarRepositorioLocal } from "@/data/local/repositorio-local";
import type { Repositorio } from "@/data/repositorio";
import { AVISO_CONTAGEM_EM_VALIDACAO } from "@/domain/prazos";
import { detalhesProcessoVazios } from "@/domain/processo";
import { dadosProjetoVazios } from "@/domain/projeto";
import { colunasDoModelo } from "@/domain/quadro";
import type { Projeto } from "@/domain/tipos";
import { aplicarDesfazer } from "../desfazer";
import type { ContextoAgente } from "./auxiliares";
import { executarFerramenta } from "./executar";
import { NOMES_DAS_FERRAMENTAS, criarFerramentas } from "./ferramentas";

// Ferramentas jurídicas (etapa 4) com o repositório local em memória.
// "Hoje" é 4/11/2026 (quarta), 12:00 em São Paulo, igual aos dados de exemplo.

const AGORA = new Date("2026-11-04T15:00:00.000Z");
const ferramentas = criarFerramentas({ limiteItens: 10 });
let repo: Repositorio;
let ctx: ContextoAgente;

async function chamar(nome: string, entrada: Record<string, unknown> = {}, escopo: "leitura" | "escrita" = "escrita") {
  const f = ferramentas.find((x) => x.nome === nome);
  if (!f) throw new Error(`ferramenta ${nome} não existe`);
  return executarFerramenta(f, ctx, entrada, { tokenId: "token-1", escopo });
}

const projeto = async (nome: string) => (await repo.listarProjetos()).find((p) => p.name === nome)!;
const tarefasDe = async (nome: string) => (await repo.obterQuadro((await projeto(nome)).id))!.tarefas;

async function mudarProcesso(nome: string, mudanca: Partial<NonNullable<Projeto["processo"]>>) {
  const p = await projeto(nome);
  await repo.atualizarProjeto(p.id, { processo: { ...(p.processo ?? detalhesProcessoVazios()), ...mudanca } });
}

// "Cobrança de aluguéis" é JEC do TJRS (órgão "Juizado Especial Cível"): regra juizado pelo processo.
const INTIMACAO = {
  processo: "Cobrança de aluguéis",
  disponibilizacao: "2026-11-06",
  meio: "dje",
  dias: 15,
  texto_original: "Fica a parte autora intimada para se manifestar em 15 dias sobre a contestação.",
};

beforeEach(() => {
  repo = criarRepositorioLocal({ dados: criarDadosDeExemplo(new Date(2026, 10, 4, 12)) });
  ctx = { repo, fuso: "America/Sao_Paulo", urlApp: "https://tempestivo.teste", limiteItens: 10, agora: () => AGORA };
});

describe("catálogo", () => {
  it("tem 19 ferramentas, com as 4 novas", () => {
    expect(NOMES_DAS_FERRAMENTAS).toHaveLength(19);
    expect(NOMES_DAS_FERRAMENTAS).toEqual(expect.arrayContaining(["registrar_intimacao", "criar_processo", "prazos_proximos", "audiencias_proximas"]));
  });

  it("prazos_proximos e audiencias_proximas são de leitura; registrar_intimacao pede confirmação", () => {
    expect(ferramentas.filter((f) => !f.escrita).map((f) => f.nome)).toEqual([
      "listar_projetos",
      "ver_quadro",
      "buscar_tarefas",
      "resumir_projeto",
      "lembretes_proximos",
      "prazos_proximos",
      "audiencias_proximas",
    ]);
    expect(ferramentas.find((f) => f.nome === "registrar_intimacao")!.confirmacao).toBe(true);
  });
});

describe("registrar_intimacao: prévia e confirmação", () => {
  it("a prévia mostra processo, vencimento, prazo interno, memória e aviso, e não grava nada", async () => {
    const antes = (await tarefasDe("Cobrança de aluguéis")).length;
    const r = await chamar("registrar_intimacao", INTIMACAO);
    expect(r.erro).toBe(false);
    expect(r.corpo).toMatchObject({
      precisa_confirmacao: true,
      aviso: AVISO_CONTAGEM_EM_VALIDACAO,
      processo: { nome: "Cobrança de aluguéis", tribunal: "TJRS", orgao: "Juizado Especial Cível" },
      prazo: { prazo_fatal: "2026-12-01", prazo_interno: "2026-11-27", regra: "Juizado especial", regra_origem: "pelo processo", dias: 15 },
    });
    expect((r.corpo.prazo as { memoria: string }).memoria).toContain("Consciência Negra");
    expect(r.corpo.mensagem).toBe(
      `Prazo de 15 dias úteis em Cobrança de aluguéis: vence 01/12/2026 (prazo interno 27/11/2026). ${AVISO_CONTAGEM_EM_VALIDACAO} Responda "sim" para confirmar.`,
    );
    expect((await tarefasDe("Cobrança de aluguéis")).length).toBe(antes);
  });

  it("confirmação negada: sem confirmado=true nada é criado, nem com confirmado=true sem o prazo da prévia", async () => {
    const antes = (await repo.obterEspacoDeTrabalho()).tarefas.length;
    await chamar("registrar_intimacao", INTIMACAO);
    // A pessoa respondeu "não": o agente não chama de novo. E um confirmado=true sem o prazo da prévia também não cria.
    const semEsperado = await chamar("registrar_intimacao", { ...INTIMACAO, confirmado: true });
    expect(semEsperado.corpo).toMatchObject({ precisa_confirmacao: true });
    expect(semEsperado.corpo.mensagem).toMatch(/^Falta o prazo_fatal_esperado da prévia\. Nada foi criado\./);
    expect((await repo.obterEspacoDeTrabalho()).tarefas.length).toBe(antes);
    expect(await repo.listarLembretes()).toEqual([]);
  });

  it("com o sim e o prazo da prévia, cria o prazo pelos services da tela, com lembretes automáticos e desfazer", async () => {
    const r = await chamar("registrar_intimacao", { ...INTIMACAO, titulo: "Manifestação sobre a contestação", confirmado: true, prazo_fatal_esperado: "2026-12-01" });
    expect(r.erro).toBe(false);
    expect(r.corpo.mensagem).toBe(
      `Registrei “Manifestação sobre a contestação” em Cobrança de aluguéis: vence 01/12/2026 (prazo interno 27/11/2026). 3 lembretes automáticos. ${AVISO_CONTAGEM_EM_VALIDACAO}`,
    );
    const tarefa = (await tarefasDe("Cobrança de aluguéis")).find((t) => t.title === "Manifestação sobre a contestação")!;
    expect(tarefa).toMatchObject({ tipo: "prazo", prazoFatal: "2026-12-01", dueOn: "2026-11-27", description: INTIMACAO.texto_original });
    expect(tarefa.contagem).toMatchObject({ inicio: "2026-11-06", dias: 15, regra: "juizado", tribunal: "TJRS" });
    const quadro = (await repo.obterQuadro(tarefa.projectId))!;
    expect(quadro.colunas.find((c) => c.id === tarefa.columnId)?.kind).toBe("todo");
    const lembretes = (await repo.listarLembretes({ tarefaId: tarefa.id })).filter((l) => l.automatico);
    expect(lembretes.map((l) => l.automatico).sort()).toEqual(["d-1", "d-3", "dia"]);

    const [linha] = await repo.listarRegistroAgente(1);
    expect(linha).toMatchObject({ ferramenta: "registrar_intimacao", sucesso: true, desfazer: { tipo: "excluir_tarefas", ids: [tarefa.id] } });
    await aplicarDesfazer(repo, linha.desfazer!);
    expect((await tarefasDe("Cobrança de aluguéis")).some((t) => t.id === tarefa.id)).toBe(false);
  });

  it("se o recálculo der outra data que a da prévia, volta uma prévia nova e não cria nada", async () => {
    const antes = (await repo.obterEspacoDeTrabalho()).tarefas.length;
    const r = await chamar("registrar_intimacao", { ...INTIMACAO, confirmado: true, prazo_fatal_esperado: "2026-11-30" });
    expect(r.corpo).toMatchObject({ precisa_confirmacao: true, prazo: { prazo_fatal: "2026-12-01" } });
    expect(r.corpo.mensagem).toMatch(/^O cálculo mudou desde a prévia \(ela dizia 30\/11\/2026\)\. Nada foi criado\./);
    expect((await repo.obterEspacoDeTrabalho()).tarefas.length).toBe(antes);
  });

  it("prazo que atravessa o recesso (TRT4, DJe em 15/12/2026, 8 dias úteis): vence em 28/01/2027", async () => {
    const r = await chamar("registrar_intimacao", { ...INTIMACAO, processo: "Reclamação trabalhista", disponibilizacao: "2026-12-15", dias: 8 });
    expect(r.corpo).toMatchObject({ precisa_confirmacao: true, prazo: { prazo_fatal: "2027-01-28", regra: "Trabalhista (CLT)", tribunal: "TRT4" } });
    const memoria = (r.corpo.prazo as { memoria: string }).memoria;
    expect(memoria).toContain("A contagem começa em 17/12/2026.");
    expect(memoria).toContain("20/12 a 20/01 (recesso de 20/12 a 20/01)");
    const feito = await chamar("registrar_intimacao", { ...INTIMACAO, processo: "Reclamação trabalhista", disponibilizacao: "2026-12-15", dias: 8, confirmado: true, prazo_fatal_esperado: "2027-01-28" });
    expect(feito.erro).toBe(false);
    expect((await tarefasDe("Reclamação trabalhista")).find((t) => t.prazoFatal === "2027-01-28")).toBeDefined();
  });

  it("avisa quando parece repetido (mesmo processo, mesma disponibilização, mesma quantidade de dias)", async () => {
    await chamar("registrar_intimacao", { ...INTIMACAO, confirmado: true, prazo_fatal_esperado: "2026-12-01" });
    const r = await chamar("registrar_intimacao", INTIMACAO);
    expect(r.corpo.mensagem).toContain("Atenção: parece repetido");
    expect((r.corpo.repetido as unknown[]).length).toBe(1);
    const outro = await chamar("registrar_intimacao", { ...INTIMACAO, dias: 5 });
    expect(outro.corpo.repetido).toBeNull();
  });
});

describe("registrar_intimacao: processo", () => {
  it("processo não cadastrado: diz claramente e não cria nada", async () => {
    const antes = (await repo.obterEspacoDeTrabalho()).tarefas.length;
    const r = await chamar("registrar_intimacao", { ...INTIMACAO, processo: "Inventário dos Silva", confirmado: true, prazo_fatal_esperado: "2026-12-01" });
    expect(r.erro).toBe(true);
    expect(r.corpo.erro).toBe('Não encontrei processo parecido com "Inventário dos Silva" na sua conta. Nada foi criado. Se ele ainda não está cadastrado, use criar_processo.');
    expect((await repo.obterEspacoDeTrabalho()).tarefas.length).toBe(antes);
    expect((await repo.listarRegistroAgente(1))[0]).toMatchObject({ ferramenta: "registrar_intimacao", sucesso: false });
  });

  it("número CNJ válido que não existe na conta: diz o número e não cria nada", async () => {
    await mudarProcesso("Cobrança de aluguéis", { numeroCnj: "00012344720268210001" });
    const r = await chamar("registrar_intimacao", { ...INTIMACAO, processo: "0009999-07.2026.8.21.0001" });
    expect(r.erro).toBe(true);
    expect(r.corpo.erro).toBe(
      "Não encontrei nenhum processo com o número 0009999-07.2026.8.21.0001 na sua conta. Nada foi criado. Se ele ainda não está cadastrado, use criar_processo.",
    );
  });

  it("número com dígito verificador errado é recusado", async () => {
    const r = await chamar("registrar_intimacao", { ...INTIMACAO, processo: "0009999-08.2026.8.21.0001" });
    expect(r.erro).toBe(true);
    expect(r.corpo.erro).toMatch(/não é um número de processo válido/);
  });

  it("acha o processo pelo número, com ou sem pontuação", async () => {
    await mudarProcesso("Cobrança de aluguéis", { numeroCnj: "00012344720268210001" });
    for (const numero of ["0001234-47.2026.8.21.0001", "00012344720268210001"]) {
      const r = await chamar("registrar_intimacao", { ...INTIMACAO, processo: numero });
      expect(r.corpo).toMatchObject({ precisa_confirmacao: true, processo: { nome: "Cobrança de aluguéis", numero_cnj: "0001234-47.2026.8.21.0001" } });
    }
  });

  it("caso consultivo não recebe intimação", async () => {
    const r = await chamar("registrar_intimacao", { ...INTIMACAO, processo: "Parecer sobre LGPD" });
    expect(r.corpo.erro).toBe("Parecer sobre LGPD é um caso consultivo: intimação só vale para processo. Nada foi criado.");
  });
});

describe("registrar_intimacao: regra pela área", () => {
  it("cível sem a palavra Juizado no órgão: pergunta vara comum ou juizado e não calcula", async () => {
    // "Cobrança de cheques" está na "Vara Cível": sem a pista, a regra não é assumida.
    const r = await chamar("registrar_intimacao", { ...INTIMACAO, processo: "Cobrança de cheques" });
    expect(r.erro).toBe(false);
    expect(r.corpo).toMatchObject({ precisa_regra: true, pergunta: "Vara comum ou juizado?" });
    expect(r.corpo.mensagem).toBe("Antes de calcular: Cobrança de cheques corre em vara comum ou em juizado? No recesso de fim de ano a contagem muda. Nada foi criado.");
    expect(r.corpo.prazo).toBeUndefined();
  });

  it("processo sem área também pergunta; com a regra informada, calcula", async () => {
    await mudarProcesso("Cobrança de cheques", { area: null, orgao: null });
    expect((await chamar("registrar_intimacao", { ...INTIMACAO, processo: "Cobrança de cheques" })).corpo).toMatchObject({ precisa_regra: true });
    const r = await chamar("registrar_intimacao", { ...INTIMACAO, processo: "Cobrança de cheques", regra: "civel" });
    expect(r.corpo).toMatchObject({ precisa_confirmacao: true, prazo: { regra: "Cível (CPC)", regra_origem: "informada" } });
  });

  it("órgão com Juizado usa a regra juizado; área trabalhista usa a trabalhista", async () => {
    expect((await chamar("registrar_intimacao", INTIMACAO)).corpo).toMatchObject({ prazo: { regra_codigo: "juizado" } });
    expect((await chamar("registrar_intimacao", { ...INTIMACAO, processo: "Reclamação trabalhista" })).corpo).toMatchObject({ prazo: { regra_codigo: "trabalhista" } });
  });

  it("a exceção do recesso penal só vale para prazo penal", async () => {
    const r = await chamar("registrar_intimacao", { ...INTIMACAO, excecao_recesso_penal: true });
    expect(r.corpo.erro).toBe("A exceção do recesso (art. 798-A do CPP) só vale para prazo penal. Nada foi criado.");
  });

  it("prazo em dobro dobra a contagem", async () => {
    const r = await chamar("registrar_intimacao", { ...INTIMACAO, em_dobro: true });
    expect(r.corpo).toMatchObject({ prazo: { em_dobro: true } });
    expect((r.corpo.prazo as { memoria: string }).memoria).toMatch(/^15 dias úteis em dobro \(30 dias\)/);
  });
});

describe("segredo de justiça", () => {
  it("o processo aparece só com nome e número, sem parte contrária, cliente nem texto da intimação", async () => {
    await mudarProcesso("Cobrança de aluguéis", { segredoJustica: true, numeroCnj: "00012344720268210001" });
    const r = await chamar("registrar_intimacao", INTIMACAO);
    expect(Object.keys(r.corpo.processo as object).sort()).toEqual(["id", "link", "nome", "numero_cnj", "segredo_justica"]);
    const tudo = JSON.stringify(r.corpo);
    expect(tudo).not.toContain("Locatário");
    expect(tudo).not.toContain("Imobiliária");
    expect(tudo).not.toContain(INTIMACAO.texto_original);
    // A descrição da tarefa continua guardando o texto original.
    await chamar("registrar_intimacao", { ...INTIMACAO, confirmado: true, prazo_fatal_esperado: "2026-12-01" });
    expect((await tarefasDe("Cobrança de aluguéis")).find((t) => t.tipo === "prazo" && t.prazoFatal === "2026-12-01")?.description).toBe(INTIMACAO.texto_original);
  });
});

describe("criar_processo", () => {
  it("cadastra o cliente que não existe, com número, área e modelo, e ícone de balança", async () => {
    const r = await chamar("criar_processo", { nome: "Horas extras", numero_cnj: "0004321-11.2026.8.21.0001", area: "trabalhista", cliente: "Sicrano de Tal" });
    expect(r.erro).toBe(false);
    expect(r.corpo.mensagem).toBe("Criei o processo Horas extras (0004321-11.2026.8.21.0001), cliente Sicrano de Tal (cadastrei agora). Modelo Trabalhista.");
    expect(r.corpo).toMatchObject({ cliente_cadastrado: true, processo: { nome: "Horas extras", area: "Trabalhista", cliente: "Sicrano de Tal" } });
    const p = await projeto("Horas extras");
    expect(p).toMatchObject({ kind: "project", icon: "scales", processo: { numeroCnj: "00043211120268210001", area: "trabalhista" } });
    expect((await repo.obterQuadro(p.id))!.colunas.map((c) => c.title)).toEqual(colunasDoModelo("trabalhista").map((c) => c.title));
    expect((await repo.listarClientes()).filter((c) => c.nome === "Sicrano de Tal")).toHaveLength(1);
  });

  it("reaproveita o cliente que já existe pelo nome", async () => {
    const antes = (await repo.listarClientes()).length;
    const r = await chamar("criar_processo", { nome: "Rescisão indireta", cliente: "fulano de tal", orgao: "2ª Vara do Trabalho", area: "trabalhista" });
    expect(r.corpo).toMatchObject({ cliente_cadastrado: false, processo: { cliente: "Fulano de Tal", orgao: "2ª Vara do Trabalho" } });
    expect((await repo.listarClientes()).length).toBe(antes);
  });

  it("número repetido: recusa sem cadastrar o cliente", async () => {
    await mudarProcesso("Cobrança de aluguéis", { numeroCnj: "00012344720268210001" });
    const antes = (await repo.listarClientes()).length;
    const r = await chamar("criar_processo", { nome: "Duplicado", numero_cnj: "0001234-47.2026.8.21.0001", cliente: "Cliente Novo" });
    expect(r.corpo.erro).toBe("Já existe um processo com esse número. Nada foi criado.");
    expect((await repo.listarClientes()).length).toBe(antes);
  });

  it("órgão com Juizado vale na intimação seguinte", async () => {
    await chamar("criar_processo", { nome: "Indenização por voo", area: "consumidor", orgao: "Juizado Especial Cível" });
    const r = await chamar("registrar_intimacao", { ...INTIMACAO, processo: "Indenização por voo" });
    expect(r.corpo).toMatchObject({ prazo: { regra_codigo: "juizado" } });
  });
});

describe("prazos_proximos e audiencias_proximas", () => {
  async function prepararPrazos() {
    await chamar("registrar_intimacao", { ...INTIMACAO, confirmado: true, prazo_fatal_esperado: "2026-12-01" });
    // Prazo vencido num processo pausado: continua aparecendo, e primeiro.
    const cheque = (await tarefasDe("Cobrança de cheques")).find((t) => !t.completed)!;
    await repo.atualizarTarefa(cheque.id, { tipo: "prazo", prazoFatal: "2026-11-02", dueOn: "2026-10-29" });
    // Prazo de processo arquivado não aparece.
    const trabalhista = await projeto("Reclamação trabalhista");
    const t = (await tarefasDe("Reclamação trabalhista")).find((x) => !x.completed && x.tipo === "providencia")!;
    await repo.atualizarTarefa(t.id, { tipo: "prazo", prazoFatal: "2026-11-10", dueOn: "2026-11-06" });
    await repo.atualizarProjeto(trabalhista.id, { archivedAt: "2026-11-01T00:00:00.000Z" });
  }

  it("atrasados primeiro, inclusive de processo pausado (com o status), e sem os arquivados", async () => {
    await prepararPrazos();
    const r = await chamar("prazos_proximos", { dias: 30 });
    const prazos = r.corpo.prazos as { processo: { nome: string; status?: string }; situacao: string; prazo_fatal: string }[];
    expect(prazos.map((p) => [p.processo.nome, p.situacao])).toEqual([
      ["Cobrança de cheques", "fatal_vencido"],
      ["Cobrança de aluguéis", "no_prazo"],
    ]);
    expect(prazos[0].processo.status).toBe("pausado");
    expect(prazos[1].processo.status).toBeUndefined();
    expect(r.corpo.mensagem).toMatch(/^2 prazos até 04\/12, 1 atrasado\. O mais urgente: “.+” \(Cobrança de cheques\), o prazo fatal venceu em 02\/11\.$/);
  });

  it("respeita a janela de dias e funciona com token de leitura", async () => {
    await prepararPrazos();
    const curto = await chamar("prazos_proximos", { dias: 3 }, "leitura");
    expect(curto.erro).toBe(false);
    expect((curto.corpo.prazos as { processo: { nome: string } }[]).map((p) => p.processo.nome)).toEqual(["Cobrança de cheques"]);
    expect((await chamar("audiencias_proximas", {}, "leitura")).erro).toBe(false);
  });

  it("audiências por horário, com local, e fora da janela não aparecem", async () => {
    const [a, b] = await tarefasDe("Cobrança de aluguéis");
    await repo.atualizarTarefa(a.id, { tipo: "audiencia", horarioAudiencia: "2026-11-05T17:00:00.000Z", localAudiencia: "Juizado Especial Cível, sala 2", dueOn: null });
    await repo.atualizarTarefa(b.id, { tipo: "audiencia", horarioAudiencia: "2026-12-20T13:00:00.000Z", localAudiencia: null, dueOn: null });
    const r = await chamar("audiencias_proximas");
    expect(r.corpo.mensagem).toBe("1 audiência até 11/11. A próxima: amanhã às 14:00, Juizado Especial Cível, sala 2 (Cobrança de aluguéis).");
    expect(r.corpo.audiencias).toMatchObject([{ quando: "2026-11-05T14:00:00-03:00", local: "Juizado Especial Cível, sala 2", passou: false }]);
    expect((await chamar("audiencias_proximas", { dias: 60 })).corpo.audiencias).toHaveLength(2);
  });

  it("sem nada na janela, diz que não há", async () => {
    expect((await chamar("prazos_proximos", { dias: 0 })).corpo.mensagem).toBe("Nenhum prazo aberto para hoje.");
    expect((await chamar("audiencias_proximas", { dias: 0 })).corpo.mensagem).toBe("Nenhuma audiência hoje.");
  });
});

describe("processo criado pela tela continua com detalhes vazios", () => {
  it("processo sem detalhes de processo pergunta a regra", async () => {
    const p = await repo.criarProjeto({ ...dadosProjetoVazios("project"), name: "Ação sem detalhes", processo: null }, colunasDoModelo("civel"));
    expect(p.processo).toBeNull();
    expect((await chamar("registrar_intimacao", { ...INTIMACAO, processo: "Ação sem detalhes" })).corpo).toMatchObject({ precisa_regra: true });
  });
});
