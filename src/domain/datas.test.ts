import { describe, expect, it } from "vitest";
import { dataNoFuso, descreverDia, formatarDataHora, interpretarDataHora, isoNoFuso, paraCampoDataHora, somarDias } from "./datas";
import { calcularSituacaoAgente, descreverMinutos, validarLembrete } from "./lembrete";

const SP = "America/Sao_Paulo";

describe("datas com fuso", () => {
  it("isoNoFuso e dataNoFuso mostram o relógio de São Paulo", () => {
    const instante = new Date("2026-11-05T02:30:00.000Z"); // 23:30 do dia 4 em São Paulo
    expect(isoNoFuso(instante, SP)).toBe("2026-11-04T23:30:00-03:00");
    expect(dataNoFuso(instante, SP)).toBe("2026-11-04");
    expect(isoNoFuso(instante, "UTC")).toBe("2026-11-05T02:30:00+00:00");
  });

  it("interpretarDataHora lê horário sem fuso como horário local do fuso", () => {
    expect(interpretarDataHora("2026-11-07T15:00", SP)?.toISOString()).toBe("2026-11-07T18:00:00.000Z");
    expect(interpretarDataHora("2026-11-07 15:00", SP)?.toISOString()).toBe("2026-11-07T18:00:00.000Z");
    expect(interpretarDataHora("2026-11-07", SP)?.toISOString()).toBe("2026-11-07T12:00:00.000Z");
  });

  it("interpretarDataHora respeita fuso explícito e recusa lixo", () => {
    expect(interpretarDataHora("2026-11-07T15:00:00Z", SP)?.toISOString()).toBe("2026-11-07T15:00:00.000Z");
    expect(interpretarDataHora("2026-11-07T15:00:00-05:00", SP)?.toISOString()).toBe("2026-11-07T20:00:00.000Z");
    expect(interpretarDataHora("amanhã", SP)).toBeNull();
    expect(interpretarDataHora("2026-02-31", SP)).toBeNull();
  });

  it("somarDias atravessa meses e anos", () => {
    expect(somarDias("2026-12-30", 3)).toBe("2027-01-02");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("descreverDia usa hoje, amanhã, dia da semana ou data", () => {
    const hoje = "2026-11-04"; // quarta
    expect(descreverDia("2026-11-04", hoje)).toBe("hoje");
    expect(descreverDia("2026-11-05", hoje)).toBe("amanhã");
    expect(descreverDia("2026-11-06", hoje)).toBe("sexta");
    expect(descreverDia("2026-11-28", hoje)).toBe("28 de nov");
    expect(descreverDia("2027-01-15", hoje)).toBe("15 de jan de 2027");
  });

  it("formatarDataHora: Hoje, Amanhã e data com ano quando muda", () => {
    const agora = new Date("2026-11-04T12:00:00.000Z");
    expect(formatarDataHora("2026-11-04T18:00:00.000Z", SP, agora)).toBe("Hoje, 15:00");
    expect(formatarDataHora("2026-11-05T12:30:00.000Z", SP, agora)).toBe("Amanhã, 09:30");
    expect(formatarDataHora("2026-11-07T12:00:00.000Z", SP, agora)).toBe("7 de nov, 09:00");
    expect(formatarDataHora("2027-01-02T12:00:00.000Z", SP, agora)).toBe("2 de jan de 2027, 09:00");
  });

  it("paraCampoDataHora gera o valor do campo datetime-local", () => {
    expect(paraCampoDataHora("2026-11-07T18:00:00.000Z", SP)).toBe("2026-11-07T15:00");
  });
});

describe("lembretes", () => {
  it("valida texto e horário", () => {
    expect(validarLembrete({ texto: "  ", quando: "2026-11-07T18:00:00Z" })).toEqual({ ok: false, erro: "Escreva o texto do lembrete." });
    expect(validarLembrete({ texto: "Ligar", quando: "ontem" })).toEqual({ ok: false, erro: "Data e hora do lembrete inválidas." });
    expect(validarLembrete({ texto: " Ligar ", quando: "2026-11-07T15:00:00-03:00" })).toEqual({ ok: true, texto: "Ligar", quando: "2026-11-07T18:00:00.000Z" });
  });

  it("situação do agente pelo último sinal", () => {
    const agora = new Date("2026-11-04T12:00:00.000Z");
    expect(calcularSituacaoAgente(null, 60, agora)).toEqual({ situacao: "nunca", ultimoSinalEm: null, minutosSemSinal: null });
    expect(calcularSituacaoAgente("2026-11-04T11:30:00.000Z", 60, agora).situacao).toBe("ativo");
    expect(calcularSituacaoAgente("2026-11-04T10:00:00.000Z", 60, agora)).toMatchObject({ situacao: "sem-sinal", minutosSemSinal: 120 });
    expect(descreverMinutos(45)).toBe("45 min");
    expect(descreverMinutos(120)).toBe("2 h");
    expect(descreverMinutos(60 * 72)).toBe("3 dias");
  });
});
