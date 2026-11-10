import { describe, expect, it } from "vitest";
import {
  regraSeguraDoProcesso,
  calcularPrazo,
  calcularPrazoDaIntimacao,
  criarCalendario,
  datasDosLembretes,
  feriadosNacionais,
  inicioDaContagem,
  normalizarTribunal,
  pascoa,
  prazoInterno,
  regraDaArea,
  tribunalDoProcesso,
  validarDadosPrazo,
} from "./prazos";
import type { Feriado } from "./tipos";

// Recorte da carga da 0005, com os mesmos valores.
function geral(tribunal: string, data: string, descricao: string, ate: string | null = null): Feriado {
  return { id: `${tribunal}-${data}`, userId: null, tribunal, data, ate, tipo: "feriado", descricao, fonte: null };
}
const CARGA: Feriado[] = [
  geral("TJRS", "2026-09-20", "Data Magna do Rio Grande do Sul"),
  geral("TJRS", "2027-09-20", "Data Magna do Rio Grande do Sul"),
  geral("TRF4", "2026-04-01", "Semana Santa", "2026-04-02"),
  geral("TRF4", "2026-12-20", "Recesso forense", "2027-01-06"),
  geral("TRT4", "2027-09-20", "Data Magna do Rio Grande do Sul"),
];
function local(data: string, descricao: string, extra: Partial<Feriado> = {}): Feriado {
  return { id: `local-${data}`, userId: "eu", tribunal: null, data, ate: null, tipo: "feriado", descricao, fonte: null, ...extra };
}

const civel = (tribunal: string | null = "TJRS", feriados = CARGA, suspenderNoRecesso = true) => criarCalendario({ feriados, tribunal, suspenderNoRecesso });

describe("feriados nacionais", () => {
  it("Páscoa de anos conhecidos", () => {
    expect(pascoa(2024)).toBe("2024-03-31");
    expect(pascoa(2025)).toBe("2025-04-20");
    expect(pascoa(2026)).toBe("2026-04-05");
    expect(pascoa(2027)).toBe("2027-03-28");
  });

  it("móveis de 2026: Carnaval, Sexta-feira Santa e Corpus Christi; fixos com a Consciência Negra", () => {
    const f = feriadosNacionais(2026);
    const datas = f.map((x) => x.data);
    expect(datas).toEqual(expect.arrayContaining(["2026-02-16", "2026-02-17", "2026-04-03", "2026-06-04", "2026-11-20", "2026-11-15"]));
    expect(f).toHaveLength(13);
    expect(f.find((x) => x.data === "2026-04-03")?.motivo).toBe("Sexta-feira Santa");
  });
});

describe("tribunal do processo", () => {
  it("pelo número CNJ: TJRS, TRT4 e TRF4", () => {
    expect(tribunalDoProcesso({ numeroCnj: "00012344720268210001", tribunal: null })).toBe("TJRS");
    expect(tribunalDoProcesso({ numeroCnj: "00000010020265040001", tribunal: "qualquer" })).toBe("TRT4");
    expect(tribunalDoProcesso({ numeroCnj: "50000010020264047100", tribunal: null })).toBe("TRF4");
  });

  it("sem número, pelo campo tribunal; texto longo demais não vira sigla", () => {
    expect(tribunalDoProcesso({ numeroCnj: null, tribunal: "TRT 4ª Região" })).toBe("TRT4");
    expect(normalizarTribunal("tjrs")).toBe("TJRS");
    expect(normalizarTribunal("Tribunal de Justiça do RS")).toBeNull();
    expect(tribunalDoProcesso(null)).toBeNull();
  });

  it("regra sugerida pela área", () => {
    expect(regraDaArea("criminal")).toBe("penal");
    expect(regraDaArea("trabalhista")).toBe("trabalhista");
    expect(regraDaArea("familia")).toBe("civel");
    expect(regraDaArea(null)).toBe("civel");
  });
});

describe("dias úteis (cível)", () => {
  it("atravessa o Carnaval", () => {
    const r = calcularPrazo({ comeco: "2026-02-12", dias: 5, unidade: "uteis", calendario: civel() });
    expect(r.vencimento).toBe("2026-02-23");
    expect(r.diasConsiderados).toEqual(["2026-02-13", "2026-02-18", "2026-02-19", "2026-02-20", "2026-02-23"]);
    expect(r.diasExcluidos).toEqual([{ data: "2026-02-16", ate: "2026-02-17", motivo: "Carnaval" }]);
  });

  it("Sexta-feira Santa no TJRS; no TRF4 também a quarta e a quinta da Semana Santa", () => {
    expect(calcularPrazo({ comeco: "2026-03-30", dias: 5, unidade: "uteis", calendario: civel("TJRS") }).vencimento).toBe("2026-04-07");
    const trf4 = calcularPrazo({ comeco: "2026-03-30", dias: 5, unidade: "uteis", calendario: civel("TRF4") });
    expect(trf4.vencimento).toBe("2026-04-09");
    expect(trf4.diasExcluidos).toEqual([
      { data: "2026-04-01", ate: "2026-04-02", motivo: "Semana Santa" },
      { data: "2026-04-03", motivo: "Sexta-feira Santa" },
    ]);
  });

  it("Corpus Christi", () => {
    expect(calcularPrazo({ comeco: "2026-06-03", dias: 2, unidade: "uteis", calendario: civel() }).vencimento).toBe("2026-06-08");
  });

  it("fim de semana não conta e não aparece na lista", () => {
    const r = calcularPrazo({ comeco: "2026-11-05", dias: 3, unidade: "uteis", calendario: civel() });
    expect(r.vencimento).toBe("2026-11-10");
    expect(r.diasExcluidos).toEqual([]);
  });

  it("virada de mês com a Consciência Negra (15/11 de 2026 cai no domingo)", () => {
    const r = calcularPrazo({ comeco: "2026-11-10", dias: 15, unidade: "uteis", calendario: civel() });
    expect(r.vencimento).toBe("2026-12-02");
    expect(r.diasExcluidos).toEqual([{ data: "2026-11-20", motivo: "Consciência Negra" }]);
  });

  it("recesso de 20/12 a 20/01 suspende e a contagem volta em 21/01", () => {
    const r = calcularPrazo({ comeco: "2026-12-15", dias: 15, unidade: "uteis", calendario: civel() });
    expect(r.diasConsiderados.slice(0, 4)).toEqual(["2026-12-16", "2026-12-17", "2026-12-18", "2027-01-21"]);
    expect(r.vencimento).toBe("2027-02-05");
    expect(r.diasExcluidos).toEqual([{ data: "2026-12-20", ate: "2027-01-20", motivo: "recesso de 20/12 a 20/01" }]);
  });

  it("feriado só do TJRS: 20/09 conta no TRF4 e não conta no TJRS nem no TRT4", () => {
    expect(calcularPrazo({ comeco: "2027-09-17", dias: 2, unidade: "uteis", calendario: civel("TJRS") }).vencimento).toBe("2027-09-22");
    expect(calcularPrazo({ comeco: "2027-09-17", dias: 2, unidade: "uteis", calendario: civel("TRT4") }).vencimento).toBe("2027-09-22");
    expect(calcularPrazo({ comeco: "2027-09-17", dias: 2, unidade: "uteis", calendario: civel("TRF4") }).vencimento).toBe("2027-09-21");
    // Sem tribunal identificado, a carga geral não entra.
    expect(calcularPrazo({ comeco: "2027-09-17", dias: 2, unidade: "uteis", calendario: civel(null) }).vencimento).toBe("2027-09-21");
  });
});

describe("feriados locais e suspensões do advogado", () => {
  it("local sem tribunal vale para todos; local de outro tribunal não vale", () => {
    const feriados = [...CARGA, local("2026-11-09", "Feriado municipal"), local("2026-11-11", "Só no TRT4", { tribunal: "TRT4" })];
    const r = calcularPrazo({ comeco: "2026-11-05", dias: 3, unidade: "uteis", calendario: civel("TJRS", feriados) });
    expect(r.vencimento).toBe("2026-11-11");
    expect(r.diasExcluidos).toEqual([{ data: "2026-11-09", motivo: "Feriado municipal" }]);
  });

  it("suspensão por período não conta, nem em dias corridos", () => {
    const feriados = [local("2026-11-09", "Enchente", { tipo: "suspensao", ate: "2026-11-11" })];
    expect(calcularPrazo({ comeco: "2026-11-05", dias: 3, unidade: "uteis", calendario: civel("TJRS", feriados) }).vencimento).toBe("2026-11-13");
    const penal = criarCalendario({ feriados, tribunal: "TJRS", suspenderNoRecesso: true });
    // 06, 07, 08 contam; 09 a 11 suspensos; 12 e 13 contam.
    expect(calcularPrazo({ comeco: "2026-11-05", dias: 5, unidade: "corridos", calendario: penal }).vencimento).toBe("2026-11-13");
  });
});

describe("expediente reduzido (CPC, art. 224, § 1º)", () => {
  const reduzido = (data: string) => local(data, "eproc fora do ar", { tipo: "expediente_reduzido" });

  it("no meio do prazo, o dia conta normalmente", () => {
    expect(calcularPrazo({ comeco: "2026-11-05", dias: 3, unidade: "uteis", calendario: civel("TJRS", [reduzido("2026-11-09")]) }).vencimento).toBe("2026-11-10");
  });

  it("no vencimento, passa para o dia útil seguinte", () => {
    const r = calcularPrazo({ comeco: "2026-11-05", dias: 3, unidade: "uteis", calendario: civel("TJRS", [reduzido("2026-11-10")]) });
    expect(r.vencimento).toBe("2026-11-11");
    expect(r.vencimentoProrrogado).toEqual({ de: "2026-11-10", motivo: "expediente reduzido: eproc fora do ar" });
  });

  it("no dia do começo, o começo passa para o dia útil seguinte", () => {
    const r = calcularPrazo({ comeco: "2026-11-05", dias: 3, unidade: "uteis", calendario: civel("TJRS", [reduzido("2026-11-05")]) });
    expect(r.comeco).toBe("2026-11-06");
    expect(r.vencimento).toBe("2026-11-11");
  });

  it("vencimento reduzido seguido de fim de semana vai para segunda", () => {
    expect(calcularPrazo({ comeco: "2026-11-05", dias: 1, unidade: "uteis", calendario: civel("TJRS", [reduzido("2026-11-06")]) }).vencimento).toBe("2026-11-09");
  });
});

describe("dias corridos (penal)", () => {
  const penal = (suspenderNoRecesso = true) => criarCalendario({ feriados: CARGA, tribunal: "TJRS", suspenderNoRecesso });

  it("intimação na sexta: começa na segunda (Súmula 310)", () => {
    const r = calcularPrazo({ comeco: "2026-11-06", dias: 5, unidade: "corridos", calendario: penal() });
    expect(r.diasConsiderados[0]).toBe("2026-11-09");
    expect(r.vencimento).toBe("2026-11-13");
  });

  it("fim de semana e feriado no meio contam; vencimento em feriado passa para o dia útil seguinte", () => {
    const r = calcularPrazo({ comeco: "2026-11-10", dias: 10, unidade: "corridos", calendario: penal() });
    expect(r.vencimento).toBe("2026-11-23");
    expect(r.vencimentoProrrogado).toEqual({ de: "2026-11-20", motivo: "Consciência Negra" });
  });

  it("recesso suspende o prazo penal (CPP, art. 798-A)", () => {
    const r = calcularPrazo({ comeco: "2026-12-15", dias: 5, unidade: "corridos", calendario: penal() });
    expect(r.diasConsiderados).toEqual(["2026-12-16", "2026-12-17", "2026-12-18", "2026-12-19", "2027-01-21"]);
    expect(r.vencimento).toBe("2027-01-21");
  });

  it("com a exceção do art. 798-A (réu preso), corre no recesso e o domingo prorroga", () => {
    const r = calcularPrazo({ comeco: "2026-12-15", dias: 5, unidade: "corridos", calendario: penal(false) });
    expect(r.vencimento).toBe("2026-12-21");
    expect(r.vencimentoProrrogado).toEqual({ de: "2026-12-20", motivo: "fim de semana" });
  });
});

describe("início da contagem", () => {
  const cal = civel();

  it("DJe: publicação no primeiro dia com expediente depois da disponibilização", () => {
    expect(inicioDaContagem({ inicio: "2026-11-09", meio: "dje", calendario: cal }).comeco).toBe("2026-11-10");
    expect(inicioDaContagem({ inicio: "2026-11-06", meio: "dje", calendario: cal }).comeco).toBe("2026-11-09");
    // Disponibilizado na quinta antes do feriado de sexta: publicado na segunda.
    expect(inicioDaContagem({ inicio: "2026-11-19", meio: "dje", calendario: cal }).comeco).toBe("2026-11-23");
  });

  it("DJe no recesso: a publicação não espera o fim da suspensão", () => {
    expect(inicioDaContagem({ inicio: "2026-12-21", meio: "dje", calendario: cal }).comeco).toBe("2026-12-22");
  });

  it("portal: ciência em dia sem expediente vale no dia útil seguinte", () => {
    expect(inicioDaContagem({ inicio: "2026-11-07", meio: "portal", calendario: cal }).comeco).toBe("2026-11-09");
    expect(inicioDaContagem({ inicio: "2026-11-10", meio: "portal", calendario: cal }).comeco).toBe("2026-11-10");
  });

  it("pessoal: a própria data", () => {
    expect(inicioDaContagem({ inicio: "2026-11-07", meio: "pessoal", calendario: cal }).comeco).toBe("2026-11-07");
  });
});

describe("cálculo completo e memória", () => {
  it("exemplo da proposta: 15 dias úteis, DJe, vence 02/12", () => {
    const r = calcularPrazoDaIntimacao({ inicio: "2026-11-09", meio: "dje", dias: 15, regra: "civel" }, CARGA, "TJRS");
    expect(r.vencimento).toBe("2026-12-02");
    expect(r.memoria).toBe(
      "15 dias úteis, Cível (CPC). Disponibilizado no DJe em 09/11/2026, publicado em 10/11/2026. " +
        "A contagem começa em 11/11/2026. Fora da contagem, além dos fins de semana: 20/11 (Consciência Negra). Vence em 02/12/2026.",
    );
  });

  it("prazo em dobro conta o dobro dos dias", () => {
    const r = calcularPrazoDaIntimacao({ inicio: "2026-11-05", meio: "pessoal", dias: 3, regra: "civel", emDobro: true }, CARGA, "TJRS");
    expect(r.diasContados).toBe(6);
    expect(r.vencimento).toBe("2026-11-13");
    expect(r.memoria).toContain("3 dias úteis em dobro (6 dias)");
  });

  it("juizado: o recesso fica desligado por padrão e pode ser ligado", () => {
    expect(calcularPrazoDaIntimacao({ inicio: "2026-12-15", meio: "pessoal", dias: 5, regra: "juizado" }, CARGA, "TJRS").vencimento).toBe("2026-12-22");
    expect(calcularPrazoDaIntimacao({ inicio: "2026-12-15", meio: "pessoal", dias: 5, regra: "juizado", suspenderNoRecesso: true }, CARGA, "TJRS").vencimento).toBe(
      "2027-01-22",
    );
  });

  it("memória cita o recesso como um período, a prorrogação e o tribunal não identificado", () => {
    const r = calcularPrazoDaIntimacao({ inicio: "2026-12-15", meio: "pessoal", dias: 15, regra: "civel" }, CARGA, null);
    expect(r.memoria).toContain("Fora da contagem, além dos fins de semana: 20/12 a 20/01 (recesso de 20/12 a 20/01).");
    expect(r.memoria).toContain("Tribunal não identificado");
    const p = calcularPrazoDaIntimacao({ inicio: "2026-11-10", meio: "pessoal", dias: 10, regra: "penal" }, CARGA, "TJRS");
    expect(p.memoria).toContain("O último dia caiu em 20/11 (Consciência Negra) e passou para o dia útil seguinte.");
    expect(p.memoria).toContain("Vence em 23/11/2026.");
    const excecao = calcularPrazoDaIntimacao({ inicio: "2026-12-15", meio: "pessoal", dias: 5, regra: "penal", suspenderNoRecesso: false }, CARGA, "TJRS");
    expect(excecao.memoria).toContain("Sem a suspensão do recesso, por exceção marcada.");
  });
});

describe("prazo interno e lembretes", () => {
  const cal = civel();

  it("margem de 2 dias úteis antes do vencimento", () => {
    expect(prazoInterno("2026-12-02", 2, cal)).toBe("2026-11-30");
    expect(prazoInterno("2026-11-23", 2, cal)).toBe("2026-11-18"); // pula o feriado e o fim de semana
    expect(prazoInterno("2026-12-02", 0, cal)).toBe("2026-12-02");
  });

  it("o recesso não empurra o prazo interno para dezembro", () => {
    expect(prazoInterno("2027-01-22", 2, cal)).toBe("2027-01-20");
  });

  it("D-3, D-1 e o dia, contados do prazo fatal em dias com expediente", () => {
    expect(datasDosLembretes("2026-11-23", cal)).toEqual({ "d-3": "2026-11-17", "d-1": "2026-11-19", dia: "2026-11-23" });
  });
});

describe("validação", () => {
  it("recusa data, dias e margem inválidos", () => {
    const base = { inicio: "2026-11-09", meio: "dje" as const, dias: 15, regra: "civel" as const };
    expect(validarDadosPrazo(base)).toEqual({ ok: true });
    expect(validarDadosPrazo({ ...base, inicio: "2026-02-31" })).toMatchObject({ ok: false });
    expect(validarDadosPrazo({ ...base, dias: 0 })).toMatchObject({ ok: false });
    expect(validarDadosPrazo({ ...base, dias: 1.5 })).toMatchObject({ ok: false });
    expect(validarDadosPrazo({ ...base, margem: 31 })).toMatchObject({ ok: false });
  });
});

describe("regra segura do processo (agente)", () => {
  it("criminal e trabalhista não dependem do órgão", () => {
    expect(regraSeguraDoProcesso({ area: "criminal", orgao: "Juizado Especial Criminal" })).toBe("penal");
    expect(regraSeguraDoProcesso({ area: "trabalhista", orgao: null })).toBe("trabalhista");
  });

  it("órgão com Juizado (com ou sem acento e maiúscula) usa a regra do juizado", () => {
    expect(regraSeguraDoProcesso({ area: "civel", orgao: "Juizado Especial Cível" })).toBe("juizado");
    expect(regraSeguraDoProcesso({ area: "previdenciario", orgao: "2º JUIZADO Especial Federal" })).toBe("juizado");
    expect(regraSeguraDoProcesso({ area: null, orgao: "juizado da fazenda pública" })).toBe("juizado");
  });

  it("cível sem a pista, sem área ou sem detalhes não assume (pergunta vara comum ou juizado)", () => {
    expect(regraSeguraDoProcesso({ area: "civel", orgao: "Vara Cível" })).toBeNull();
    expect(regraSeguraDoProcesso({ area: "civel", orgao: null })).toBeNull();
    expect(regraSeguraDoProcesso({ area: null, orgao: null })).toBeNull();
    expect(regraSeguraDoProcesso({ area: "consumidor", orgao: null })).toBeNull();
    expect(regraSeguraDoProcesso(null)).toBeNull();
  });

  it("família vai sempre para vara: regra cível", () => {
    expect(regraSeguraDoProcesso({ area: "familia", orgao: "Vara de Família" })).toBe("civel");
  });
});
