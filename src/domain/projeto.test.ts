import { describe, expect, it } from "vitest";
import { calcularProgresso, dadosProjetoVazios, ehIconeProjeto, ehTom, filtrarProjetos, prazoDoProjeto, validarDadosProjeto } from "./projeto";
import type { Projeto } from "./tipos";

function projeto(parcial: Partial<Projeto> = {}): Projeto {
  return {
    id: crypto.randomUUID(),
    name: "Projeto",
    description: null,
    kind: "project",
    status: "active",
    color: "violet",
    icon: "folder",
    dueOn: null,
    position: 1024,
    archivedAt: null,
    createdAt: "",
    updatedAt: "",
    campaign: null,
    taskCount: 0,
    doneCount: 0,
    ...parcial,
  };
}

describe("progresso", () => {
  it("sem tarefas é 0%", () => {
    expect(calcularProgresso({ taskCount: 0, doneCount: 0 })).toBe(0);
  });

  it("arredonda para o inteiro mais próximo", () => {
    expect(calcularProgresso({ taskCount: 3, doneCount: 1 })).toBe(33);
    expect(calcularProgresso({ taskCount: 3, doneCount: 2 })).toBe(67);
    expect(calcularProgresso({ taskCount: 16, doneCount: 7 })).toBe(44);
    expect(calcularProgresso({ taskCount: 4, doneCount: 4 })).toBe(100);
  });
});

describe("prazo do projeto", () => {
  it("projeto usa o próprio prazo; campanha usa o fim do período", () => {
    expect(prazoDoProjeto(projeto({ dueOn: "2026-11-28" }))).toBe("2026-11-28");
    const campanha = projeto({ kind: "campaign", dueOn: null, campaign: { objective: null, startsOn: "2026-12-01", endsOn: "2027-02-15", channels: [], deliverables: [] } });
    expect(prazoDoProjeto(campanha)).toBe("2027-02-15");
  });
});

describe("filtrarProjetos", () => {
  const lista = [
    projeto({ name: "Novo site", status: "active" }),
    projeto({ name: "Novo produto", status: "paused", description: "Lançamento" }),
    projeto({ name: "Antigo", status: "done", archivedAt: "2026-01-01" }),
  ];

  it("filtra por status e esconde arquivados", () => {
    expect(filtrarProjetos(lista, "all").map((p) => p.name)).toEqual(["Novo site", "Novo produto"]);
    expect(filtrarProjetos(lista, "paused").map((p) => p.name)).toEqual(["Novo produto"]);
    expect(filtrarProjetos(lista, "archived").map((p) => p.name)).toEqual(["Antigo"]);
  });

  it("busca no nome e na descrição, sem diferenciar maiúsculas", () => {
    expect(filtrarProjetos(lista, "all", "  SITE ").map((p) => p.name)).toEqual(["Novo site"]);
    expect(filtrarProjetos(lista, "all", "lançamento").map((p) => p.name)).toEqual(["Novo produto"]);
  });
});

describe("validação de projeto", () => {
  it("exige nome e limpa espaços", () => {
    expect(validarDadosProjeto({ ...dadosProjetoVazios(), name: "   " })).toEqual({ ok: false, erro: "Dê um nome para continuar." });
    const r = validarDadosProjeto({ ...dadosProjetoVazios(), name: "  Novo site ", description: "  " });
    expect(r.ok && r.valor.name).toBe("Novo site");
    expect(r.ok && r.valor.description).toBeNull();
  });

  it("limita o nome a 120 caracteres", () => {
    expect(validarDadosProjeto({ ...dadosProjetoVazios(), name: "a".repeat(121) })).toEqual({ ok: false, erro: "O nome pode ter até 120 caracteres." });
  });

  it("projeto comum não guarda dados de campanha", () => {
    const r = validarDadosProjeto({ ...dadosProjetoVazios("project"), name: "X", dueOn: "2026-12-01", campaign: { objective: "y", startsOn: null, endsOn: null, channels: [], deliverables: [] } });
    expect(r.ok && r.valor.campaign).toBeNull();
    expect(r.ok && r.valor.dueOn).toBe("2026-12-01");
  });
});

describe("validação de campanha", () => {
  it("o fim não pode ser antes do início", () => {
    const dados = { ...dadosProjetoVazios("campaign"), name: "Verão" };
    dados.campaign = { ...dados.campaign!, startsOn: "2026-12-10", endsOn: "2026-12-01" };
    expect(validarDadosProjeto(dados)).toEqual({ ok: false, erro: "A data de fim precisa ser depois do início." });
  });

  it("normaliza objetivo, canais e entregas e zera o prazo do projeto", () => {
    const dados = { ...dadosProjetoVazios("campaign"), name: "Verão", dueOn: "2026-12-31" };
    dados.campaign = {
      objective: "  ",
      startsOn: "",
      endsOn: "2027-02-15",
      channels: [" Instagram ", "", "Ads"],
      deliverables: [
        { id: "1", title: "Landing page", done: false },
        { id: "2", title: "   ", done: false },
      ],
    };
    const r = validarDadosProjeto(dados);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.dueOn).toBeNull();
    expect(r.valor.campaign).toEqual({
      objective: null,
      startsOn: null,
      endsOn: "2027-02-15",
      channels: ["Instagram", "Ads"],
      deliverables: [{ id: "1", title: "Landing page", done: false }],
    });
  });
});

describe("guardas de tipo", () => {
  it("reconhece tons e ícones válidos", () => {
    expect(ehTom("violet")).toBe(true);
    expect(ehTom("petroleo")).toBe(false);
    expect(ehIconeProjeto("megaphone")).toBe(true);
    expect(ehIconeProjeto(42)).toBe(false);
  });
});
