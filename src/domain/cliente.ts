import type { Cliente, DadosCliente, TipoCliente } from "./tipos";

// Regras de clientes: CPF, CNPJ (inclusive o alfanumérico) e validação do cadastro.

export const MENSAGEM_CLIENTE_DUPLICADO = "Já existe um cliente com esse CPF/CNPJ.";

export const ROTULO_TIPO_CLIENTE: Record<TipoCliente, string> = {
  pf: "Pessoa física",
  pj: "Pessoa jurídica",
};

export function clienteVazio(): DadosCliente {
  return { nome: "", tipo: "pf", documento: null, telefone: null, email: null, observacoes: null };
}

export function paraDadosCliente(c: Cliente): DadosCliente {
  return { nome: c.nome, tipo: c.tipo, documento: c.documento, telefone: c.telefone, email: c.email, observacoes: c.observacoes };
}

/** Tira pontuação e espaços e passa para maiúsculas: "12.abc.345/01de-35" vira "12ABC34501DE35". */
export function normalizarDocumento(texto: string): string {
  return texto.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
}

const repetido = (s: string) => /^(.)\1*$/.test(s);

export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || repetido(cpf)) return false;
  const digito = (tamanho: number) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(cpf[i]) * (tamanho + 1 - i);
    return ((soma * 10) % 11) % 10;
  };
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

/**
 * CNPJ numérico ou alfanumérico (Receita, a partir de julho de 2026): 12 caracteres de 0-9 ou A-Z
 * e 2 dígitos verificadores. Cada caractere vale o código ASCII menos 48, então para os números
 * a conta é a mesma de sempre.
 */
export function cnpjValido(cnpj: string): boolean {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || repetido(cnpj)) return false;
  const pesos = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const digito = (tamanho: number) => {
    const p = pesos.slice(pesos.length - tamanho);
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += (cnpj.charCodeAt(i) - 48) * p[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return digito(12) === Number(cnpj[12]) && digito(13) === Number(cnpj[13]);
}

/** "52998224725" vira "529.982.247-25"; "12ABC34501DE35" vira "12.ABC.345/01DE-35". */
export function formatarDocumento(documento: string | null): string {
  if (!documento) return "";
  if (documento.length === 11) return documento.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (documento.length === 14) return documento.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, "$1.$2.$3/$4-$5");
  return documento;
}

const texto = (v: string | null | undefined) => v?.trim() || null;

/** Normaliza e valida o cadastro antes de chegar ao repositório. */
export function validarDadosCliente(dados: DadosCliente): { ok: true; valor: DadosCliente } | { ok: false; erro: string } {
  const nome = dados.nome.trim();
  if (!nome) return { ok: false, erro: "Escreva o nome do cliente." };
  if (nome.length > 120) return { ok: false, erro: "O nome pode ter até 120 caracteres." };
  if (dados.tipo !== "pf" && dados.tipo !== "pj") return { ok: false, erro: "Escolha pessoa física ou jurídica." };

  const documento = dados.documento ? normalizarDocumento(dados.documento) || null : null;
  if (documento && dados.tipo === "pf" && !cpfValido(documento)) return { ok: false, erro: "CPF inválido. Confira os números." };
  if (documento && dados.tipo === "pj" && !cnpjValido(documento)) return { ok: false, erro: "CNPJ inválido. Confira os caracteres." };

  const email = texto(dados.email);
  if (email && (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { ok: false, erro: "E-mail inválido." };
  const telefone = texto(dados.telefone);
  if (telefone && telefone.length > 30) return { ok: false, erro: "O telefone pode ter até 30 caracteres." };
  const observacoes = texto(dados.observacoes);
  if (observacoes && observacoes.length > 2000) return { ok: false, erro: "As observações podem ter até 2000 caracteres." };

  return { ok: true, valor: { nome, tipo: dados.tipo, documento, telefone, email, observacoes } };
}

/** Busca por nome ou documento (com ou sem pontuação). */
export function filtrarClientes(clientes: Cliente[], busca = ""): Cliente[] {
  const termo = busca.trim().toLowerCase();
  const ordenados = [...clientes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  if (!termo) return ordenados;
  const doc = normalizarDocumento(termo);
  return ordenados.filter((c) => c.nome.toLowerCase().includes(termo) || (doc.length >= 3 && c.documento?.includes(doc)));
}
