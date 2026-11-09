import type { AlteracaoTarefa, Coluna, PrioridadeTarefa, Tarefa, TipoColuna, TipoProjeto } from "./tipos";

export type ModeloQuadro = "civel" | "trabalhista" | "previdenciario" | "familia" | "consultivo";

export interface DefinicaoModelo {
  nome: string;
  colunas: { title: string; kind: TipoColuna }[];
}

/**
 * Colunas de cada modelo de quadro. As colunas representam o trabalho do advogado, não a fase do processo.
 * O modelo só decide as colunas criadas junto com o quadro; ele não fica gravado.
 */
export const MODELOS_DE_QUADRO: Record<ModeloQuadro, DefinicaoModelo> = {
  civel: {
    nome: "Cível / JEC",
    colunas: [
      { title: "A fazer", kind: "todo" },
      { title: "Em andamento", kind: "doing" },
      { title: "Aguardando decisão", kind: "waiting" },
      { title: "Concluído", kind: "done" },
    ],
  },
  trabalhista: {
    nome: "Trabalhista",
    colunas: [
      { title: "A fazer", kind: "todo" },
      { title: "Em andamento", kind: "doing" },
      { title: "Aguardando audiência", kind: "waiting" },
      { title: "Concluído", kind: "done" },
    ],
  },
  previdenciario: {
    nome: "Previdenciário",
    colunas: [
      { title: "Documentos do cliente", kind: "todo" },
      { title: "Requerimento INSS", kind: "doing" },
      { title: "Aguardando INSS/Justiça", kind: "waiting" },
      { title: "Concluído", kind: "done" },
    ],
  },
  familia: {
    nome: "Família",
    colunas: [
      { title: "A fazer", kind: "todo" },
      { title: "Em andamento", kind: "doing" },
      { title: "Aguardando", kind: "waiting" },
      { title: "Concluído", kind: "done" },
    ],
  },
  consultivo: {
    nome: "Consultivo",
    colunas: [
      { title: "A fazer", kind: "todo" },
      { title: "Redigindo", kind: "doing" },
      { title: "Aguardando cliente", kind: "waiting" },
      { title: "Entregue", kind: "done" },
    ],
  },
};

export const MODELOS: ModeloQuadro[] = ["civel", "trabalhista", "previdenciario", "familia", "consultivo"];

/** Modelo usado quando nenhum é escolhido: Cível/JEC para processo, Consultivo para caso consultivo. */
export function modeloPadrao(tipo: TipoProjeto): ModeloQuadro {
  return tipo === "campaign" ? "consultivo" : "civel";
}

/** Consultivo só para caso consultivo (campanha); os outros quatro só para processo. */
export function modelosDoTipo(tipo: TipoProjeto): ModeloQuadro[] {
  return tipo === "campaign" ? ["consultivo"] : MODELOS.filter((m) => m !== "consultivo");
}

export function modeloPermitido(tipo: TipoProjeto, modelo: ModeloQuadro): boolean {
  return modelosDoTipo(tipo).includes(modelo);
}

export function colunasDoModelo(modelo: ModeloQuadro): { title: string; kind: TipoColuna }[] {
  return MODELOS_DE_QUADRO[modelo].colunas.map((c) => ({ ...c }));
}

export const ROTULO_PRIORIDADE: Record<PrioridadeTarefa, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

export const PRIORIDADES: PrioridadeTarefa[] = ["low", "medium", "high", "urgent"];

/** Cor da bandeira de prioridade (variável CSS). */
export const COR_PRIORIDADE: Record<PrioridadeTarefa, string> = {
  low: "var(--ink3)",
  medium: "var(--s-blue)",
  high: "var(--s-amber)",
  urgent: "var(--s-red)",
};

/** Cor do marcador de cada coluna. */
export const COR_MARCADOR_COLUNA: Record<TipoColuna, string> = {
  todo: "var(--s-gray)",
  doing: "var(--s-violet)",
  waiting: "var(--s-amber)",
  done: "var(--s-green)",
};

const INTERVALO = 1024;

/** Posição para inserir entre dois vizinhos (posições fracionárias: um único update por movimento). */
export function posicaoEntre(anterior: number | null, seguinte: number | null): number {
  if (anterior === null && seguinte === null) return INTERVALO;
  if (anterior === null) return (seguinte as number) - INTERVALO;
  if (seguinte === null) return anterior + INTERVALO;
  return (anterior + seguinte) / 2;
}

export function ordenarPorPosicao<T extends { position: number }>(itens: T[]): T[] {
  return [...itens].sort((a, b) => a.position - b.position);
}

export function tarefasDaColuna(tarefas: Tarefa[], colunaId: string): Tarefa[] {
  return ordenarPorPosicao(tarefas.filter((t) => t.columnId === colunaId));
}

export function proximaPosicaoNaColuna(tarefas: Tarefa[], colunaId: string): number {
  const lista = tarefasDaColuna(tarefas, colunaId);
  return posicaoEntre(lista.at(-1)?.position ?? null, null);
}

export function posicaoNoTopo(tarefas: Tarefa[], colunaId: string): number {
  const primeira = tarefasDaColuna(tarefas, colunaId)[0];
  return posicaoEntre(null, primeira?.position ?? null);
}

/**
 * Regra de conclusão: a coluna "Concluído" e o campo `completed` andam juntos.
 * Ao entrar na coluna de conclusão a tarefa fica concluída; ao sair, volta a ficar aberta.
 */
export function alteracaoAoMudarColuna(tarefa: Tarefa, destino: Coluna, agora = new Date()): AlteracaoTarefa {
  const concluida = destino.kind === "done";
  if (concluida === tarefa.completed) return { columnId: destino.id };
  return {
    columnId: destino.id,
    completed: concluida,
    completedAt: concluida ? agora.toISOString() : null,
  };
}

/** Marcar/desmarcar como concluída move a tarefa para a coluna correspondente. */
export function alteracaoAoAlternarConclusao(tarefa: Tarefa, colunas: Coluna[], tarefas: Tarefa[], agora = new Date()): AlteracaoTarefa {
  const concluida = !tarefa.completed;
  const destino = concluida ? colunas.find((c) => c.kind === "done") : colunas.find((c) => c.kind === "todo");
  if (!destino) return { completed: concluida, completedAt: concluida ? agora.toISOString() : null };
  return {
    completed: concluida,
    completedAt: concluida ? agora.toISOString() : null,
    columnId: destino.id,
    position: proximaPosicaoNaColuna(
      tarefas.filter((t) => t.id !== tarefa.id),
      destino.id,
    ),
  };
}

export function progressoDoChecklist(tarefa: Pick<Tarefa, "checklist">): { feitos: number; total: number } {
  return { feitos: tarefa.checklist.filter((i) => i.done).length, total: tarefa.checklist.length };
}

/** Cor da data de entrega: vermelho se atrasada, âmbar se é hoje. */
export function corDoPrazo(prazo: string, concluida: boolean, hoje = hojeIso()): string {
  if (concluida) return "var(--ink3)";
  if (prazo < hoje) return "var(--s-red)";
  if (prazo === hoje) return "var(--s-amber)";
  return "var(--ink3)";
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function hojeIso(agora = new Date()): string {
  const m = String(agora.getMonth() + 1).padStart(2, "0");
  const d = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${m}-${d}`;
}

/** "28 de nov", ou "Hoje". */
export function formatarData(iso: string, hoje = hojeIso()): string {
  if (iso === hoje) return "Hoje";
  const [, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES[m - 1]}`;
}

function dataCurta(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES[m - 1]}`;
}

/** Período de campanha: "1 dez – 15 fev 2027". O ano aparece quando não é o atual. */
export function formatarPeriodo(inicio: string | null, fim: string | null, hoje = hojeIso()): string {
  const ano = hoje.slice(0, 4);
  const comAno = (iso: string) => dataCurta(iso) + (iso.slice(0, 4) !== ano ? ` ${iso.slice(0, 4)}` : "");
  if (!inicio && !fim) return "Sem período";
  if (!inicio) return `Até ${comAno(fim!)}`;
  if (!fim) return `Desde ${comAno(inicio)}`;
  return `${dataCurta(inicio)} – ${comAno(fim)}`;
}

export function novoId(): string {
  return crypto.randomUUID();
}
