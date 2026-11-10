// Cliente da API pública do DJEN (CNJ): https://comunicaapi.pje.jus.br/api/v1
// Roda na VPS do agente, direto pelo Node 22.18 ou mais novo (sem npm install):
// só importações relativas com ".ts", `import type` e o fetch do próprio Node.
// Uma chamada por vez; a política de intervalo, limite e novas tentativas fica em
// services/consulta-djen.ts.

import type { ComunicacaoRecebida } from "../../domain/djen.ts";

export const URL_DJEN = "https://comunicaapi.pje.jus.br/api/v1";
export const ITENS_POR_PAGINA = 100;
/** Teor maior que isto chega cortado ao app, e a extração dos dias não é tentada. */
export const MAXIMO_TEXTO = 60_000;

export interface ParametrosPagina {
  numeroOab: string;
  ufOab: string;
  inicio: string;
  fim: string;
  pagina: number;
}

export type RespostaPagina =
  | { tipo: "ok"; status: number; restante: number | null; total: number; itens: ItemDjen[] }
  | { tipo: "limite"; status: 429 }
  | { tipo: "erro_servidor"; status: number }
  | { tipo: "erro_rede"; mensagem: string }
  | { tipo: "erro_cliente"; status: number }
  | { tipo: "formato"; mensagem: string };

/** Os campos do item que usamos. O resto da resposta é ignorado. */
export interface ItemDjen {
  id: number;
  hash?: string | null;
  data_disponibilizacao: string;
  siglaTribunal?: string | null;
  nomeOrgao?: string | null;
  numero_processo: string;
  nomeClasse?: string | null;
  tipoComunicacao?: string | null;
  tipoDocumento?: string | null;
  link?: string | null;
  texto?: string | null;
  ativo?: boolean | null;
  data_cancelamento?: string | null;
  destinatarios?: { nome?: string | null }[] | null;
  destinatarioadvogados?: { advogado?: { numero_oab?: string | null; uf_oab?: string | null } | null }[] | null;
}

export interface ClienteDjen {
  buscarPagina(p: ParametrosPagina): Promise<RespostaPagina>;
}

export function criarClienteDjen(opcoes: { userAgent: string; fetch?: typeof fetch; base?: string; tempoLimiteMs?: number }): ClienteDjen {
  const buscar = opcoes.fetch ?? fetch;
  const base = opcoes.base ?? URL_DJEN;
  return {
    async buscarPagina(p) {
      const url = new URL(`${base}/comunicacao`);
      url.searchParams.set("numeroOab", p.numeroOab);
      url.searchParams.set("ufOab", p.ufOab);
      url.searchParams.set("dataDisponibilizacaoInicio", p.inicio);
      url.searchParams.set("dataDisponibilizacaoFim", p.fim);
      url.searchParams.set("itensPorPagina", String(ITENS_POR_PAGINA));
      url.searchParams.set("pagina", String(p.pagina));
      let resposta: Response;
      try {
        resposta = await buscar(url, {
          headers: { Accept: "application/json", "User-Agent": opcoes.userAgent },
          signal: AbortSignal.timeout(opcoes.tempoLimiteMs ?? 60_000),
        });
      } catch (e) {
        return { tipo: "erro_rede", mensagem: e instanceof Error ? e.name : "falha de rede" };
      }
      if (resposta.status === 429) return { tipo: "limite", status: 429 };
      if (resposta.status >= 500) return { tipo: "erro_servidor", status: resposta.status };
      if (resposta.status !== 200) return { tipo: "erro_cliente", status: resposta.status };
      const restanteTexto = resposta.headers.get("x-ratelimit-remaining");
      const restante = restanteTexto !== null && /^\d+$/.test(restanteTexto.trim()) ? Number(restanteTexto) : null;
      let corpo: unknown;
      try {
        corpo = await resposta.json();
      } catch {
        return { tipo: "formato", mensagem: "a resposta não é JSON" };
      }
      return interpretarCorpo(corpo, resposta.status, restante);
    },
  };
}

/** Confere o formato sem confiar nele: a API pode mudar sem aviso. */
export function interpretarCorpo(corpo: unknown, status: number, restante: number | null): RespostaPagina {
  if (!corpo || typeof corpo !== "object") return { tipo: "formato", mensagem: "corpo vazio" };
  const c = corpo as { status?: unknown; count?: unknown; items?: unknown };
  if (c.status !== "success") return { tipo: "formato", mensagem: "status diferente de success" };
  if (!Array.isArray(c.items)) return { tipo: "formato", mensagem: "sem lista de itens" };
  const total = typeof c.count === "number" && Number.isFinite(c.count) ? c.count : c.items.length;
  for (const item of c.items) {
    const i = item as Partial<ItemDjen> | null;
    if (!i || typeof i.id !== "number" || typeof i.numero_processo !== "string" || typeof i.data_disponibilizacao !== "string") {
      return { tipo: "formato", mensagem: "item sem id, número do processo ou data" };
    }
  }
  return { tipo: "ok", status, restante, total, itens: c.items as ItemDjen[] };
}

const semZeros = (n: string | null | undefined) => (n ?? "").replace(/\D/g, "").replace(/^0+/, "");

/** A OAB consultada está entre os advogados destinatários (mesmo número e mesma UF). */
export function oabEstaNosDestinatarios(item: ItemDjen, numeroOab: string, ufOab: string): boolean {
  const numero = semZeros(numeroOab);
  const uf = ufOab.toUpperCase();
  return (item.destinatarioadvogados ?? []).some((d) => semZeros(d?.advogado?.numero_oab) === numero && (d?.advogado?.uf_oab ?? "").toUpperCase() === uf);
}

const textoOuNulo = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

/**
 * Só o que o app precisa. Ficam de fora os destinatários e os advogados: deles sai só
 * a confirmação da OAB e o sinal de sigilo. Sem a OAB entre os advogados, devolve null.
 */
export function paraComunicacaoRecebida(item: ItemDjen, numeroOab: string, ufOab: string): ComunicacaoRecebida | null {
  if (!oabEstaNosDestinatarios(item, numeroOab, ufOab)) return null;
  const texto = typeof item.texto === "string" ? item.texto : "";
  return {
    djenId: item.id,
    hash: textoOuNulo(item.hash),
    numeroProcesso: item.numero_processo,
    dataDisponibilizacao: item.data_disponibilizacao,
    tribunal: textoOuNulo(item.siglaTribunal),
    orgao: textoOuNulo(item.nomeOrgao),
    classe: textoOuNulo(item.nomeClasse),
    tipoComunicacao: textoOuNulo(item.tipoComunicacao),
    tipoDocumento: textoOuNulo(item.tipoDocumento),
    link: textoOuNulo(item.link),
    destinatarioSigilo: (item.destinatarios ?? []).some((d) => (d?.nome ?? "").trim().toUpperCase() === "SIGILO"),
    ativa: item.ativo !== false && !item.data_cancelamento,
    texto: texto.slice(0, MAXIMO_TEXTO),
    textoTruncado: texto.length > MAXIMO_TEXTO,
  };
}
