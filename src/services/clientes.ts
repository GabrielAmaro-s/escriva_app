import { validarDadosCliente } from "@/domain/cliente";
import { ErroDeValidacao } from "@/domain/erros";
import type { Cliente, DadosCliente } from "@/domain/tipos";
import type { Repositorio } from "@/data/repositorio";

// Casos de uso de clientes. A interface e a API chamam estas funções, nunca o repositório direto.

export function listarClientes(repo: Repositorio): Promise<Cliente[]> {
  return repo.listarClientes();
}

export async function criarCliente(repo: Repositorio, dados: DadosCliente): Promise<Cliente> {
  const resultado = validarDadosCliente(dados);
  if (!resultado.ok) throw new ErroDeValidacao(resultado.erro);
  return repo.criarCliente(resultado.valor);
}

export async function atualizarCliente(repo: Repositorio, id: string, dados: DadosCliente): Promise<Cliente> {
  const resultado = validarDadosCliente(dados);
  if (!resultado.ok) throw new ErroDeValidacao(resultado.erro);
  return repo.atualizarCliente(id, resultado.valor);
}

/** Os processos e casos consultivos do cliente continuam existindo, só ficam sem cliente. */
export function excluirCliente(repo: Repositorio, id: string): Promise<void> {
  return repo.excluirCliente(id);
}
