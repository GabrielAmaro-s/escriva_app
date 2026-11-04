import type { Lembrete, StatusLembrete } from "./tipos";

/** Ainda vai tocar: pendente (esperando o agente) ou agendado (o agente já marcou o horário). */
export const STATUS_ATIVOS: StatusLembrete[] = ["pendente", "agendado"];

export function ehLembreteAtivo(l: Pick<Lembrete, "status">): boolean {
  return STATUS_ATIVOS.includes(l.status);
}

export function ordenarPorQuando<T extends Pick<Lembrete, "quando">>(lista: T[]): T[] {
  return [...lista].sort((a, b) => a.quando.localeCompare(b.quando));
}

/** Validação do texto e do horário de um lembrete. */
export function validarLembrete(dados: { texto: string; quando: string }): { ok: true; texto: string; quando: string } | { ok: false; erro: string } {
  const texto = dados.texto.trim();
  if (!texto) return { ok: false, erro: "Escreva o texto do lembrete." };
  if (texto.length > 500) return { ok: false, erro: "O lembrete pode ter até 500 caracteres." };
  const instante = new Date(dados.quando);
  if (Number.isNaN(instante.getTime())) return { ok: false, erro: "Data e hora do lembrete inválidas." };
  return { ok: true, texto, quando: instante.toISOString() };
}

export type SituacaoAgente = { situacao: "ativo" | "sem-sinal" | "nunca"; ultimoSinalEm: string | null; minutosSemSinal: number | null };

/** "Ativo" se o último sinal veio dentro do limite; senão, há quantos minutos está sem sinal. */
export function calcularSituacaoAgente(ultimoSinalEm: string | null, limiteMin: number, agora = new Date()): SituacaoAgente {
  if (!ultimoSinalEm) return { situacao: "nunca", ultimoSinalEm: null, minutosSemSinal: null };
  const minutos = Math.max(0, Math.floor((agora.getTime() - new Date(ultimoSinalEm).getTime()) / 60_000));
  return { situacao: minutos <= limiteMin ? "ativo" : "sem-sinal", ultimoSinalEm, minutosSemSinal: minutos };
}

/** "45 min", "3 h", "2 dias". */
export function descreverMinutos(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 48) return `${horas} h`;
  return `${Math.floor(horas / 24)} dias`;
}
