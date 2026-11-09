import { describe, expect, it } from "vitest";
import { clienteVazio, cnpjValido, cpfValido, filtrarClientes, formatarDocumento, normalizarDocumento, validarDadosCliente } from "./cliente";
import type { Cliente } from "./tipos";

describe("CPF", () => {
  it("confere os dígitos verificadores", () => {
    expect(cpfValido("52998224725")).toBe(true);
    expect(cpfValido("52998224724")).toBe(false);
    expect(cpfValido("11111111111")).toBe(false);
    expect(cpfValido("5299822472")).toBe(false);
  });
});

describe("CNPJ", () => {
  it("aceita o numérico de sempre", () => {
    expect(cnpjValido("11222333000181")).toBe(true);
    expect(cnpjValido("11222333000182")).toBe(false);
    expect(cnpjValido("00000000000000")).toBe(false);
  });

  it("aceita o alfanumérico (exemplo da Receita: 12.ABC.345/01DE-35)", () => {
    expect(cnpjValido("12ABC34501DE35")).toBe(true);
    expect(cnpjValido("12ABC34501DE36")).toBe(false);
    // Os dois últimos são sempre dígitos.
    expect(cnpjValido("12ABC34501DEA5")).toBe(false);
  });

  it("normaliza e formata", () => {
    expect(normalizarDocumento("12.abc.345/01de-35")).toBe("12ABC34501DE35");
    expect(formatarDocumento("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
    expect(formatarDocumento("52998224725")).toBe("529.982.247-25");
    expect(formatarDocumento(null)).toBe("");
  });
});

describe("validação do cliente", () => {
  it("exige nome e normaliza os textos", () => {
    expect(validarDadosCliente({ ...clienteVazio(), nome: "  " })).toEqual({ ok: false, erro: "Escreva o nome do cliente." });
    const r = validarDadosCliente({ ...clienteVazio(), nome: " Cliente ", telefone: " ", email: " a@b.com ", documento: "529.982.247-25" });
    expect(r).toEqual({ ok: true, valor: { nome: "Cliente", tipo: "pf", documento: "52998224725", telefone: null, email: "a@b.com", observacoes: null } });
  });

  it("confere o documento pelo tipo", () => {
    expect(validarDadosCliente({ ...clienteVazio(), nome: "X", documento: "11.222.333/0001-81" })).toEqual({ ok: false, erro: "CPF inválido. Confira os números." });
    expect(validarDadosCliente({ ...clienteVazio(), nome: "X", tipo: "pj", documento: "11.222.333/0001-81" }).ok).toBe(true);
    expect(validarDadosCliente({ ...clienteVazio(), nome: "X", tipo: "pj", documento: "123" })).toEqual({ ok: false, erro: "CNPJ inválido. Confira os caracteres." });
  });

  it("recusa e-mail sem formato de e-mail", () => {
    expect(validarDadosCliente({ ...clienteVazio(), nome: "X", email: "sem-arroba" })).toEqual({ ok: false, erro: "E-mail inválido." });
  });
});

describe("busca de clientes", () => {
  const c = (nome: string, documento: string | null): Cliente => ({ id: nome, nome, tipo: "pf", documento, telefone: null, email: null, observacoes: null, criadoEm: "", atualizadoEm: "" });
  const lista = [c("Zeta Comércio", "11222333000181"), c("Alfa Serviços", null)];

  it("ordena por nome e acha por nome ou documento com pontuação", () => {
    expect(filtrarClientes(lista).map((x) => x.nome)).toEqual(["Alfa Serviços", "Zeta Comércio"]);
    expect(filtrarClientes(lista, "zeta").map((x) => x.nome)).toEqual(["Zeta Comércio"]);
    expect(filtrarClientes(lista, "11.222.333").map((x) => x.nome)).toEqual(["Zeta Comércio"]);
  });
});
