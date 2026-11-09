import { type ModeloQuadro, colunasDoModelo, modeloPadrao } from "@/domain/quadro";
import { validarDadosProjeto } from "@/domain/projeto";
import type { DadosProjeto, Projeto, StatusProjeto } from "@/domain/tipos";
import type { Repositorio } from "@/data/repositorio";

// Casos de uso de projetos. A interface chama estas funções, nunca o repositório direto.
// O agente chama as mesmas funções.

/** Cria o projeto com as colunas do modelo escolhido (padrão: Cível/JEC para processo, Consultivo para campanha). */
export async function criarProjeto(repo: Repositorio, dados: DadosProjeto, modelo?: ModeloQuadro): Promise<Projeto> {
  const resultado = validarDadosProjeto(dados);
  if (!resultado.ok) throw new Error(resultado.erro);
  return repo.criarProjeto(resultado.valor, colunasDoModelo(modelo ?? modeloPadrao(resultado.valor.kind)));
}

export async function atualizarProjeto(repo: Repositorio, id: string, dados: DadosProjeto): Promise<Projeto> {
  const resultado = validarDadosProjeto(dados);
  if (!resultado.ok) throw new Error(resultado.erro);
  return repo.atualizarProjeto(id, resultado.valor);
}

export function definirStatusProjeto(repo: Repositorio, id: string, status: StatusProjeto) {
  return repo.atualizarProjeto(id, { status });
}

export function arquivarProjeto(repo: Repositorio, id: string) {
  return repo.atualizarProjeto(id, { archivedAt: new Date().toISOString() });
}

export function restaurarProjeto(repo: Repositorio, id: string) {
  return repo.atualizarProjeto(id, { archivedAt: null });
}

export function excluirProjeto(repo: Repositorio, id: string) {
  return repo.excluirProjeto(id);
}
