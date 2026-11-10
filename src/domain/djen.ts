// Captura de comunicações do DJEN (etapa 5): regras puras, sem rede e sem banco.
// A consulta roda na VPS do agente (services/consulta-djen.ts); o app decide aqui
// a janela, o sigilo, a extração dos dias e o que é guardado de cada comunicação.
//
// Este arquivo não importa nada: a VPS o carrega direto pelo Node (scripts/captura-djen.ts),
// sem bundler e sem o alias "@/".
//
// Princípio da extração: na dúvida, não chuta. Qualquer ambiguidade vira
// "nao_identificados", e o advogado informa os dias.

// Tipos ----------------------------------------------------------------------------------

/** O que a VPS repassa de cada comunicação: sem partes, sem advogados, com o teor ainda em HTML. */
export interface ComunicacaoRecebida {
  djenId: number;
  hash: string | null;
  numeroProcesso: string;
  dataDisponibilizacao: string;
  tribunal: string | null;
  orgao: string | null;
  classe: string | null;
  tipoComunicacao: string | null;
  tipoDocumento: string | null;
  link: string | null;
  /** Algum destinatário veio como "SIGILO". */
  destinatarioSigilo: boolean;
  /** Falso quando o tribunal cancelou a comunicação. */
  ativa: boolean;
  texto: string;
  /** A VPS cortou um teor longo demais: a extração não é segura. */
  textoTruncado: boolean;
}

export type StatusSugestaoDjen = "pendente" | "registrada" | "descartada" | "cancelada";
export type SituacaoDias = "identificados" | "nao_identificados";

/** Uma linha nova de comunicacoes_djen (o resumo do teor é calculado no serviço). */
export interface NovaSugestaoDjen {
  djenId: number;
  hash: string | null;
  numeroProcesso: string;
  dataDisponibilizacao: string;
  sigiloso: boolean;
  tribunal: string | null;
  orgao: string | null;
  classe: string | null;
  tipoComunicacao: string | null;
  tipoDocumento: string | null;
  link: string | null;
  trecho: string | null;
  diasSituacao: SituacaoDias | null;
  dias: number | null;
  unidadeDias: "uteis" | "corridos" | null;
  trechoDias: string | null;
  resumoTeor: string | null;
}

export interface SugestaoDjen extends NovaSugestaoDjen {
  id: string;
  status: StatusSugestaoDjen;
  canceladaNoDjenEm: string | null;
  criadoEm: string;
}

export type ResultadoConsulta = "ok" | "falhou" | "limite" | "em_andamento";

export interface CapturaDjen {
  ligada: boolean;
  numeroOab: string | null;
  ufOab: string | null;
  avisoAceitoEm: string | null;
  /** Fim da janela da última consulta que terminou bem (AAAA-MM-DD). */
  ultimaConsultaOk: string | null;
  ultimaTentativaEm: string | null;
  /** Tentativas no dia de ultimaTentativaEm. */
  tentativasNoDia: number;
  ultimoResultado: ResultadoConsulta | null;
}

export const CAPTURA_DESLIGADA: CapturaDjen = {
  ligada: false,
  numeroOab: null,
  ufOab: null,
  avisoAceitoEm: null,
  ultimaConsultaOk: null,
  ultimaTentativaEm: null,
  tentativasNoDia: 0,
  ultimoResultado: null,
};

export interface JanelaConsulta {
  inicio: string;
  fim: string;
}

// Regras de uso --------------------------------------------------------------------------

/** Na primeira consulta, só os últimos 15 dias. */
export const DIAS_DA_PRIMEIRA_CONSULTA = 15;
/** A janela recomeça 2 dias antes da última consulta boa. */
export const DIAS_DE_SOBREPOSICAO = 2;
/** Nunca mais de 30 dias para trás: é a retenção das sugestões não registradas. */
export const DIAS_MAXIMOS_DA_JANELA = 30;
/** 7h, e, se falhar, 12h e 17h. */
export const TENTATIVAS_POR_DIA = 3;
/** Entre uma tentativa e a próxima no mesmo dia. */
export const HORAS_ENTRE_TENTATIVAS = 4;

/** Por chamada de POST /api/djen/comunicacoes (limite de corpo da Vercel). */
export const ITENS_POR_ENVIO = 20;

export type MotivoSemConsulta = "desligada" | "feita_hoje" | "tentativas_esgotadas" | "cedo_demais";

export type PlanoConsulta = { consultar: true; janela: JanelaConsulta; tentativa: number } | { consultar: false; motivo: MotivoSemConsulta };

const DIA_MS = 86_400_000;

/** Soma dias a uma data AAAA-MM-DD. */
export function somarDiasCorridos(data: string, dias: number): string {
  return new Date(Date.parse(`${data}T00:00:00Z`) + dias * DIA_MS).toISOString().slice(0, 10);
}

export function janelaDaConsulta(ultimaConsultaOk: string | null, hoje: string): JanelaConsulta {
  const limite = somarDiasCorridos(hoje, -DIAS_MAXIMOS_DA_JANELA);
  const desejado = ultimaConsultaOk ? somarDiasCorridos(ultimaConsultaOk, -DIAS_DE_SOBREPOSICAO) : somarDiasCorridos(hoje, -DIAS_DA_PRIMEIRA_CONSULTA);
  const inicio = desejado < limite ? limite : desejado > hoje ? hoje : desejado;
  return { inicio, fim: hoje };
}

/**
 * Se a captura deve consultar o DJEN agora.
 * Uma consulta boa por dia. Se a tentativa falhar, há mais duas no mesmo dia, com
 * pelo menos HORAS_ENTRE_TENTATIVAS de intervalo.
 * `dataDaUltimaTentativa` é a data de ultimaTentativaEm no fuso do Tempestivo.
 */
export function planoDaConsulta(captura: CapturaDjen, hoje: string, agora: Date, dataDaUltimaTentativa: string | null): PlanoConsulta {
  if (!captura.ligada || !captura.numeroOab || !captura.ufOab) return { consultar: false, motivo: "desligada" };
  if (captura.ultimaConsultaOk && captura.ultimaConsultaOk >= hoje) return { consultar: false, motivo: "feita_hoje" };
  const tentativasHoje = dataDaUltimaTentativa === hoje ? captura.tentativasNoDia : 0;
  if (tentativasHoje >= TENTATIVAS_POR_DIA) return { consultar: false, motivo: "tentativas_esgotadas" };
  if (tentativasHoje > 0 && captura.ultimaTentativaEm) {
    const passou = agora.getTime() - new Date(captura.ultimaTentativaEm).getTime();
    if (passou < HORAS_ENTRE_TENTATIVAS * 3_600_000) return { consultar: false, motivo: "cedo_demais" };
  }
  return { consultar: true, janela: janelaDaConsulta(captura.ultimaConsultaOk, hoje), tentativa: tentativasHoje + 1 };
}

// OAB ------------------------------------------------------------------------------------

export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;

/** Número só com dígitos e sem zeros à esquerda (o DJEN dá o mesmo resultado com ou sem eles). */
export function normalizarNumeroOab(numero: string): string {
  return numero.replace(/\D/g, "").replace(/^0+/, "");
}

export function validarOab(numero: string, uf: string): { ok: true; numero: string; uf: string } | { ok: false; erro: string } {
  if (/[^\d\s.\-]/.test(numero.trim())) return { ok: false, erro: "O número da OAB tem só algarismos. Ex.: 12345." };
  const n = normalizarNumeroOab(numero);
  if (!n || n.length > 7) return { ok: false, erro: "Número da OAB inválido. Ex.: 12345." };
  const u = uf.trim().toUpperCase();
  if (!(UFS as readonly string[]).includes(u)) return { ok: false, erro: "UF da OAB inválida. Ex.: RS." };
  return { ok: true, numero: n, uf: u };
}

// Teor: HTML para texto ------------------------------------------------------------------

const ACENTOS: Record<string, string> = { acute: "́", grave: "̀", circ: "̂", tilde: "̃", uml: "̈" };
const ENTIDADES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ordm: "º", ordf: "ª", sect: "§", deg: "°", para: "¶",
  ndash: "–", mdash: "—", hellip: "…", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", laquo: "«", raquo: "»", bull: "•",
  middot: "·", acute: "´", ccedil: "ç", Ccedil: "Ç", szlig: "ß", euro: "€", copy: "©", reg: "®", shy: "",
};
for (const letra of "aeiouAEIOUnNyY") {
  for (const [nome, marca] of Object.entries(ACENTOS)) ENTIDADES[`${letra}${nome}`] ??= `${letra}${marca}`.normalize("NFC");
}

function decodificarEntidades(texto: string): string {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (original, nome: string) => {
    if (nome[0] === "#") {
      const codigo = nome[1].toLowerCase() === "x" ? parseInt(nome.slice(2), 16) : parseInt(nome.slice(1), 10);
      return codigo > 0 && codigo < 0x110000 ? String.fromCodePoint(codigo) : original;
    }
    return ENTIDADES[nome] ?? original;
  });
}

/** Tabelas com a lista de partes e advogados (o cabeçalho das intimações). */
const TABELA_DE_PARTES = /<table[\s\S]*?<\/table>/gi;
const EH_DE_PARTES = /ADVOGAD|\(OAB|OAB\s+[A-Z]{2}\d/i;

/**
 * Teor em texto simples, só o corpo: sem cabeçalho (classe, número, partes e advogados),
 * com as entidades resolvidas e um bloco (parágrafo) por linha.
 */
export function normalizarTeor(html: string): string {
  let t = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(head|style|script|header)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<div\s+id="divHeader"[\s\S]*?<\/div>/gi, " ")
    .replace(TABELA_DE_PARTES, (tabela) => (EH_DE_PARTES.test(tabela) ? " " : tabela))
    // Título com classe e número ("CUMPRIMENTO DE SENTENÇA Nº 5000000-00.2026.8.21.0001/RS").
    .replace(/<b>(?:(?!<\/b>)[\s\S])*?N(?:º|&ordm;|°|o\.?)\s*[\d.\-]{7,}(?:(?!<\/b>)[\s\S])*?<\/b>/gi, " ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|tr|h\d|center|table)>/gi, "\n")
    .replace(/<[^>]*>/g, " ");
  t = decodificarEntidades(t);
  return t
    .split("\n")
    .map((linha) => linha.replace(/[\s ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

const TEXTO_DE_SIGILO = /^processo sigiloso\.?\s*para visualiza[cç][aã]o do documento,? consulte os autos digitais\.?$/i;

/** Destinatário "SIGILO" ou o texto padrão de processo sigiloso. */
export function ehSigiloso(item: Pick<ComunicacaoRecebida, "destinatarioSigilo" | "texto">): boolean {
  if (item.destinatarioSigilo) return true;
  return TEXTO_DE_SIGILO.test(normalizarTeor(item.texto).replace(/\n/g, " "));
}

// Extração dos dias ----------------------------------------------------------------------

const UNIDADES: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
};
const DE_DEZ_A_DEZENOVE: Record<string, number> = {
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
};
const DEZENAS: Record<string, number> = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 };

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "quinze" → 15, "vinte e cinco" → 25, "cento e vinte" → 120. De um a noventa e nove, cem e cento e vinte. */
export function numeroPorExtenso(texto: string): number | null {
  const s = semAcento(texto).replace(/\s+/g, " ").trim();
  if (s === "cem") return 100;
  if (s === "cento e vinte") return 120;
  if (s in UNIDADES) return UNIDADES[s];
  if (s in DE_DEZ_A_DEZENOVE) return DE_DEZ_A_DEZENOVE[s];
  if (s in DEZENAS) return DEZENAS[s];
  const m = s.match(/^(\p{L}+) e (\p{L}+)$/u);
  if (m && m[1] in DEZENAS && m[2] in UNIDADES) return DEZENAS[m[1]] + UNIDADES[m[2]];
  return null;
}

const UNIDADE_EXT = "um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove";
const EXTENSO = `cento\\s+e\\s+vinte|cem|(?:vinte|trinta|quarenta|cinq[uü]enta|sessenta|setenta|oitenta|noventa)(?:\\s+e\\s+(?:${UNIDADE_EXT}))?|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|${UNIDADE_EXT}`;
const NUMERO = `(\\d{1,3}|${EXTENSO})`;
const ANTES = "(?<![\\p{L}\\d.,:/])";

/** "15 (quinze) dias úteis", "quinze dias", "05 dias corridos". */
const OCORRENCIA_DE_DIAS = new RegExp(`${ANTES}${NUMERO}\\s*(?:\\(\\s*([\\p{L}\\s]+?)\\s*\\)\\s*)?dias?(?![\\p{L}])(?:\\s+(úteis|uteis|corridos))?`, "giu");
/** Prazo em horas ou em meses: a função não trata. "às 17:30 horas" não conta (o número vem depois de ":"). */
const PRAZO_EM_HORAS_OU_MESES = new RegExp(`${ANTES}${NUMERO}\\s*(?:\\([^)]*\\)\\s*)?(horas?|m[eê]s|meses)(?![\\p{L}])`, "iu");

/** Sinais de que o prazo não é simples. Basta um para não haver segurança. */
const SINAIS_DE_CUIDADO: [RegExp, string][] = [
  [/em\s+dobro/i, "em dobro"],
  [/sucessiv/i, "prazo sucessivo"],
  [/prazo\s+(?:legal|recursal|regimental|da\s+lei|de\s+lei|previsto\s+em\s+lei|assinalado|fixado\s+em\s+lei)/i, "prazo legal sem número"],
];

/** O número precisa vir logo depois de "prazo de", "no prazo de", "em" ou "dentro de". */
const LIGACAO_COM_PRAZO = /(?:prazo(?:\s+(?:comum|improrrog[aá]vel|impreter[ií]vel|m[aá]ximo|adicional|suplementar))?\s+de|\bem|dentro\s+de)\s+$/i;
/** A frase fala com uma parte ou com quem foi intimado. */
const FALA_COM_PARTE =
  /intim|\bpartes?\b|\bautor(?:a|es|as)?\b|\br[ée]u\b|\bré\b|\brés\b|requerente|requerid|exequente|executad|embargante|embargad|apelante|apelad|agravante|agravad|recorrente|recorrid|reclamante|reclamad|impetrante|\bcredor|\bdevedor|procurador|defesa|acusad|denunciad|querelante|querelad/i;
/** Prazo de terceiro (perito, oficial, cartório...): não é do advogado. */
const PRAZO_DE_TERCEIRO =
  /perit|oficial\s+de\s+justi|cart[oó]rio|secretaria|contador|contadoria|leiloeir|deposit[aá]ri|administrador\s+judicial|minist[ée]rio\s+p[uú]blico|\bMP\b|escriv|serventi|CCALC|tabeli/i;
/** Prazo que já passou ou que só é narrado. */
const PRAZO_PASSADO = /decorrid|transcorrid|escoad|esgotad|expirad|encerrad|\bfind[oa]\b|\bvencid[oa]\b|\bfoi\s+(?:intimad|concedid|fixad|aberto)|\bforam\s+(?:intimad|concedid)/i;

const ABREVIACOES = /(?:\bart|\barts|\bn|\bnº|\bfls?|\binc|\bal|\bp|\bpág|\bdr|\bdra|\bsr|\bsra|\bexmo|\bexma|\bproc|\bc|\bcf|\bvol)\.$/i;

/** Frases do corpo, com a posição de cada uma no texto. */
function frases(texto: string): { inicio: number; fim: number }[] {
  const lista: { inicio: number; fim: number }[] = [];
  let inicio = 0;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    const fimDeLinha = c === "\n";
    const pontuacao = (c === "." || c === ";" || c === "!" || c === "?") && (i + 1 >= texto.length || /\s/.test(texto[i + 1]));
    if (!fimDeLinha && !pontuacao) continue;
    if (pontuacao && c === "." && ABREVIACOES.test(texto.slice(Math.max(inicio, i - 8), i + 1))) continue;
    lista.push({ inicio, fim: fimDeLinha ? i : i + 1 });
    inicio = i + 1;
  }
  if (inicio < texto.length) lista.push({ inicio, fim: texto.length });
  return lista
    .map((f) => {
      let { inicio: a, fim: b } = f;
      while (a < b && /\s/.test(texto[a])) a++;
      while (b > a && /\s/.test(texto[b - 1])) b--;
      return { inicio: a, fim: b };
    })
    .filter((f) => f.fim > f.inicio);
}

/**
 * Corta o texto em até `maximo` caracteres em volta de [inicio, fim), sem quebrar a
 * marcação e com "…" onde cortou.
 */
export function recortar(texto: string, inicio: number, fim: number, maximo: number): string {
  if (texto.length <= maximo) return texto;
  const util = maximo - 2; // espaço para as duas reticências
  const tamanho = Math.max(0, Math.min(fim - inicio, util));
  let a = Math.max(0, inicio - Math.floor((util - tamanho) / 2));
  let b = a + util;
  if (b > texto.length) {
    b = texto.length;
    a = Math.max(0, b - util);
  }
  return `${a > 0 ? "…" : ""}${texto.slice(a, b).trim()}${b < texto.length ? "…" : ""}`;
}

export const MAXIMO_TRECHO_DIAS = 200;
export const MAXIMO_TRECHO = 600;

export type MotivoSemDias = "sem_prazo" | "varios_prazos" | "extenso_diferente" | "sinal_de_cuidado" | "sem_ligacao" | "fora_do_limite" | "texto_incompleto";

export type ResultadoDias =
  | { situacao: "identificados"; dias: number; unidade: "uteis" | "corridos" | null; trecho: string; posicao: { inicio: number; fim: number } }
  | { situacao: "nao_identificados"; motivo: MotivoSemDias; detalhe?: string; trechos: string[]; posicao: { inicio: number; fim: number } | null };

/**
 * Quantos dias de prazo o corpo da comunicação dá, com o trecho de onde saiu o número.
 * Só responde "identificados" quando há exatamente uma menção a dias, ligada a "prazo de"
 * ou "em", numa frase que fala com a parte, sem prazo de terceiro, sem prazo passado e sem
 * nenhum sinal de cuidado (dobro, sucessivo, prazo legal, horas, meses). O resto vai para
 * o advogado.
 *
 * `corpo` é o texto já normalizado (normalizarTeor).
 */
export function extrairDiasDoPrazo(corpo: string): ResultadoDias {
  const ocorrencias = [...corpo.matchAll(OCORRENCIA_DE_DIAS)];
  const listaDeFrases = frases(corpo);
  const fraseDe = (pos: number) => listaDeFrases.find((f) => pos >= f.inicio && pos < f.fim) ?? { inicio: pos, fim: pos };
  const trechoDe = (inicio: number, fim: number) => {
    const f = fraseDe(inicio);
    const frase = corpo.slice(f.inicio, Math.max(f.fim, fim));
    return recortar(frase, inicio - f.inicio, fim - f.inicio, MAXIMO_TRECHO_DIAS);
  };
  const posicaoDe = (m: RegExpMatchArray) => ({ inicio: m.index!, fim: m.index! + m[0].length });
  const semDias = (motivo: MotivoSemDias, detalhe?: string): ResultadoDias => ({
    situacao: "nao_identificados",
    motivo,
    detalhe,
    trechos: ocorrencias.slice(0, 3).map((m) => trechoDe(m.index!, m.index! + m[0].length)),
    posicao: ocorrencias[0] ? posicaoDe(ocorrencias[0]) : null,
  });

  for (const [sinal, nome] of SINAIS_DE_CUIDADO) if (sinal.test(corpo)) return semDias("sinal_de_cuidado", nome);
  const outraUnidade = corpo.match(PRAZO_EM_HORAS_OU_MESES);
  if (outraUnidade) return semDias("sinal_de_cuidado", /hora/i.test(outraUnidade[2]) ? "prazo em horas" : "prazo em meses");

  if (ocorrencias.length === 0) return semDias("sem_prazo");
  if (ocorrencias.length > 1) return semDias("varios_prazos");

  const m = ocorrencias[0];
  const [, numeroTexto, extensoEntreParenteses, unidadeTexto] = m;
  const dias = /^\d+$/.test(numeroTexto) ? parseInt(numeroTexto, 10) : numeroPorExtenso(numeroTexto);
  if (dias === null) return semDias("extenso_diferente");
  if (extensoEntreParenteses !== undefined && numeroPorExtenso(extensoEntreParenteses) !== dias) return semDias("extenso_diferente");
  if (dias < 1 || dias > 365) return semDias("fora_do_limite");

  const f = fraseDe(m.index!);
  if (!LIGACAO_COM_PRAZO.test(corpo.slice(f.inicio, m.index!))) return semDias("sem_ligacao");
  const frase = corpo.slice(f.inicio, f.fim);
  if (PRAZO_PASSADO.test(frase)) return semDias("sem_ligacao", "prazo passado ou narrado");
  if (PRAZO_DE_TERCEIRO.test(frase)) return semDias("sem_ligacao", "prazo de terceiro");
  if (!FALA_COM_PARTE.test(frase)) return semDias("sem_ligacao", "a frase não fala com a parte");

  const unidade = unidadeTexto ? (/corridos/i.test(unidadeTexto) ? "corridos" : "uteis") : null;
  return { situacao: "identificados", dias, unidade, trecho: trechoDe(m.index!, m.index! + m[0].length), posicao: posicaoDe(m) };
}

// O que é guardado -----------------------------------------------------------------------

const LIMITES = { hash: 100, tribunal: 20, orgao: 300, classe: 200, tipoComunicacao: 100, tipoDocumento: 100, link: 1000 } as const;

function textoCurto(valor: string | null | undefined, maximo: number): string | null {
  const v = valor?.replace(/\s+/g, " ").trim();
  return v ? v.slice(0, maximo) : null;
}

function linkSeguro(link: string | null): string | null {
  const l = link?.trim();
  if (!l || l.length > LIMITES.link || !/^https:\/\/[^\s"'<>]+$/i.test(l)) return null;
  return l;
}

export function dataIsoValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  return new Date(`${data}T00:00:00Z`).toISOString().slice(0, 10) === data;
}

export type SugestaoMontada = { ok: true; sugestao: Omit<NovaSugestaoDjen, "resumoTeor">; corpo: string | null } | { ok: false; erro: string };

/**
 * Transforma a comunicação recebida na linha guardada, com o mínimo:
 * - processo sigiloso: só o id, o número e a data;
 * - os outros: metadados, o trecho do teor (até 600 caracteres em volta do prazo, ou o
 *   começo do corpo) e a extração dos dias. O teor inteiro é descartado.
 * `corpo` volta para o serviço calcular o resumo do teor e depois ser descartado.
 */
export function montarSugestao(item: ComunicacaoRecebida): SugestaoMontada {
  if (!Number.isSafeInteger(item.djenId) || item.djenId <= 0) return { ok: false, erro: "id do DJEN inválido" };
  const numeroProcesso = item.numeroProcesso.replace(/\D/g, "");
  if (numeroProcesso.length !== 20) return { ok: false, erro: "número do processo inválido" };
  if (!dataIsoValida(item.dataDisponibilizacao)) return { ok: false, erro: "data de disponibilização inválida" };

  const base = { djenId: item.djenId, numeroProcesso, dataDisponibilizacao: item.dataDisponibilizacao };
  if (ehSigiloso(item)) {
    return {
      ok: true,
      corpo: null,
      sugestao: {
        ...base, sigiloso: true, hash: null, tribunal: null, orgao: null, classe: null, tipoComunicacao: null, tipoDocumento: null,
        link: null, trecho: null, diasSituacao: null, dias: null, unidadeDias: null, trechoDias: null,
      },
    };
  }

  const corpo = normalizarTeor(item.texto);
  const extracao: ResultadoDias = item.textoTruncado
    ? { situacao: "nao_identificados", motivo: "texto_incompleto", trechos: [], posicao: null }
    : extrairDiasDoPrazo(corpo);
  const posicao = extracao.posicao ?? { inicio: 0, fim: 0 };
  const trecho = corpo ? recortar(corpo, posicao.inicio, posicao.fim, MAXIMO_TRECHO) : null;

  return {
    ok: true,
    corpo,
    sugestao: {
      ...base,
      sigiloso: false,
      hash: textoCurto(item.hash, LIMITES.hash),
      tribunal: textoCurto(item.tribunal, LIMITES.tribunal),
      orgao: textoCurto(item.orgao, LIMITES.orgao),
      classe: textoCurto(item.classe, LIMITES.classe),
      tipoComunicacao: textoCurto(item.tipoComunicacao, LIMITES.tipoComunicacao),
      tipoDocumento: textoCurto(item.tipoDocumento, LIMITES.tipoDocumento),
      link: linkSeguro(item.link),
      trecho,
      diasSituacao: extracao.situacao,
      dias: extracao.situacao === "identificados" ? extracao.dias : null,
      unidadeDias: extracao.situacao === "identificados" ? extracao.unidade : null,
      trechoDias: extracao.situacao === "identificados" ? extracao.trecho : null,
    },
  };
}
