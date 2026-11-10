// Datas e horários num fuso específico (IANA), sem depender do fuso da máquina.
// O servidor usa MYPLAN_FUSO_HORARIO; o navegador usa o fuso do próprio aparelho.

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS_DA_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function fusoDoAparelho(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

interface Partes {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
}

/** Ano, mês, dia, hora... de um instante, como o relógio do fuso mostraria. */
export function partesNoFuso(instante: Date, fuso: string): Partes {
  const formato = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(formato.formatToParts(instante).map((x) => [x.type, x.value]));
  return { ano: +p.year, mes: +p.month, dia: +p.day, hora: +p.hour % 24, minuto: +p.minute, segundo: +p.second };
}

/** Diferença do fuso para UTC naquele instante, em minutos (ex.: -180 em São Paulo). */
export function deslocamentoDoFuso(instante: Date, fuso: string): number {
  const p = partesNoFuso(instante, fuso);
  const comoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return Math.round((comoUtc - Math.floor(instante.getTime() / 1000) * 1000) / 60_000);
}

const dois = (n: number) => String(n).padStart(2, "0");

/** "2026-11-04": a data daquele instante no fuso. */
export function dataNoFuso(instante: Date, fuso: string): string {
  const p = partesNoFuso(instante, fuso);
  return `${p.ano}-${dois(p.mes)}-${dois(p.dia)}`;
}

/** "2026-11-04T15:00:00-03:00": ISO com o deslocamento do fuso. */
export function isoNoFuso(instante: Date, fuso: string): string {
  const p = partesNoFuso(instante, fuso);
  const d = deslocamentoDoFuso(instante, fuso);
  const sinal = d >= 0 ? "+" : "-";
  const abs = Math.abs(d);
  return `${p.ano}-${dois(p.mes)}-${dois(p.dia)}T${dois(p.hora)}:${dois(p.minuto)}:${dois(p.segundo)}${sinal}${dois(Math.floor(abs / 60))}:${dois(abs % 60)}`;
}

/**
 * Converte texto em instante. Aceita ISO com fuso ("...Z", "...-03:00") ou sem fuso
 * ("2026-11-07T15:00", "2026-11-07 15:00"), que é lido como horário do `fuso`.
 * Só data ("2026-11-07") vira 09:00 daquele dia. Devolve null se não entender.
 */
export function interpretarDataHora(texto: string, fuso: string): Date | null {
  const v = texto.trim();
  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  const [ano, mes, dia, hora = "09", minuto = "00", segundo = "00"] = m.slice(1);
  const comoUtc = Date.UTC(+ano, +mes - 1, +dia, +hora, +minuto, +segundo);
  // Duas passadas resolvem a mudança de horário de verão perto da virada.
  let instante = comoUtc - deslocamentoDoFuso(new Date(comoUtc), fuso) * 60_000;
  instante = comoUtc - deslocamentoDoFuso(new Date(instante), fuso) * 60_000;
  const resultado = new Date(instante);
  const conferencia = partesNoFuso(resultado, fuso);
  if (conferencia.mes !== +mes || conferencia.dia !== +dia) return null; // ex.: 31 de fevereiro
  return resultado;
}

/** Soma dias a uma data AAAA-MM-DD. */
export function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d + dias));
  return t.toISOString().slice(0, 10);
}

/** Dia da semana de uma data AAAA-MM-DD ("sexta"). */
export function diaDaSemana(data: string): string {
  const [a, m, d] = data.split("-").map(Number);
  return DIAS_DA_SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

/** "02/12" no mesmo ano de hoje, "02/12/2027" quando o ano muda (manual da marca, Voz e tom). */
export function dataNumerica(data: string, hoje: string): string {
  const [a, m, d] = data.split("-");
  return a === hoje.slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${a}`;
}

/** "quarta, 02/12" (ou "quarta, 02/12/2027" em outro ano). */
export function dataComDia(data: string, hoje: string): string {
  return `${diaDaSemana(data)}, ${dataNumerica(data, hoje)}`;
}

/** "qua, 02/12/2026": dia da semana abreviado e data completa, para cartões e a memória do cálculo. */
export function dataCurtaComDia(data: string): string {
  const [a, m, d] = data.split("-");
  return `${diaDaSemana(data).slice(0, 3)}, ${d}/${m}/${a}`;
}

/**
 * Data para mensagens do agente: "hoje", "amanhã", "ontem" ou "sexta, 22/01" (com o ano quando muda).
 * Segue a seção Voz e tom do manual da marca: dias da semana ajudam a ler a data.
 */
export function descreverDia(data: string, hoje: string): string {
  if (data === hoje) return "hoje";
  if (data === somarDias(hoje, 1)) return "amanhã";
  if (data === somarDias(hoje, -1)) return "ontem";
  return dataComDia(data, hoje);
}

/** "Hoje, 15:00", "Amanhã, 09:30" ou "7 de nov, 09:00", no fuso pedido. */
export function formatarDataHora(iso: string, fuso = fusoDoAparelho(), agora = new Date()): string {
  const instante = new Date(iso);
  const p = partesNoFuso(instante, fuso);
  const data = dataNoFuso(instante, fuso);
  const hoje = dataNoFuso(agora, fuso);
  const hora = `${dois(p.hora)}:${dois(p.minuto)}`;
  if (data === hoje) return `Hoje, ${hora}`;
  if (data === somarDias(hoje, 1)) return `Amanhã, ${hora}`;
  const ano = p.ano !== +hoje.slice(0, 4) ? ` de ${p.ano}` : "";
  return `${p.dia} de ${MESES[p.mes - 1]}${ano}, ${hora}`;
}

/** Valor para <input type="datetime-local"> no fuso do aparelho ("2026-11-07T15:00"). */
export function paraCampoDataHora(iso: string, fuso = fusoDoAparelho()): string {
  const p = partesNoFuso(new Date(iso), fuso);
  return `${p.ano}-${dois(p.mes)}-${dois(p.dia)}T${dois(p.hora)}:${dois(p.minuto)}`;
}
