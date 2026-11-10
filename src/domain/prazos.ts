import { dataNoFuso, interpretarDataHora, partesNoFuso, somarDias } from "./datas";
import type {
  AlteracaoTarefa,
  AreaProcesso,
  ContagemPrazo,
  DetalhesProcesso,
  DiaExcluido,
  Feriado,
  LembreteAutomatico,
  MeioIntimacao,
  RegraPrazo,
  Tarefa,
  TipoTarefa,
  UnidadePrazo,
} from "./tipos";

// Motor de prazos: funções puras, sem banco. Ainda não validado por advogados.
//
// Princípio: um feriado ou uma suspensão a mais empurra o vencimento para depois do real e
// pode fazer o advogado perder o prazo. Na dúvida, o dia não é tirado da contagem, e entre
// duas leituras possíveis da regra o motor fica com a que vence antes.
//
// Fontes das regras:
// - CPC, art. 219 (dias úteis), art. 220 (suspensão de 20/12 a 20/01), art. 224 (exclui o dia do
//   começo, inclui o do vencimento; § 1º expediente reduzido ou indisponibilidade; § 2º e § 3º DJe);
// - CLT, arts. 775 e 775-A; Lei 9.099/1995, art. 12-A;
// - CPP, art. 798 (dias corridos, prorrogação) e art. 798-A (suspensão de 20/12 a 20/01, Lei 14.365/2022);
// - Súmula 310 do STF (intimação na sexta: o prazo começa na segunda);
// - Lei 11.419/2006, art. 4º (DJe) e art. 5º (intimação pelo portal).

/** Aviso mostrado junto de todo cálculo. Para tirar de todas as telas, troque por null. */
export const AVISO_CONTAGEM_EM_VALIDACAO: string | null = "Contagem em validação. Confira o vencimento antes de usar.";

// Situação de um prazo (tela e agente) -------------------------------------------------

export type SituacaoPrazo = "fatal_vencido" | "vence_hoje" | "interno_vencido" | "interno_hoje" | "no_prazo";

/** Cor do estado no manual da marca: fatal, interno ou no-prazo. A palavra vai sempre junto. */
export type CorDoEstado = "fatal" | "interno" | "no-prazo";

export function situacaoDoPrazo(t: { prazoFatal: string | null; dueOn: string | null }, hoje: string): SituacaoPrazo {
  if (t.prazoFatal && t.prazoFatal < hoje) return "fatal_vencido";
  if (t.prazoFatal === hoje) return "vence_hoje";
  if (t.dueOn && t.dueOn < hoje) return "interno_vencido";
  if (t.dueOn === hoje) return "interno_hoje";
  return "no_prazo";
}

/** Selo do prazo: palavra, cor e, quando faz sentido, os dias até o fatal ("5 dias"). */
export function seloDoPrazo(t: { prazoFatal: string | null; dueOn: string | null; completed: boolean }, hoje: string): { rotulo: string; cor: CorDoEstado; dias: string | null } {
  if (t.completed) return { rotulo: "Cumprido", cor: "no-prazo", dias: null };
  const s = situacaoDoPrazo(t, hoje);
  const faltam = t.prazoFatal ? diasEntreDatas(hoje, t.prazoFatal) : null;
  const dias = faltam !== null && faltam > 0 ? `${faltam} ${faltam === 1 ? "dia" : "dias"}` : null;
  if (s === "fatal_vencido") return { rotulo: "Fatal vencido", cor: "fatal", dias: null };
  if (s === "vence_hoje") return { rotulo: "Vence hoje", cor: "fatal", dias: null };
  if (s === "interno_vencido") return { rotulo: "Interno vencido", cor: "interno", dias };
  return { rotulo: "No prazo", cor: "no-prazo", dias };
}

/** Dias corridos entre duas datas AAAA-MM-DD (b - a). */
export function diasEntreDatas(a: string, b: string): number {
  const utc = (d: string) => {
    const [ano, mes, dia] = d.split("-").map(Number);
    return Date.UTC(ano, mes - 1, dia);
  };
  return Math.round((utc(b) - utc(a)) / 86_400_000);
}

export const MARGEM_PADRAO = 2;
export const MENSAGEM_FERIADO_DUPLICADO = "Você já cadastrou um feriado nessa data.";
export const MARGEM_MAXIMA = 30;
export const DIAS_MAXIMOS = 365;

export interface InfoRegra {
  rotulo: string;
  unidade: UnidadePrazo;
  /** Padrão da suspensão de 20/12 a 20/01. O advogado pode desligar (exceções) ou ligar. */
  suspenderNoRecesso: boolean;
  base: string;
}

export const REGRAS: Record<RegraPrazo, InfoRegra> = {
  civel: { rotulo: "Cível (CPC)", unidade: "uteis", suspenderNoRecesso: true, base: "CPC, arts. 219, 220 e 224" },
  trabalhista: { rotulo: "Trabalhista (CLT)", unidade: "uteis", suspenderNoRecesso: true, base: "CLT, arts. 775 e 775-A" },
  // Sem lei expressa sobre o recesso nos juizados: pelo princípio acima, a suspensão fica desligada.
  juizado: { rotulo: "Juizado especial", unidade: "uteis", suspenderNoRecesso: false, base: "Lei 9.099/1995, art. 12-A" },
  penal: { rotulo: "Penal (CPP)", unidade: "corridos", suspenderNoRecesso: true, base: "CPP, arts. 798 e 798-A" },
};

export const REGRAS_LISTA: RegraPrazo[] = ["civel", "trabalhista", "juizado", "penal"];

export const ROTULO_MEIO: Record<MeioIntimacao, string> = {
  dje: "Diário eletrônico (DJe)",
  portal: "Portal (eproc, PJe)",
  pessoal: "Pessoal ou por oficial",
};

/** Regra sugerida pela área do processo. */
export function regraDaArea(area: AreaProcesso | null | undefined): RegraPrazo {
  if (area === "criminal") return "penal";
  if (area === "trabalhista") return "trabalhista";
  return "civel";
}

/**
 * Regra que dá para afirmar só pelo processo, sem perguntar (usada pelo agente).
 * Cível em vara comum e em juizado contam diferente no recesso: aplicar a cível num JEC
 * empurraria o vencimento para depois do real. Por isso, sem a palavra "Juizado" no órgão,
 * áreas que podem estar em vara ou em juizado (cível, consumidor, previdenciário, tributário,
 * administrativo, outra ou sem área) devolvem null: a pergunta é "vara comum ou juizado?".
 */
export function regraSeguraDoProcesso(processo: Pick<DetalhesProcesso, "area" | "orgao"> | null | undefined): RegraPrazo | null {
  const area = processo?.area ?? null;
  if (area === "criminal") return "penal";
  if (area === "trabalhista") return "trabalhista";
  const orgao = (processo?.orgao ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (orgao.includes("juizado")) return "juizado";
  if (area === "familia") return "civel";
  return null;
}

// Datas ------------------------------------------------------------------------------

/** "02/12/2026". */
export function formatarData(data: string): string {
  const [a, m, d] = data.split("-");
  return `${d}/${m}/${a}`;
}

/** "02/12". */
export function formatarDataCurta(data: string): string {
  const [, m, d] = data.split("-");
  return `${d}/${m}`;
}

export function dataValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const [a, m, d] = data.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

function diaDaSemanaNumero(data: string): number {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

const dois = (n: number) => String(n).padStart(2, "0");

// Feriados nacionais -----------------------------------------------------------------

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function pascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${dois(mes)}-${dois(dia)}`;
}

const FIXOS: [string, string][] = [
  ["01-01", "Confraternização Universal"],
  ["04-21", "Tiradentes"],
  ["05-01", "Dia do Trabalho"],
  ["09-07", "Independência"],
  ["10-12", "Nossa Senhora Aparecida"],
  ["11-02", "Finados"],
  ["11-15", "Proclamação da República"],
  ["11-20", "Consciência Negra"],
  ["12-25", "Natal"],
];

/** Feriados nacionais fixos e móveis (Carnaval, Sexta-feira Santa e Corpus Christi) de um ano. */
export function feriadosNacionais(ano: number): { data: string; motivo: string }[] {
  const p = pascoa(ano);
  return [
    ...FIXOS.map(([md, motivo]) => ({ data: `${ano}-${md}`, motivo })),
    { data: somarDias(p, -48), motivo: "Carnaval" },
    { data: somarDias(p, -47), motivo: "Carnaval" },
    { data: somarDias(p, -2), motivo: "Sexta-feira Santa" },
    { data: somarDias(p, 60), motivo: "Corpus Christi" },
  ].sort((x, y) => x.data.localeCompare(y.data));
}

// Tribunal ---------------------------------------------------------------------------

// Código TR do número CNJ na Justiça Estadual (segmento 8).
const UF_DO_TR = ["AC", "AL", "AP", "AM", "BA", "CE", "DFT", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SE", "SP", "TO"];

/** "TRT 4ª Região" vira "TRT4"; devolve null se não sobrar uma sigla de 2 a 10 caracteres. */
export function normalizarTribunal(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const sigla = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/REGIAO/g, "")
    .replace(/[^A-Z0-9]/g, "");
  return /^[A-Z0-9]{2,10}$/.test(sigla) ? sigla : null;
}

/**
 * Sigla do tribunal para escolher os feriados: pelo número CNJ (segmento e tribunal) e,
 * sem número, pelo campo tribunal. Sem tribunal, só valem os feriados nacionais e os locais.
 */
export function tribunalDoProcesso(processo: Pick<DetalhesProcesso, "numeroCnj" | "tribunal"> | null | undefined): string | null {
  const numero = processo?.numeroCnj;
  if (numero && /^\d{20}$/.test(numero)) {
    const segmento = numero[13];
    const tr = Number(numero.slice(14, 16));
    if (segmento === "8" && tr >= 1 && tr <= UF_DO_TR.length) return `TJ${UF_DO_TR[tr - 1]}`;
    if (segmento === "5" && tr >= 1) return `TRT${tr}`;
    if (segmento === "4" && tr >= 1) return `TRF${tr}`;
  }
  return normalizarTribunal(processo?.tribunal);
}

// Calendário -------------------------------------------------------------------------

export interface Calendario {
  tribunal: string | null;
  /** Motivo de o dia não ter expediente (fim de semana ou feriado), ou null. */
  semExpediente(data: string): string | null;
  /** Motivo de os prazos estarem suspensos no dia (recesso ou suspensão cadastrada), ou null. */
  suspenso(data: string): string | null;
  /** Motivo de expediente reduzido ou indisponibilidade no dia (CPC, art. 224, § 1º), ou null. */
  reduzido(data: string): string | null;
}

export const FIM_DE_SEMANA = "fim de semana";
export const MOTIVO_RECESSO = "recesso de 20/12 a 20/01";

function noRecesso(data: string): boolean {
  const md = data.slice(5);
  return md >= "12-20" || md <= "01-20";
}

/**
 * Calendário de um tribunal: feriados nacionais, a carga geral do tribunal e os feriados locais
 * do advogado (os que valem para todos os tribunais e os daquele tribunal).
 */
export function criarCalendario(opcoes: { feriados: Feriado[]; tribunal: string | null; suspenderNoRecesso?: boolean }): Calendario {
  const { tribunal, suspenderNoRecesso = false } = opcoes;
  const porTipo = { feriado: new Map<string, string>(), suspensao: new Map<string, string>(), expediente_reduzido: new Map<string, string>() };
  const nacionais = new Map<string, string>();
  const anosNacionais = new Set<number>();

  for (const f of opcoes.feriados) {
    const vale = f.userId === null ? tribunal !== null && f.tribunal === tribunal : f.tribunal === null || f.tribunal === tribunal;
    if (!vale) continue;
    const fim = f.ate ?? f.data;
    for (let d = f.data; d <= fim; d = somarDias(d, 1)) {
      if (!porTipo[f.tipo].has(d)) porTipo[f.tipo].set(d, f.descricao);
    }
  }

  const nacional = (data: string) => {
    const ano = Number(data.slice(0, 4));
    if (!anosNacionais.has(ano)) {
      anosNacionais.add(ano);
      for (const f of feriadosNacionais(ano)) nacionais.set(f.data, f.motivo);
    }
    return nacionais.get(data) ?? null;
  };

  return {
    tribunal,
    semExpediente(data) {
      const semana = diaDaSemanaNumero(data);
      if (semana === 0 || semana === 6) return FIM_DE_SEMANA;
      return nacional(data) ?? porTipo.feriado.get(data) ?? null;
    },
    suspenso(data) {
      if (suspenderNoRecesso && noRecesso(data)) return MOTIVO_RECESSO;
      return porTipo.suspensao.get(data) ?? null;
    },
    reduzido(data) {
      return porTipo.expediente_reduzido.get(data) ?? null;
    },
  };
}

/** Dia que conta no prazo em dias úteis: com expediente e sem suspensão. */
export function ehDiaUtil(calendario: Calendario, data: string): boolean {
  return !calendario.suspenso(data) && !calendario.semExpediente(data);
}

/** Primeiro dia com expediente depois de `data` (a suspensão de prazos não importa aqui). */
export function proximoDiaComExpediente(calendario: Calendario, data: string): string {
  let d = somarDias(data, 1);
  while (calendario.semExpediente(d)) d = somarDias(d, 1);
  return d;
}

// Início da contagem -------------------------------------------------------------------

export interface InicioDaContagem {
  /** Dia do começo: excluído da contagem. */
  comeco: string;
  explicacao: string;
}

/**
 * Dia do começo do prazo, a partir da data informada:
 * - dje: a publicação é o primeiro dia com expediente depois da disponibilização (Lei 11.419, art. 4º, § 3º);
 * - portal: a ciência em dia sem expediente vale no primeiro dia com expediente seguinte (art. 5º, § 2º);
 * - pessoal: a própria data informada.
 * Dias de suspensão (recesso) não adiam a publicação; eles só deixam de contar depois.
 */
export function inicioDaContagem(dados: { inicio: string; meio: MeioIntimacao; calendario: Calendario }): InicioDaContagem {
  const { inicio, meio, calendario } = dados;
  if (meio === "dje") {
    const publicacao = proximoDiaComExpediente(calendario, inicio);
    return { comeco: publicacao, explicacao: `disponibilizado no DJe em ${formatarData(inicio)}, publicado em ${formatarData(publicacao)}` };
  }
  if (meio === "portal") {
    if (!calendario.semExpediente(inicio)) return { comeco: inicio, explicacao: `ciência pelo portal em ${formatarData(inicio)}` };
    const valida = proximoDiaComExpediente(calendario, inicio);
    return { comeco: valida, explicacao: `ciência pelo portal em ${formatarData(inicio)}, dia sem expediente, considerada em ${formatarData(valida)}` };
  }
  return { comeco: inicio, explicacao: `intimação pessoal em ${formatarData(inicio)}` };
}

// Cálculo ------------------------------------------------------------------------------

export interface ResultadoCalculo {
  /** Dia do começo, já com a prorrogação por expediente reduzido. */
  comeco: string;
  vencimento: string;
  /** Dias que entraram na contagem, em ordem. */
  diasConsiderados: string[];
  /** Feriados, suspensões e dias de expediente reduzido que mudaram a contagem (sem fins de semana). */
  diasExcluidos: DiaExcluido[];
  /** O dia do começo caiu em expediente reduzido e passou para outro dia. */
  comecoProrrogado: { de: string; motivo: string } | null;
  /** O último dia caiu em dia sem expediente ou com expediente reduzido e passou para outro dia. */
  vencimentoProrrogado: { de: string; motivo: string } | null;
}

function anotar(lista: DiaExcluido[], data: string, motivo: string) {
  if (motivo === FIM_DE_SEMANA) return;
  const ultimo = lista[lista.length - 1];
  if (ultimo && ultimo.motivo === motivo && somarDias(ultimo.ate ?? ultimo.data, 1) === data) {
    ultimo.ate = data;
    return;
  }
  lista.push({ data, motivo });
}

/**
 * Conta `dias` a partir do dia do começo (excluído). Em dias úteis, só contam os dias com
 * expediente e sem suspensão. Em dias corridos, contam todos menos os suspensos, e o primeiro
 * dia é o primeiro útil depois do começo (Súmula 310 do STF). Nos dois casos, se o começo ou o
 * vencimento cair em expediente reduzido, ou o vencimento em dia sem expediente, o prazo passa
 * para o dia útil seguinte.
 */
export function calcularPrazo(dados: { comeco: string; dias: number; unidade: UnidadePrazo; calendario: Calendario }): ResultadoCalculo {
  const { dias, unidade, calendario } = dados;
  const excluidos: DiaExcluido[] = [];
  const considerados: string[] = [];
  const motivoNaoUtil = (d: string) => calendario.suspenso(d) ?? calendario.semExpediente(d);

  let comeco = dados.comeco;
  let comecoProrrogado: ResultadoCalculo["comecoProrrogado"] = null;
  const reduzidoNoComeco = calendario.reduzido(comeco);
  if (reduzidoNoComeco) {
    comecoProrrogado = { de: comeco, motivo: reduzidoNoComeco };
    anotar(excluidos, comeco, `expediente reduzido no dia do começo: ${reduzidoNoComeco}`);
    do comeco = somarDias(comeco, 1);
    while (calendario.semExpediente(comeco) || calendario.reduzido(comeco));
  }

  let d = comeco;
  if (unidade === "uteis") {
    while (considerados.length < dias) {
      d = somarDias(d, 1);
      const motivo = motivoNaoUtil(d);
      if (motivo) anotar(excluidos, d, motivo);
      else considerados.push(d);
    }
  } else {
    // Primeiro dia: o primeiro útil depois do começo.
    for (;;) {
      d = somarDias(d, 1);
      const motivo = motivoNaoUtil(d);
      if (!motivo) break;
      anotar(excluidos, d, motivo);
    }
    considerados.push(d);
    while (considerados.length < dias) {
      d = somarDias(d, 1);
      const suspensao = calendario.suspenso(d);
      if (suspensao) anotar(excluidos, d, suspensao);
      else considerados.push(d);
    }
  }

  let vencimentoProrrogado: ResultadoCalculo["vencimentoProrrogado"] = null;
  for (;;) {
    const motivo = motivoNaoUtil(d) ?? (calendario.reduzido(d) ? `expediente reduzido: ${calendario.reduzido(d)}` : null);
    if (!motivo) break;
    vencimentoProrrogado ??= { de: d, motivo };
    anotar(excluidos, d, motivo);
    d = somarDias(d, 1);
  }

  return { comeco, vencimento: d, diasConsiderados: considerados, diasExcluidos: excluidos, comecoProrrogado, vencimentoProrrogado };
}

export interface DadosPrazo {
  /** Data da disponibilização (DJe), da ciência (portal) ou da intimação pessoal. */
  inicio: string;
  meio: MeioIntimacao;
  dias: number;
  regra: RegraPrazo;
  emDobro?: boolean;
  /** Sem valor, segue a regra. Desligar no penal = exceções do art. 798-A (réu preso, Maria da Penha, urgência). */
  suspenderNoRecesso?: boolean;
}

export interface PrazoCalculado extends ResultadoCalculo {
  unidade: UnidadePrazo;
  suspenderNoRecesso: boolean;
  diasContados: number;
  tribunal: string | null;
  memoria: string;
}

function descreverExcluido(e: DiaExcluido): string {
  return e.ate ? `${formatarDataCurta(e.data)} a ${formatarDataCurta(e.ate)} (${e.motivo})` : `${formatarDataCurta(e.data)} (${e.motivo})`;
}

/** Prazo a partir da intimação, com a memória do cálculo para mostrar ao advogado. */
export function calcularPrazoDaIntimacao(dados: DadosPrazo, feriados: Feriado[], tribunal: string | null): PrazoCalculado {
  const regra = REGRAS[dados.regra];
  const suspenderNoRecesso = dados.suspenderNoRecesso ?? regra.suspenderNoRecesso;
  const calendario = criarCalendario({ feriados, tribunal, suspenderNoRecesso });
  const diasContados = dados.emDobro ? dados.dias * 2 : dados.dias;
  const inicio = inicioDaContagem({ inicio: dados.inicio, meio: dados.meio, calendario });
  const calculo = calcularPrazo({ comeco: inicio.comeco, dias: diasContados, unidade: regra.unidade, calendario });

  const unidade = regra.unidade === "uteis" ? "úteis" : "corridos";
  const partes: string[] = [];
  partes.push(
    dados.emDobro
      ? `${dados.dias} dias ${unidade} em dobro (${diasContados} dias), ${regra.rotulo}.`
      : `${dados.dias} dias ${unidade}, ${regra.rotulo}.`,
  );
  partes.push(`${inicio.explicacao[0].toUpperCase()}${inicio.explicacao.slice(1)}.`);
  if (calculo.comecoProrrogado) partes.push(`Expediente reduzido em ${formatarDataCurta(calculo.comecoProrrogado.de)}: o começo passou para ${formatarDataCurta(calculo.comeco)}.`);
  partes.push(`A contagem começa em ${formatarData(calculo.diasConsiderados[0])}.`);
  const semProrrogacao = calculo.vencimentoProrrogado
    ? calculo.diasExcluidos.filter((e) => e.data < calculo.vencimentoProrrogado!.de)
    : calculo.diasExcluidos;
  const foraDaContagem = semProrrogacao.filter((e) => !calculo.comecoProrrogado || e.data !== calculo.comecoProrrogado.de);
  if (foraDaContagem.length) {
    const fds = regra.unidade === "uteis" ? ", além dos fins de semana" : "";
    partes.push(`Fora da contagem${fds}: ${foraDaContagem.map(descreverExcluido).join(", ")}.`);
  }
  if (calculo.vencimentoProrrogado) {
    const { de, motivo } = calculo.vencimentoProrrogado;
    partes.push(`O último dia caiu em ${formatarDataCurta(de)} (${motivo}) e passou para o dia útil seguinte.`);
  }
  if (!tribunal) partes.push("Tribunal não identificado: só entram os feriados nacionais e os seus feriados locais.");
  if (!suspenderNoRecesso && regra.suspenderNoRecesso) partes.push("Sem a suspensão do recesso, por exceção marcada.");
  partes.push(`Vence em ${formatarData(calculo.vencimento)}.`);

  return { ...calculo, unidade: regra.unidade, suspenderNoRecesso, diasContados, tribunal, memoria: partes.join(" ") };
}

// Prazo interno e lembretes ------------------------------------------------------------

/**
 * Prazo interno: `margem` dias com expediente antes do vencimento. Suspensões (recesso) não
 * empurram o prazo interno para trás, porque o advogado pode trabalhar nelas.
 */
export function prazoInterno(vencimento: string, margem: number, calendario: Calendario): string {
  let d = vencimento;
  let n = 0;
  while (n < margem) {
    d = somarDias(d, -1);
    if (!calendario.semExpediente(d)) n++;
  }
  return d;
}

/** Datas dos lembretes automáticos: D-3 e D-1 em dias com expediente, e o próprio dia. */
export function datasDosLembretes(base: string, calendario: Calendario): Record<LembreteAutomatico, string> {
  return { "d-3": prazoInterno(base, 3, calendario), "d-1": prazoInterno(base, 1, calendario), dia: base };
}

// Validação ---------------------------------------------------------------------------

export function validarDadosPrazo(dados: DadosPrazo & { margem?: number }): { ok: true } | { ok: false; erro: string } {
  if (!dataValida(dados.inicio)) return { ok: false, erro: "Informe a data da intimação." };
  if (!Number.isInteger(dados.dias) || dados.dias < 1 || dados.dias > DIAS_MAXIMOS) return { ok: false, erro: `O prazo deve ter de 1 a ${DIAS_MAXIMOS} dias.` };
  if (!(dados.regra in REGRAS)) return { ok: false, erro: "Regra de contagem inválida." };
  if (!(dados.meio in ROTULO_MEIO)) return { ok: false, erro: "Meio da intimação inválido." };
  if (dados.margem !== undefined && (!Number.isInteger(dados.margem) || dados.margem < 0 || dados.margem > MARGEM_MAXIMA)) {
    return { ok: false, erro: `A margem deve ficar entre 0 e ${MARGEM_MAXIMA} dias úteis.` };
  }
  return { ok: true };
}

// Tipo da tarefa ------------------------------------------------------------------------

type CamposDoTipo = Pick<Tarefa, "tipo" | "prazoFatal" | "contagem" | "localAudiencia" | "horarioAudiencia">;

export const ROTULO_TIPO: Record<TipoTarefa, string> = { prazo: "Prazo", providencia: "Providência", audiencia: "Audiência" };

/**
 * Completa uma alteração para os campos ficarem coerentes com o tipo final: prazo fatal e
 * contagem só no prazo; local e horário só na audiência. Vai na mesma gravação da troca de tipo.
 */
export function ajustarAlteracaoAoTipo(tarefa: CamposDoTipo, alteracao: AlteracaoTarefa): AlteracaoTarefa {
  const final = { ...tarefa, ...alteracao };
  const ajuste: AlteracaoTarefa = {};
  if (final.tipo !== "prazo") {
    if (final.prazoFatal !== null) ajuste.prazoFatal = null;
    if (final.contagem !== null) ajuste.contagem = null;
  }
  if (final.tipo !== "audiencia") {
    if (final.localAudiencia !== null) ajuste.localAudiencia = null;
    if (final.horarioAudiencia !== null) ajuste.horarioAudiencia = null;
  }
  return { ...alteracao, ...ajuste };
}

/** Alteração que transforma a tarefa num prazo com a contagem calculada. */
export function alteracaoDePrazo(contagem: ContagemPrazo, prazoInterno: string): AlteracaoTarefa {
  return { tipo: "prazo", prazoFatal: contagem.vencimento, contagem, dueOn: prazoInterno <= contagem.vencimento ? prazoInterno : contagem.vencimento };
}

/** Contagem para gravar na tarefa e o prazo interno sugerido pela margem. */
export function montarContagem(
  dados: DadosPrazo & { margem: number },
  feriados: Feriado[],
  tribunal: string | null,
): { contagem: ContagemPrazo; prazoInterno: string } {
  const calculo = calcularPrazoDaIntimacao(dados, feriados, tribunal);
  const interno = prazoInterno(calculo.vencimento, dados.margem, criarCalendario({ feriados, tribunal }));
  return {
    prazoInterno: interno,
    contagem: {
      inicio: dados.inicio,
      meio: dados.meio,
      dias: dados.dias,
      regra: dados.regra,
      unidade: calculo.unidade,
      emDobro: Boolean(dados.emDobro),
      suspenderNoRecesso: calculo.suspenderNoRecesso,
      tribunal,
      margem: dados.margem,
      comeco: calculo.comeco,
      vencimento: calculo.vencimento,
      excluidos: calculo.diasExcluidos,
      memoria: calculo.memoria,
    },
  };
}

// Lembretes automáticos -------------------------------------------------------------------

export const HORA_DOS_LEMBRETES = "09:00";
/** No dia da audiência, o lembrete sai esta quantidade de horas antes. */
export const HORAS_ANTES_DA_AUDIENCIA = 2;

export interface LembreteDesejado {
  automatico: LembreteAutomatico;
  quando: string;
  texto: string;
}

function encurtar(texto: string, limite: number): string {
  return texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto;
}

/**
 * Lembretes que a tarefa deve ter agora: D-3, D-1 (dias com expediente) e no dia, contados do
 * prazo fatal ou da data da audiência, às 09:00 no fuso (na audiência, o do dia sai 2 h antes).
 * Tarefa concluída, providência ou sem data: nenhum. Horários que já passaram ficam de fora.
 */
export function lembretesDesejados(
  tarefa: Pick<Tarefa, "title" | "tipo" | "prazoFatal" | "horarioAudiencia" | "localAudiencia" | "completed">,
  calendario: Calendario,
  fuso: string,
  agora = new Date(),
): LembreteDesejado[] {
  if (tarefa.completed) return [];
  const titulo = encurtar(tarefa.title, 300);
  const as9 = (data: string) => interpretarDataHora(`${data}T${HORA_DOS_LEMBRETES}`, fuso)!.toISOString();
  let lista: LembreteDesejado[] = [];

  if (tarefa.tipo === "prazo" && tarefa.prazoFatal) {
    const datas = datasDosLembretes(tarefa.prazoFatal, calendario);
    const vence = formatarDataCurta(tarefa.prazoFatal);
    lista = [
      { automatico: "d-3", quando: as9(datas["d-3"]), texto: `Prazo fatal em ${vence}: ${titulo}` },
      { automatico: "d-1", quando: as9(datas["d-1"]), texto: `Prazo fatal em ${vence}: ${titulo}` },
      { automatico: "dia", quando: as9(datas.dia), texto: `Prazo fatal hoje: ${titulo}` },
    ];
  }

  if (tarefa.tipo === "audiencia" && tarefa.horarioAudiencia) {
    const instante = new Date(tarefa.horarioAudiencia);
    const dia = dataNoFuso(instante, fuso);
    const datas = datasDosLembretes(dia, calendario);
    const p = partesNoFuso(instante, fuso);
    const hora = `${String(p.hora).padStart(2, "0")}:${String(p.minuto).padStart(2, "0")}`;
    const onde = tarefa.localAudiencia ? ` (${encurtar(tarefa.localAudiencia, 120)})` : "";
    lista = [
      { automatico: "d-3", quando: as9(datas["d-3"]), texto: `Audiência em ${formatarDataCurta(dia)} às ${hora}: ${titulo}${onde}` },
      { automatico: "d-1", quando: as9(datas["d-1"]), texto: `Audiência em ${formatarDataCurta(dia)} às ${hora}: ${titulo}${onde}` },
      {
        automatico: "dia",
        quando: new Date(instante.getTime() - HORAS_ANTES_DA_AUDIENCIA * 3_600_000).toISOString(),
        texto: `Audiência hoje às ${hora}: ${titulo}${onde}`,
      },
    ];
  }

  return lista.filter((l) => new Date(l.quando).getTime() > agora.getTime());
}
