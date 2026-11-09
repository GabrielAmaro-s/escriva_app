import { ErroDeValidacao } from "@/domain/erros";
import { STATUS_ATIVOS } from "@/domain/lembrete";
import {
  MARGEM_MAXIMA,
  ajustarAlteracaoAoTipo,
  criarCalendario,
  dataValida,
  lembretesDesejados,
  montarContagem,
  tribunalDoProcesso,
  validarDadosPrazo,
  type DadosPrazo,
} from "@/domain/prazos";
import type { AlteracaoTarefa, ContagemPrazo, DadosNovoFeriado, Feriado, Lembrete, Preferencias, Tarefa } from "@/domain/tipos";
import type { Repositorio } from "@/data/repositorio";

// Casos de uso de prazos, audiências, feriados locais e preferências.
// A interface, a API e o agente chamam estas funções.

export interface ContextoPrazos {
  /** Fuso dos lembretes (navegador: o do aparelho; servidor: MYPLAN_FUSO_HORARIO). */
  fuso: string;
  agora?: Date;
}

/** Feriados e tribunal do processo da tarefa, para calcular prazos e lembretes. */
export async function calendarioDoProjeto(repo: Repositorio, projetoId: string): Promise<{ feriados: Feriado[]; tribunal: string | null }> {
  const [feriados, projetos] = await Promise.all([repo.listarFeriados(), repo.listarProjetos()]);
  const projeto = projetos.find((p) => p.id === projetoId);
  return { feriados, tribunal: tribunalDoProcesso(projeto?.processo) };
}

/** Vencimento, memória e prazo interno sugerido, sem gravar nada. Sem margem, vale a das Configurações. */
export async function calcularPrazoDaTarefa(
  repo: Repositorio,
  projetoId: string,
  dados: DadosPrazo & { margem?: number },
): Promise<{ contagem: ContagemPrazo; prazoInterno: string }> {
  const validacao = validarDadosPrazo(dados);
  if (!validacao.ok) throw new ErroDeValidacao(validacao.erro);
  const margem = dados.margem ?? (await repo.obterPreferencias()).margemPrazoInterno;
  const { feriados, tribunal } = await calendarioDoProjeto(repo, projetoId);
  return montarContagem({ ...dados, margem }, feriados, tribunal);
}

/**
 * Deixa os lembretes automáticos da tarefa (D-3, D-1 e no dia) iguais ao que ela pede agora:
 * cancela os que não valem mais (ou mudaram de horário) e cria os que faltam.
 * Os lembretes feitos à mão não são tocados.
 */
export async function sincronizarLembretesAutomaticos(repo: Repositorio, tarefa: Tarefa, ctx: ContextoPrazos): Promise<void> {
  const ativos = (await repo.listarLembretes({ tarefaId: tarefa.id, status: STATUS_ATIVOS })).filter((l) => l.automatico);
  let desejados: ReturnType<typeof lembretesDesejados> = [];
  if (!tarefa.completed && (tarefa.tipo === "prazo" || tarefa.tipo === "audiencia")) {
    const { feriados, tribunal } = await calendarioDoProjeto(repo, tarefa.projectId);
    desejados = lembretesDesejados(tarefa, criarCalendario({ feriados, tribunal }), ctx.fuso, ctx.agora);
  }

  const mantidos = new Set<Lembrete["automatico"]>();
  for (const l of ativos) {
    const igual = desejados.find((d) => d.automatico === l.automatico && d.texto === l.texto && new Date(d.quando).getTime() === new Date(l.quando).getTime());
    if (igual && !mantidos.has(l.automatico)) mantidos.add(l.automatico);
    else await repo.atualizarLembrete(l.id, { status: "cancelado" });
  }
  for (const d of desejados) {
    if (mantidos.has(d.automatico)) continue;
    await repo.criarLembrete({ tarefaId: tarefa.id, projetoId: tarefa.projectId, texto: d.texto, quando: d.quando, automatico: d.automatico });
  }
}

const CAMPOS_DOS_LEMBRETES: (keyof AlteracaoTarefa)[] = ["tipo", "prazoFatal", "horarioAudiencia", "localAudiencia", "completed", "title"];

/**
 * Grava uma alteração de tarefa: os campos que não valem para o tipo final vão a nulo na
 * mesma gravação, e os lembretes automáticos acompanham (concluir cancela, reabrir recria).
 */
export async function alterarTarefa(repo: Repositorio, antes: Tarefa, alteracao: AlteracaoTarefa, ctx: ContextoPrazos): Promise<Tarefa> {
  const ajustada = ajustarAlteracaoAoTipo(antes, alteracao);
  if (ajustada.horarioAudiencia && Number.isNaN(new Date(ajustada.horarioAudiencia).getTime())) throw new ErroDeValidacao("Data e hora da audiência inválidas.");
  if (ajustada.prazoFatal && !dataValida(ajustada.prazoFatal)) throw new ErroDeValidacao("Prazo fatal inválido.");
  const depois = await repo.atualizarTarefa(antes.id, ajustada);
  if (CAMPOS_DOS_LEMBRETES.some((c) => ajustada[c] !== undefined && ajustada[c] !== antes[c])) {
    await sincronizarLembretesAutomaticos(repo, depois, ctx);
  }
  return depois;
}

/** Alteração que transforma a tarefa num prazo com a contagem calculada. */
export function alteracaoDePrazo(contagem: ContagemPrazo, prazoInterno: string): AlteracaoTarefa {
  return { tipo: "prazo", prazoFatal: contagem.vencimento, contagem, dueOn: prazoInterno <= contagem.vencimento ? prazoInterno : contagem.vencimento };
}

// Feriados locais ---------------------------------------------------------------------

export function listarFeriados(repo: Repositorio): Promise<Feriado[]> {
  return repo.listarFeriados();
}

export async function criarFeriadoLocal(repo: Repositorio, dados: DadosNovoFeriado): Promise<Feriado> {
  const descricao = dados.descricao.trim();
  if (!descricao) throw new ErroDeValidacao("Descreva o feriado.");
  if (descricao.length > 120) throw new ErroDeValidacao("A descrição pode ter até 120 caracteres.");
  if (!dataValida(dados.data)) throw new ErroDeValidacao("Data do feriado inválida.");
  const ate = dados.ate && dados.ate !== dados.data ? dados.ate : null;
  if (ate && (!dataValida(ate) || ate < dados.data)) throw new ErroDeValidacao("O fim do período precisa ser depois do início.");
  const tribunal = dados.tribunal?.trim() ? dados.tribunal.trim().toUpperCase() : null;
  if (tribunal && !/^[A-Z0-9]{2,10}$/.test(tribunal)) throw new ErroDeValidacao("Tribunal inválido. Use a sigla, como TJRS.");
  return repo.criarFeriado({ data: dados.data, ate, tribunal, tipo: dados.tipo ?? "feriado", descricao });
}

export function excluirFeriadoLocal(repo: Repositorio, id: string): Promise<void> {
  return repo.excluirFeriado(id);
}

// Preferências ------------------------------------------------------------------------

export async function salvarPreferencias(repo: Repositorio, preferencias: Preferencias): Promise<Preferencias> {
  const m = preferencias.margemPrazoInterno;
  if (!Number.isInteger(m) || m < 0 || m > MARGEM_MAXIMA) throw new ErroDeValidacao(`A margem deve ficar entre 0 e ${MARGEM_MAXIMA} dias úteis.`);
  return repo.salvarPreferencias({ margemPrazoInterno: m });
}
