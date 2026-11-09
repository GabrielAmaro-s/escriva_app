import { describe, expect, it } from "vitest";
import {
  AREAS,
  areaSugeridaDoModelo,
  detalhesProcessoVazios,
  formatarNumeroCnj,
  formatarValor,
  modeloSugeridoDaArea,
  numeroCnjValido,
  ROTULO_AREA,
  validarDetalhesProcesso,
} from "./processo";
import { MODELOS, modeloPermitido, modelosDoTipo } from "./quadro";

// Número fictício, montado só para o teste: 0001234-47.2026.8.21.0001.
const NUMERO = "00012344720268210001";

describe("número CNJ", () => {
  it("confere o dígito verificador (módulo 97)", () => {
    expect(numeroCnjValido(NUMERO)).toBe(true);
    expect(numeroCnjValido("00012344820268210001")).toBe(false);
    expect(numeroCnjValido("123")).toBe(false);
  });

  it("formata no padrão NNNNNNN-DD.AAAA.J.TR.OOOO", () => {
    expect(formatarNumeroCnj(NUMERO)).toBe("0001234-47.2026.8.21.0001");
    expect(formatarNumeroCnj(null)).toBe("");
  });
});

describe("validação dos detalhes", () => {
  it("normaliza textos, número e valor", () => {
    const r = validarDetalhesProcesso({
      ...detalhesProcessoVazios("civel"),
      numeroCnj: "0001234-47.2026.8.21.0001",
      tribunal: " TJRS ",
      orgao: "  ",
      valorCausa: 1234.567,
    });
    expect(r).toEqual({ ok: true, valor: { ...detalhesProcessoVazios("civel"), numeroCnj: NUMERO, tribunal: "TJRS", valorCausa: 1234.57 } });
  });

  it("recusa valor negativo e link sem http", () => {
    expect(validarDetalhesProcesso({ ...detalhesProcessoVazios(), valorCausa: -1 }).ok).toBe(false);
    expect(validarDetalhesProcesso({ ...detalhesProcessoVazios(), linkAutos: "eproc.tjrs.jus.br" })).toEqual({
      ok: false,
      erro: "O link dos autos precisa começar com http:// ou https://.",
    });
    expect(validarDetalhesProcesso({ ...detalhesProcessoVazios(), linkAutos: "https://eproc.exemplo" }).ok).toBe(true);
  });

  it("Família aparece como Família e sucessões", () => {
    expect(ROTULO_AREA.familia).toBe("Família e sucessões");
    expect(AREAS).toContain("administrativo");
  });

  it("formata o valor em reais", () => {
    expect(formatarValor(1234.5).replace(/\s/g, " ")).toBe("R$ 1.234,50");
  });
});

describe("área e modelo de quadro", () => {
  it("o modelo sugere a área", () => {
    expect(areaSugeridaDoModelo("trabalhista")).toBe("trabalhista");
    expect(areaSugeridaDoModelo("consultivo")).toBeNull();
  });

  it("a área sugere o modelo, quando há um que combine", () => {
    expect(modeloSugeridoDaArea("consumidor")).toBe("civel");
    expect(modeloSugeridoDaArea("familia")).toBe("familia");
    expect(modeloSugeridoDaArea("criminal")).toBeNull();
  });

  it("Consultivo só para caso consultivo; os outros quatro só para processo", () => {
    expect(modelosDoTipo("campaign")).toEqual(["consultivo"]);
    expect(modelosDoTipo("project")).toEqual(["civel", "trabalhista", "previdenciario", "familia"]);
    for (const m of MODELOS) expect(modeloPermitido("project", m)).toBe(m !== "consultivo");
  });
});
