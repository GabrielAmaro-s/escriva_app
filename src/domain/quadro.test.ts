import { describe, expect, it } from "vitest";
import {
  alteracaoAoAlternarConclusao,
  alteracaoAoMudarColuna,
  colunasDoModelo,
  corDoPrazo,
  formatarData,
  formatarPeriodo,
  hojeIso,
  MODELOS,
  MODELOS_DE_QUADRO,
  modeloPadrao,
  ordenarPorPosicao,
  posicaoEntre,
  posicaoNoTopo,
  documentosPendentes,
  progressoDoChecklist,
  proximaPosicaoNaColuna,
  tarefasDaColuna,
} from "./quadro";
import type { Coluna, Tarefa } from "./tipos";

const colunas: Coluna[] = [
  { id: "c-todo", projectId: "p", title: "A fazer", kind: "todo", position: 1024 },
  { id: "c-doing", projectId: "p", title: "Em andamento", kind: "doing", position: 2048 },
  { id: "c-wait", projectId: "p", title: "Aguardando", kind: "waiting", position: 3072 },
  { id: "c-done", projectId: "p", title: "Concluído", kind: "done", position: 4096 },
];
const porTipo = (k: Coluna["kind"]) => colunas.find((c) => c.kind === k)!;

function tarefa(parcial: Partial<Tarefa> = {}): Tarefa {
  return {
    id: parcial.id ?? crypto.randomUUID(),
    projectId: "p",
    columnId: "c-todo",
    title: "Tarefa",
    description: null,
    dueOn: null,
    tipo: "providencia",
    prazoFatal: null,
    contagem: null,
    localAudiencia: null,
    horarioAudiencia: null,
    priority: "medium",
    labelIds: [],
    checklist: [],
    links: [],
    completed: false,
    completedAt: null,
    position: 1024,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...parcial,
  };
}

const AGORA = new Date("2026-11-04T15:00:00.000Z");

describe("modelos de quadro", () => {
  it("todo modelo tem uma coluna de cada papel, na ordem a fazer, andamento, aguardando, concluído", () => {
    for (const m of MODELOS) expect(MODELOS_DE_QUADRO[m].colunas.map((c) => c.kind)).toEqual(["todo", "doing", "waiting", "done"]);
  });

  it("as colunas seguem a proposta para cada área", () => {
    expect(colunasDoModelo("civel").map((c) => c.title)).toEqual(["A fazer", "Em andamento", "Aguardando decisão", "Concluído"]);
    expect(colunasDoModelo("trabalhista").map((c) => c.title)).toEqual(["A fazer", "Em andamento", "Aguardando audiência", "Concluído"]);
    expect(colunasDoModelo("previdenciario").map((c) => c.title)).toEqual(["Documentos do cliente", "Requerimento INSS", "Aguardando INSS/Justiça", "Concluído"]);
    expect(colunasDoModelo("familia").map((c) => c.title)).toEqual(["A fazer", "Em andamento", "Aguardando", "Concluído"]);
    expect(colunasDoModelo("consultivo").map((c) => c.title)).toEqual(["A fazer", "Redigindo", "Aguardando cliente", "Entregue"]);
  });

  it("padrão: Cível/JEC para processo, Consultivo para caso consultivo", () => {
    expect(modeloPadrao("project")).toBe("civel");
    expect(modeloPadrao("campaign")).toBe("consultivo");
  });

  it("colunasDoModelo devolve uma cópia", () => {
    colunasDoModelo("civel")[0].title = "Outra";
    expect(MODELOS_DE_QUADRO.civel.colunas[0].title).toBe("A fazer");
  });
});

describe("posições", () => {
  it("posicaoEntre: lista vazia, começo, fim e meio", () => {
    expect(posicaoEntre(null, null)).toBe(1024);
    expect(posicaoEntre(null, 1024)).toBe(0);
    expect(posicaoEntre(2048, null)).toBe(3072);
    expect(posicaoEntre(1024, 2048)).toBe(1536);
  });

  it("posicaoEntre continua ordenando depois de muitas inserções no mesmo lugar", () => {
    let antes = 1024;
    const depois = 2048;
    for (let i = 0; i < 40; i++) {
      const nova = posicaoEntre(antes, depois);
      expect(nova).toBeGreaterThan(antes);
      expect(nova).toBeLessThan(depois);
      antes = nova;
    }
  });

  it("tarefasDaColuna filtra pela coluna e ordena por posição", () => {
    const lista = [tarefa({ id: "b", position: 2048 }), tarefa({ id: "x", columnId: "c-done", position: 1 }), tarefa({ id: "a", position: 1024 })];
    expect(tarefasDaColuna(lista, "c-todo").map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("ordenarPorPosicao não altera a lista original", () => {
    const lista = [{ position: 3 }, { position: 1 }];
    expect(ordenarPorPosicao(lista).map((x) => x.position)).toEqual([1, 3]);
    expect(lista.map((x) => x.position)).toEqual([3, 1]);
  });

  it("proximaPosicaoNaColuna vai para o fim; posicaoNoTopo vai para o começo", () => {
    const lista = [tarefa({ position: 1024 }), tarefa({ position: 4096 })];
    expect(proximaPosicaoNaColuna(lista, "c-todo")).toBe(5120);
    expect(posicaoNoTopo(lista, "c-todo")).toBe(0);
    expect(proximaPosicaoNaColuna(lista, "c-doing")).toBe(1024);
    expect(posicaoNoTopo(lista, "c-doing")).toBe(1024);
  });
});

describe("regra: coluna Concluído = tarefa concluída", () => {
  it("entrar em Concluído conclui e marca a data", () => {
    const alteracao = alteracaoAoMudarColuna(tarefa(), porTipo("done"), AGORA);
    expect(alteracao).toEqual({ columnId: "c-done", completed: true, completedAt: AGORA.toISOString() });
  });

  it("sair de Concluído reabre e limpa a data", () => {
    const concluida = tarefa({ columnId: "c-done", completed: true, completedAt: "2026-10-01T00:00:00.000Z" });
    expect(alteracaoAoMudarColuna(concluida, porTipo("waiting"), AGORA)).toEqual({ columnId: "c-wait", completed: false, completedAt: null });
  });

  it("mover entre colunas abertas só troca a coluna", () => {
    expect(alteracaoAoMudarColuna(tarefa(), porTipo("doing"), AGORA)).toEqual({ columnId: "c-doing" });
  });
});

describe("alternar conclusão", () => {
  it("concluir leva para o fim de Concluído", () => {
    const t = tarefa({ id: "t1" });
    const outras = [t, tarefa({ columnId: "c-done", position: 2048 })];
    expect(alteracaoAoAlternarConclusao(t, colunas, outras, AGORA)).toEqual({
      completed: true,
      completedAt: AGORA.toISOString(),
      columnId: "c-done",
      position: 3072,
    });
  });

  it("reabrir leva para o fim de A fazer, ignorando a própria tarefa", () => {
    const t = tarefa({ id: "t1", columnId: "c-done", completed: true, completedAt: "x", position: 9000 });
    const outras = [t, tarefa({ position: 1024 })];
    expect(alteracaoAoAlternarConclusao(t, colunas, outras, AGORA)).toEqual({
      completed: false,
      completedAt: null,
      columnId: "c-todo",
      position: 2048,
    });
  });

  it("sem as colunas certas, só alterna o campo", () => {
    expect(alteracaoAoAlternarConclusao(tarefa(), [], [], AGORA)).toEqual({ completed: true, completedAt: AGORA.toISOString() });
  });
});

describe("checklist", () => {
  it("conta itens feitos e total", () => {
    const t = tarefa({
      checklist: [
        { id: "1", text: "a", done: true },
        { id: "2", text: "b", done: false },
      ],
    });
    expect(progressoDoChecklist(t)).toEqual({ feitos: 1, total: 2 });
  });
});

describe("datas", () => {
  it("hojeIso usa a data local com zeros à esquerda", () => {
    expect(hojeIso(new Date(2026, 0, 5, 10))).toBe("2026-01-05");
  });

  it("formatarData mostra Hoje ou dia e mês curto", () => {
    expect(formatarData("2026-11-04", "2026-11-04")).toBe("Hoje");
    expect(formatarData("2026-11-28", "2026-11-04")).toBe("28 de nov");
    expect(formatarData("2027-01-01", "2026-11-04")).toBe("1 de jan");
  });

  it("formatarPeriodo no mesmo ano não mostra o ano", () => {
    expect(formatarPeriodo("2026-11-20", "2026-12-05", "2026-11-04")).toBe("20 nov – 5 dez");
  });

  it("formatarPeriodo na virada de ano mostra o ano do fim", () => {
    expect(formatarPeriodo("2026-12-01", "2027-02-15", "2026-11-04")).toBe("1 dez – 15 fev 2027");
  });

  it("formatarPeriodo com uma ponta só ou nenhuma", () => {
    expect(formatarPeriodo(null, null, "2026-11-04")).toBe("Sem período");
    expect(formatarPeriodo(null, "2027-03-10", "2026-11-04")).toBe("Até 10 mar 2027");
    expect(formatarPeriodo("2026-11-01", null, "2026-11-04")).toBe("Desde 1 nov");
    expect(formatarPeriodo("2025-11-01", null, "2026-11-04")).toBe("Desde 1 nov 2025");
  });

  it("corDoPrazo: atrasada, hoje, futura e concluída", () => {
    expect(corDoPrazo("2026-11-03", false, "2026-11-04")).toBe("var(--s-red)");
    expect(corDoPrazo("2026-11-04", false, "2026-11-04")).toBe("var(--s-amber)");
    expect(corDoPrazo("2026-11-05", false, "2026-11-04")).toBe("var(--ink3)");
    expect(corDoPrazo("2026-11-01", true, "2026-11-04")).toBe("var(--ink3)");
  });
});

describe("documentos pendentes do cliente", () => {
  it("só itens do cliente, não entregues, de tarefas abertas", () => {
    const lista = documentosPendentes([
      tarefa({ id: "a", checklist: [
        { id: "1", text: "Procuração", done: false, doCliente: true },
        { id: "2", text: "RG", done: true, doCliente: true },
        { id: "3", text: "Revisar minuta", done: false },
      ] }),
      tarefa({ id: "b", completed: true, checklist: [{ id: "4", text: "CTPS", done: false, doCliente: true }] }),
    ]);
    expect(lista).toEqual([{ tarefaId: "a", projectId: "p", itemId: "1", texto: "Procuração" }]);
  });
});
