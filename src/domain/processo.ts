import type { ModeloQuadro } from "./quadro";
import type { AreaProcesso, DetalhesProcesso, FaseProcesso, PoloProcesso } from "./tipos";

// Regras do processo: número CNJ, áreas, fases, polos e a sugestão entre área e modelo de quadro.

export const MENSAGEM_PROCESSO_DUPLICADO = "Já existe um processo com esse número.";

export const AREAS: AreaProcesso[] = ["civel", "consumidor", "trabalhista", "previdenciario", "familia", "criminal", "tributario", "administrativo", "outra"];

export const ROTULO_AREA: Record<AreaProcesso, string> = {
  civel: "Cível",
  consumidor: "Consumidor",
  trabalhista: "Trabalhista",
  previdenciario: "Previdenciário",
  familia: "Família e sucessões",
  criminal: "Criminal",
  tributario: "Tributário",
  administrativo: "Administrativo",
  outra: "Outra",
};

export const FASES: FaseProcesso[] = ["administrativa", "inicial", "instrucao", "sentenca", "recurso", "execucao"];

export const ROTULO_FASE: Record<FaseProcesso, string> = {
  administrativa: "Administrativa",
  inicial: "Inicial",
  instrucao: "Instrução",
  sentenca: "Sentença",
  recurso: "Recurso",
  execucao: "Execução",
};

export const POLOS: PoloProcesso[] = ["autor", "reu", "terceiro"];

export const ROTULO_POLO: Record<PoloProcesso, string> = {
  autor: "Autor",
  reu: "Réu",
  terceiro: "Terceiro",
};

export function detalhesProcessoVazios(area: AreaProcesso | null = null): DetalhesProcesso {
  return {
    numeroCnj: null,
    tribunal: null,
    orgao: null,
    area,
    fase: null,
    polo: null,
    parteContraria: null,
    valorCausa: null,
    segredoJustica: false,
    linkAutos: null,
  };
}

// Área e modelo de quadro: um sugere o outro, mas os dois podem ser alterados. -------

const AREA_DO_MODELO: Record<ModeloQuadro, AreaProcesso | null> = {
  civel: "civel",
  trabalhista: "trabalhista",
  previdenciario: "previdenciario",
  familia: "familia",
  consultivo: null,
};

const MODELO_DA_AREA: Partial<Record<AreaProcesso, ModeloQuadro>> = {
  civel: "civel",
  consumidor: "civel",
  trabalhista: "trabalhista",
  previdenciario: "previdenciario",
  familia: "familia",
};

/** Área sugerida ao escolher o modelo (null quando o modelo não indica área). */
export function areaSugeridaDoModelo(modelo: ModeloQuadro): AreaProcesso | null {
  return AREA_DO_MODELO[modelo];
}

/** Modelo sugerido ao escolher a área (null quando nenhum modelo combina melhor). */
export function modeloSugeridoDaArea(area: AreaProcesso): ModeloQuadro | null {
  return MODELO_DA_AREA[area] ?? null;
}

// Número CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO (Resolução CNJ 65/2008) ------------------------

export function normalizarNumeroCnj(texto: string): string {
  return texto.replace(/\D/g, "");
}

/** Dígito verificador: 98 menos o resto da divisão por 97 de NNNNNNN AAAA J TR OOOO 00. */
export function numeroCnjValido(numero: string): boolean {
  if (!/^\d{20}$/.test(numero)) return false;
  const semDigito = numero.slice(0, 7) + numero.slice(9) + "00";
  let resto = 0;
  for (const c of semDigito) resto = (resto * 10 + Number(c)) % 97;
  return 98 - resto === Number(numero.slice(7, 9));
}

export function formatarNumeroCnj(numero: string | null): string {
  if (!numero) return "";
  return numero.replace(/^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/, "$1-$2.$3.$4.$5.$6");
}

// Validação --------------------------------------------------------------------------

const texto = (v: string | null | undefined) => v?.trim() || null;

/** Normaliza e valida os detalhes do processo. */
export function validarDetalhesProcesso(d: DetalhesProcesso): { ok: true; valor: DetalhesProcesso } | { ok: false; erro: string } {
  const numeroCnj = d.numeroCnj ? normalizarNumeroCnj(d.numeroCnj) || null : null;
  if (numeroCnj && !numeroCnjValido(numeroCnj)) {
    return { ok: false, erro: "Número do processo inválido. Use o formato CNJ (0000000-00.0000.0.00.0000) e confira os dígitos." };
  }
  if (d.area && !AREAS.includes(d.area)) return { ok: false, erro: "Área inválida." };
  if (d.fase && !FASES.includes(d.fase)) return { ok: false, erro: "Fase inválida." };
  if (d.polo && !POLOS.includes(d.polo)) return { ok: false, erro: "Polo inválido." };

  const tribunal = texto(d.tribunal);
  if (tribunal && tribunal.length > 40) return { ok: false, erro: "O tribunal pode ter até 40 caracteres." };
  const orgao = texto(d.orgao);
  if (orgao && orgao.length > 120) return { ok: false, erro: "A vara ou turma pode ter até 120 caracteres." };
  const parteContraria = texto(d.parteContraria);
  if (parteContraria && parteContraria.length > 200) return { ok: false, erro: "A parte contrária pode ter até 200 caracteres." };

  let valorCausa: number | null = null;
  if (d.valorCausa !== null && d.valorCausa !== undefined) {
    if (!Number.isFinite(d.valorCausa) || d.valorCausa < 0) return { ok: false, erro: "O valor da causa precisa ser um número positivo." };
    if (d.valorCausa >= 1e12) return { ok: false, erro: "Valor da causa grande demais." };
    valorCausa = Math.round(d.valorCausa * 100) / 100;
  }

  const linkAutos = texto(d.linkAutos);
  if (linkAutos && (linkAutos.length > 2000 || !/^https?:\/\//i.test(linkAutos))) {
    return { ok: false, erro: "O link dos autos precisa começar com http:// ou https://." };
  }

  return {
    ok: true,
    valor: {
      numeroCnj,
      tribunal,
      orgao,
      area: d.area ?? null,
      fase: d.fase ?? null,
      polo: d.polo ?? null,
      parteContraria,
      valorCausa,
      segredoJustica: Boolean(d.segredoJustica),
      linkAutos,
    },
  };
}

/** "1234.5" vira "R$ 1.234,50". */
export function formatarValor(valor: number | null): string {
  if (valor === null) return "";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
