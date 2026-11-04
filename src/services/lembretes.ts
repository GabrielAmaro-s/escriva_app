import { STATUS_ATIVOS, validarLembrete } from "@/domain/lembrete";
import type { DadosNovoLembrete, FiltroLembretes, Lembrete } from "@/domain/tipos";
import type { Repositorio } from "@/data/repositorio";

// Casos de uso de lembretes. A interface, a API e o agente chamam estas funções.

export async function criarLembrete(repo: Repositorio, dados: DadosNovoLembrete): Promise<Lembrete> {
  const resultado = validarLembrete(dados);
  if (!resultado.ok) throw new Error(resultado.erro);
  return repo.criarLembrete({ ...dados, texto: resultado.texto, quando: resultado.quando });
}

export function listarLembretes(repo: Repositorio, filtro?: FiltroLembretes): Promise<Lembrete[]> {
  return repo.listarLembretes(filtro);
}

/**
 * Lembretes pendentes que tocam nas próximas `horas` (padrão 1).
 * Os atrasados (horário já passou e ninguém agendou) também entram, para não se perderem.
 */
export function lembretesProximos(repo: Repositorio, horas = 1, agora = new Date()): Promise<Lembrete[]> {
  const ate = new Date(agora.getTime() + horas * 3_600_000).toISOString();
  return repo.listarLembretes({ status: ["pendente"], ate });
}

/**
 * O agente avisa que criou o horário (agendado) ou que já mandou a mensagem (enviado).
 * Com `quandoEsperado`, recusa se o lembrete foi remarcado ou cancelado depois do agendamento:
 * assim um horário antigo não dispara uma mensagem fora de hora.
 */
export async function marcarLembrete(
  repo: Repositorio,
  id: string,
  status: "agendado" | "enviado",
  opcoes: { quandoEsperado?: string; agora?: Date } = {},
): Promise<Lembrete> {
  const [atual] = (await repo.listarLembretes()).filter((l) => l.id === id);
  if (!atual) throw new Error("Lembrete não encontrado.");
  if (!STATUS_ATIVOS.includes(atual.status)) {
    throw new Error(atual.status === "cancelado" ? "Este lembrete foi cancelado. Não envie." : "Este lembrete já foi enviado.");
  }
  if (opcoes.quandoEsperado && new Date(opcoes.quandoEsperado).getTime() !== new Date(atual.quando).getTime()) {
    throw new Error(`Este lembrete foi remarcado para ${atual.quando}. Não envie agora; agende o novo horário.`);
  }
  const agora = (opcoes.agora ?? new Date()).toISOString();
  return repo.atualizarLembrete(id, status === "agendado" ? { status, agendadoEm: agora } : { status, enviadoEm: agora });
}

export function cancelarLembrete(repo: Repositorio, id: string): Promise<Lembrete> {
  return repo.atualizarLembrete(id, { status: "cancelado" });
}

/** Mudar o horário volta o lembrete para pendente, para o agente agendar de novo. */
export async function remarcarLembrete(repo: Repositorio, id: string, quando: string): Promise<Lembrete> {
  const instante = new Date(quando);
  if (Number.isNaN(instante.getTime())) throw new Error("Data e hora do lembrete inválidas.");
  return repo.atualizarLembrete(id, { quando: instante.toISOString(), status: "pendente", agendadoEm: null });
}
