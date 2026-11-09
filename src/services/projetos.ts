import { MODELOS_DE_QUADRO, type ModeloQuadro, colunasDoModelo, modeloPadrao, modeloPermitido } from "@/domain/quadro";
import { ErroDeValidacao } from "@/domain/erros";
import { validarDadosProjeto } from "@/domain/projeto";
import type { DadosProjeto, Projeto, StatusProjeto } from "@/domain/tipos";
import type { Repositorio } from "@/data/repositorio";

// Casos de uso de projetos. A interface chama estas funções, nunca o repositório direto.
// O agente chama as mesmas funções.

/** Cria o projeto com as colunas do modelo escolhido (padrão: Cível/JEC para processo, Consultivo para campanha). */
export async function criarProjeto(repo: Repositorio, dados: DadosProjeto, modelo?: ModeloQuadro): Promise<Projeto> {
  const resultado = validarDadosProjeto(dados);
  if (!resultado.ok) throw new ErroDeValidacao(resultado.erro);
  const tipo = resultado.valor.kind;
  if (modelo && !modeloPermitido(tipo, modelo)) {
    throw new ErroDeValidacao(
      tipo === "campaign"
        ? "Caso consultivo usa o modelo Consultivo."
        : `O modelo ${MODELOS_DE_QUADRO[modelo].nome} é só para casos consultivos. Escolha Cível/JEC, Trabalhista, Previdenciário ou Família.`,
    );
  }
  return repo.criarProjeto(resultado.valor, colunasDoModelo(modelo ?? modeloPadrao(tipo)));
}

export async function atualizarProjeto(repo: Repositorio, id: string, dados: DadosProjeto): Promise<Projeto> {
  const resultado = validarDadosProjeto(dados);
  if (!resultado.ok) throw new ErroDeValidacao(resultado.erro);
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
