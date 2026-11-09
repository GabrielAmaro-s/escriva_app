import { describe, expect, it } from "vitest";
import { calcularProgresso, dadosProjetoVazios, ehIconeProjeto, ehTom, filtrarProjetos, prazoDoProjeto, validarDadosProjeto } from "./projeto";
import { detalhesProcessoVazios } from "./processo";
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
    clienteId: null,
    processo: null,
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
    expect(validarDadosProjeto(dados)).toEqual({ ok: false, erro: "O prazo de entrega precisa ser depois da data de recebimento." });
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
      tipoServico: "Instagram",
    });
  });

  it("tipo de serviço próprio vale mais que o primeiro canal", () => {
    const dados = { ...dadosProjetoVazios("campaign"), name: "Contrato" };
    dados.campaign = { ...dados.campaign!, channels: ["Parecer"], tipoServico: "  Contrato " };
    const r = validarDadosProjeto(dados);
    expect(r.ok && r.valor.campaign?.tipoServico).toBe("Contrato");
  });

  it("caso consultivo não guarda detalhes de processo", () => {
    const r = validarDadosProjeto({ ...dadosProjetoVazios("campaign"), name: "Parecer", processo: detalhesProcessoVazios("civel") });
    expect(r.ok && r.valor.processo).toBeNull();
  });
});

describe("validação de processo", () => {
  it("padrões: ícone de balança, área Cível e sem cliente", () => {
    const d = dadosProjetoVazios("project");
    expect(d).toMatchObject({ icon: "scales", clienteId: null, processo: { area: "civel", segredoJustica: false } });
    expect(dadosProjetoVazios("campaign")).toMatchObject({ icon: "briefcase", processo: null });
  });

  it("normaliza o número CNJ e recusa número com dígito errado", () => {
    const base = { ...dadosProjetoVazios("project"), name: "Cobrança" };
    const ok = validarDadosProjeto({ ...base, processo: { ...base.processo!, numeroCnj: "0001234-47.2026.8.21.0001" } });
    expect(ok.ok && ok.valor.processo?.numeroCnj).toBe("00012344720268210001");
    const errado = validarDadosProjeto({ ...base, processo: { ...base.processo!, numeroCnj: "0001234-48.2026.8.21.0001" } });
    expect(errado.ok).toBe(false);
  });

  it("sem processo na entrada, não mexe nos detalhes (o agente cria sem eles)", () => {
    const { processo: _p, clienteId: _c, ...semDetalhes } = dadosProjetoVazios("project");
    const r = validarDadosProjeto({ ...semDetalhes, name: "X" });
    expect(r.ok && "processo" in r.valor).toBe(false);
    expect(r.ok && "clienteId" in r.valor).toBe(false);
  });
});

describe("busca de processos", () => {
  const lista = [
    projeto({ name: "Cobrança", clienteId: "k1", processo: { ...detalhesProcessoVazios("civel"), numeroCnj: "00012344720268210001", parteContraria: "Construtora Exemplo" } }),
    projeto({ name: "Horas extras", processo: detalhesProcessoVazios("trabalhista") }),
    projeto({ name: "Parecer", kind: "campaign" }),
  ];
  const nomeDoCliente = (id: string) => (id === "k1" ? "Imobiliária Exemplo" : undefined);
  const nomes = (r: Projeto[]) => r.map((p) => p.name);

  it("acha pelo cliente, pela parte contrária e pelo número com ou sem pontuação", () => {
    expect(nomes(filtrarProjetos(lista, "all", "imobiliária", { nomeDoCliente }))).toEqual(["Cobrança"]);
    expect(nomes(filtrarProjetos(lista, "all", "construtora"))).toEqual(["Cobrança"]);
    expect(nomes(filtrarProjetos(lista, "all", "0001234-47.2026"))).toEqual(["Cobrança"]);
    expect(nomes(filtrarProjetos(lista, "all", "00012344720268210001"))).toEqual(["Cobrança"]);
  });

  it("filtra por área, deixando os casos consultivos de fora", () => {
    expect(nomes(filtrarProjetos(lista, "all", "", { area: "trabalhista" }))).toEqual(["Horas extras"]);
    expect(nomes(filtrarProjetos(lista, "all", "", { area: null }))).toEqual(["Cobrança", "Horas extras", "Parecer"]);
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
