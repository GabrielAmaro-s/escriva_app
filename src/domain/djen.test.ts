import { describe, expect, it } from "vitest";
import pagina from "@/data/djen/exemplos/pagina-1.json";
import {
  CAPTURA_DESLIGADA,
  ehSigiloso,
  extrairDiasDoPrazo,
  janelaDaConsulta,
  montarSugestao,
  normalizarTeor,
  numeroPorExtenso,
  planoDaConsulta,
  recortar,
  validarOab,
  type CapturaDjen,
  type ComunicacaoRecebida,
} from "./djen";

// Todos os textos e números daqui são fictícios.

const ligada: CapturaDjen = { ...CAPTURA_DESLIGADA, ligada: true, numeroOab: "9999991", ufOab: "RS", avisoAceitoEm: "2099-03-01T10:00:00.000Z" };

describe("janela da consulta", () => {
  it("primeira consulta: os últimos 15 dias", () => {
    expect(janelaDaConsulta(null, "2099-03-20")).toEqual({ inicio: "2099-03-05", fim: "2099-03-20" });
  });

  it("depois: a última consulta boa menos 2 dias, até hoje", () => {
    expect(janelaDaConsulta("2099-03-19", "2099-03-20")).toEqual({ inicio: "2099-03-17", fim: "2099-03-20" });
    expect(janelaDaConsulta("2099-03-01", "2099-03-02")).toEqual({ inicio: "2099-02-27", fim: "2099-03-02" });
  });

  it("nunca volta mais de 30 dias (a retenção das sugestões)", () => {
    expect(janelaDaConsulta("2098-12-01", "2099-03-20")).toEqual({ inicio: "2099-02-18", fim: "2099-03-20" });
  });
});

describe("plano da consulta", () => {
  const as = (hora: string) => new Date(`2099-03-20T${hora}:00-03:00`);

  it("desligada ou sem OAB não consulta", () => {
    expect(planoDaConsulta(CAPTURA_DESLIGADA, "2099-03-20", as("07:00"), null)).toEqual({ consultar: false, motivo: "desligada" });
    expect(planoDaConsulta({ ...ligada, numeroOab: null }, "2099-03-20", as("07:00"), null)).toEqual({ consultar: false, motivo: "desligada" });
  });

  it("às 7h consulta, com a janela", () => {
    expect(planoDaConsulta({ ...ligada, ultimaConsultaOk: "2099-03-19" }, "2099-03-20", as("07:00"), "2099-03-19")).toEqual({
      consultar: true,
      janela: { inicio: "2099-03-17", fim: "2099-03-20" },
      tentativa: 1,
    });
  });

  it("depois de uma consulta boa no dia, não consulta de novo", () => {
    expect(planoDaConsulta({ ...ligada, ultimaConsultaOk: "2099-03-20", ultimaTentativaEm: as("07:00").toISOString(), tentativasNoDia: 1 }, "2099-03-20", as("12:00"), "2099-03-20")).toEqual({
      consultar: false,
      motivo: "feita_hoje",
    });
  });

  it("se a das 7h falhou, tenta às 12h e às 17h, e para por aí", () => {
    const falhou = { ...ligada, ultimaConsultaOk: "2099-03-19", ultimoResultado: "falhou" as const };
    expect(planoDaConsulta({ ...falhou, ultimaTentativaEm: as("07:00").toISOString(), tentativasNoDia: 1 }, "2099-03-20", as("12:00"), "2099-03-20")).toMatchObject({ consultar: true, tentativa: 2 });
    expect(planoDaConsulta({ ...falhou, ultimaTentativaEm: as("12:00").toISOString(), tentativasNoDia: 2 }, "2099-03-20", as("17:00"), "2099-03-20")).toMatchObject({ consultar: true, tentativa: 3 });
    expect(planoDaConsulta({ ...falhou, ultimaTentativaEm: as("17:00").toISOString(), tentativasNoDia: 3 }, "2099-03-20", as("21:00"), "2099-03-20")).toEqual({ consultar: false, motivo: "tentativas_esgotadas" });
  });

  it("não tenta de novo antes de 4 horas", () => {
    expect(planoDaConsulta({ ...ligada, ultimaTentativaEm: as("07:00").toISOString(), tentativasNoDia: 1, ultimoResultado: "falhou" }, "2099-03-20", as("10:59"), "2099-03-20")).toEqual({
      consultar: false,
      motivo: "cedo_demais",
    });
  });

  it("as tentativas de ontem não contam hoje", () => {
    expect(planoDaConsulta({ ...ligada, ultimaTentativaEm: as("17:00").toISOString(), tentativasNoDia: 3 }, "2099-03-21", new Date("2099-03-21T07:00:00-03:00"), "2099-03-20")).toMatchObject({
      consultar: true,
      tentativa: 1,
    });
  });
});

describe("OAB", () => {
  it("aceita com ou sem zeros à esquerda e normaliza a UF", () => {
    expect(validarOab("0099999", "rs")).toEqual({ ok: true, numero: "99999", uf: "RS" });
    expect(validarOab("99.999", "SC")).toEqual({ ok: true, numero: "99999", uf: "SC" });
  });

  it("recusa número vazio, longo, com letras ou UF inexistente", () => {
    expect(validarOab("", "RS").ok).toBe(false);
    expect(validarOab("12345678", "RS").ok).toBe(false);
    expect(validarOab("RS12345", "RS").ok).toBe(false);
    expect(validarOab("12345", "XX").ok).toBe(false);
  });
});

describe("teor", () => {
  const itens = pagina.items;

  it("tira o cabeçalho (classe, número, partes e advogados) nos três formatos do DJEN", () => {
    for (const item of itens.slice(0, 3)) {
      const corpo = normalizarTeor(item.texto);
      expect(corpo).not.toMatch(/OAB|ADVOGAD|FULAN|BELTRANO|5000\d{3}-00\.2099/);
    }
  });

  it("resolve as entidades e deixa um bloco por linha", () => {
    expect(normalizarTeor(itens[0].texto)).toBe(
      "DESPACHO/DECISÃO\nVistos.\nIntimo a parte autora para que, no prazo de 15 (quinze) dias, apresente réplica à contestação.\nApós, voltem conclusos.",
    );
    expect(normalizarTeor("<p>a&nbsp;&#231;&#xE3;o &Ccedil;&Otilde; &sect;1&ordm; &desconhecida;</p>")).toBe("a ção ÇÕ §1º &desconhecida;");
  });

  it("mantém tabela que não é de partes", () => {
    expect(normalizarTeor("<table><tr><td>Valor</td><td>R$ 10,00</td></tr></table>")).toContain("R$ 10,00");
  });

  it("processo sigiloso pelo destinatário ou pelo texto padrão", () => {
    expect(ehSigiloso({ destinatarioSigilo: true, texto: "<p>qualquer</p>" })).toBe(true);
    expect(ehSigiloso({ destinatarioSigilo: false, texto: itens[3].texto })).toBe(true);
    expect(ehSigiloso({ destinatarioSigilo: false, texto: itens[0].texto })).toBe(false);
  });
});

describe("extração dos dias", () => {
  const extrair = (texto: string) => extrairDiasDoPrazo(normalizarTeor(texto));

  describe("seguro", () => {
    it.each([
      ["Intimo a parte autora para que, no prazo de 15 (quinze) dias, apresente réplica à contestação.", 15, null],
      ["Intime-se a parte executada para pagamento em 15 dias, sob pena de multa.", 15, null],
      ["Intime-se a parte ré para, no prazo de quinze dias, contestar.", 15, null],
      ["Fica a parte autora intimada para, no prazo de 5 (cinco) dias corridos, recolher as custas.", 5, "corridos"],
      ["Intimem-se as partes para, no prazo comum de 10 (dez) dias úteis, especificarem provas.", 10, "uteis"],
      ["Intime-se o requerente para emendar a inicial no prazo de vinte e cinco dias.", 25, null],
      ["Intime-se a parte apelada para contrarrazões, no prazo de 15 (QUINZE) dias.", 15, null],
    ])("%s", (texto, dias, unidade) => {
      const r = extrair(`<p>${texto}</p>`);
      expect(r).toMatchObject({ situacao: "identificados", dias, unidade });
      if (r.situacao === "identificados") expect(r.trecho).toBe(texto);
    });

    it("o trecho mostra de onde saiu o número, com até 200 caracteres", () => {
      const longa = `Intime-se a parte autora para, no prazo de 15 (quinze) dias, ${"juntar os documentos indicados na decisão anterior, ".repeat(8)}sob pena de extinção.`;
      const r = extrair(`<p>${longa}</p>`);
      expect(r.situacao).toBe("identificados");
      if (r.situacao !== "identificados") return;
      expect(r.trecho.length).toBeLessThanOrEqual(200);
      expect(r.trecho).toContain("no prazo de 15 (quinze) dias");
    });
  });

  describe("na dúvida, não identifica", () => {
    it.each([
      ["mais de um prazo", "<p>Intime-se a parte autora para réplica em 15 dias.</p><p>Após, intimem-se as partes para especificar provas em 5 dias.</p>", "varios_prazos"],
      ["o mesmo número duas vezes", "<p>Intime-se a parte autora em 5 dias.</p><p>Depois, intime-se a parte ré em 5 dias.</p>", "varios_prazos"],
      ["algarismo e extenso diferentes", "<p>Intime-se a parte autora no prazo de 15 (dez) dias.</p>", "extenso_diferente"],
      ["prazo sucessivo", "<p>Intimem-se as partes, sucessivamente, no prazo de 15 dias.</p>", "sinal_de_cuidado"],
      ["prazo em dobro", "<p>Intime-se a parte ré, com prazo em dobro, para contestar em 15 dias.</p>", "sinal_de_cuidado"],
      ["prazo em horas", "<p>Intime-se a parte autora para se manifestar em 48 horas.</p>", "sinal_de_cuidado"],
      ["prazo em meses", "<p>Suspenda-se o processo por 6 meses. Intime-se a parte autora.</p>", "sinal_de_cuidado"],
      ["prazo legal sem número", "<p>Especifiquem as partes as provas que pretendem produzir, no prazo legal.</p>", "sinal_de_cuidado"],
      ["prazo de terceiro", "<p>Intime-se o perito para, no prazo de 10 dias, entregar o laudo.</p>", "sem_ligacao"],
      ["prazo só narrado", "<p>O prazo de dez dias para interposição de recurso encerrou-se sem manifestação.</p>", "sem_ligacao"],
      ["prazo que já passou", "<p>Decorrido o prazo de 15 dias, intime-se a parte autora.</p>", "sem_ligacao"],
      ["prazo no formato do evento", "<p>Manifeste-se a parte autora sobre o prosseguimento. Prazo: 05 dias.</p>", "sem_ligacao"],
      ["número sem ligação com prazo", "<p>A parte autora juntou 3 dias de atestado médico.</p>", "sem_ligacao"],
      ["fora do limite", "<p>Intime-se a parte autora no prazo de 400 dias.</p>", "fora_do_limite"],
      ["sem prazo nenhum", "<p>Ciência às partes da decisão do evento 10.</p>", "sem_prazo"],
      ["horário de audiência não é prazo", "<p>Audiência designada para 20/03/2099, às 17:30 horas. Intimem-se as partes.</p>", "sem_prazo"],
    ])("%s", (_nome, texto, motivo) => {
      expect(extrair(texto)).toMatchObject({ situacao: "nao_identificados", motivo });
    });

    it("com vários números, devolve os trechos de cada um", () => {
      const r = extrair(pagina.items[2].texto);
      expect(r).toMatchObject({ situacao: "nao_identificados", motivo: "varios_prazos" });
      if (r.situacao === "nao_identificados") {
        expect(r.trechos).toHaveLength(2);
        expect(r.trechos[0]).toContain("05 dias");
        expect(r.trechos[1]).toContain("60 dias");
      }
    });
  });

  it("números por extenso de um a noventa e nove, cem e cento e vinte", () => {
    expect(numeroPorExtenso("um")).toBe(1);
    expect(numeroPorExtenso("Três")).toBe(3);
    expect(numeroPorExtenso("quatorze")).toBe(14);
    expect(numeroPorExtenso("catorze")).toBe(14);
    expect(numeroPorExtenso("noventa e nove")).toBe(99);
    expect(numeroPorExtenso("cem")).toBe(100);
    expect(numeroPorExtenso("cento e vinte")).toBe(120);
    expect(numeroPorExtenso("vinte e dez")).toBeNull();
    expect(numeroPorExtenso("mil")).toBeNull();
  });
});

describe("recortar", () => {
  it("cabe no máximo e mostra onde cortou", () => {
    const texto = "a".repeat(300) + "ALVO" + "b".repeat(300);
    const r = recortar(texto, 300, 304, 50);
    expect(r.length).toBeLessThanOrEqual(50);
    expect(r).toContain("ALVO");
    expect(r.startsWith("…") && r.endsWith("…")).toBe(true);
    expect(recortar("curto", 0, 1, 50)).toBe("curto");
    expect(recortar(texto, 0, 0, 40).startsWith("a")).toBe(true);
  });
});

describe("o que é guardado", () => {
  const recebida = (i: number, mudar: Partial<ComunicacaoRecebida> = {}): ComunicacaoRecebida => {
    const item = pagina.items[i];
    return {
      djenId: item.id,
      hash: item.hash,
      numeroProcesso: item.numero_processo,
      dataDisponibilizacao: item.data_disponibilizacao,
      tribunal: item.siglaTribunal,
      orgao: item.nomeOrgao,
      classe: item.nomeClasse,
      tipoComunicacao: item.tipoComunicacao,
      tipoDocumento: item.tipoDocumento,
      link: item.link,
      destinatarioSigilo: item.destinatarios.some((d) => d.nome === "SIGILO"),
      ativa: item.ativo,
      texto: item.texto,
      textoTruncado: false,
      ...mudar,
    };
  };

  it("prazo seguro: metadados, trecho e dias, sem nomes", () => {
    const m = montarSugestao(recebida(0));
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(m.sugestao).toMatchObject({
      djenId: 990000001,
      numeroProcesso: "50000010020998210001",
      dataDisponibilizacao: "2099-03-09",
      sigiloso: false,
      tribunal: "TJRS",
      orgao: "Juizado Especial Cível Adjunto da Comarca Fictícia",
      diasSituacao: "identificados",
      dias: 15,
      trechoDias: "Intimo a parte autora para que, no prazo de 15 (quinze) dias, apresente réplica à contestação.",
    });
    expect(JSON.stringify(m.sugestao)).not.toMatch(/FULAN|EMPRESA FICT|ADVOGAD|OAB/);
    expect(m.sugestao.trecho!.length).toBeLessThanOrEqual(600);
  });

  it("sem segurança: marca dias não identificados e guarda o trecho do teor", () => {
    const m = montarSugestao(recebida(1));
    expect(m.ok && m.sugestao).toMatchObject({ diasSituacao: "nao_identificados", dias: null, trechoDias: null, link: null });
    expect(m.ok && m.sugestao.trecho).toContain("Prazo: 05 dias");
  });

  it("sigiloso: só id, número e data", () => {
    const m = montarSugestao(recebida(3));
    expect(m.ok && m.sugestao).toEqual({
      djenId: 990000004,
      numeroProcesso: "50000040020998210001",
      dataDisponibilizacao: "2099-03-10",
      sigiloso: true,
      hash: null,
      tribunal: null,
      orgao: null,
      classe: null,
      tipoComunicacao: null,
      tipoDocumento: null,
      link: null,
      trecho: null,
      diasSituacao: null,
      dias: null,
      unidadeDias: null,
      trechoDias: null,
    });
    expect(m.ok && m.corpo).toBeNull();
  });

  it("teor cortado pela VPS: não tenta extrair", () => {
    expect(montarSugestao(recebida(0, { textoTruncado: true }))).toMatchObject({ ok: true, sugestao: { diasSituacao: "nao_identificados", dias: null } });
  });

  it("recusa id, número ou data inválidos e link que não é https", () => {
    expect(montarSugestao(recebida(0, { djenId: 0 })).ok).toBe(false);
    expect(montarSugestao(recebida(0, { numeroProcesso: "123" })).ok).toBe(false);
    expect(montarSugestao(recebida(0, { dataDisponibilizacao: "2099-02-30" })).ok).toBe(false);
    expect(montarSugestao(recebida(0, { link: "javascript:alert(1)" }))).toMatchObject({ ok: true, sugestao: { link: null } });
  });
});
