import type { CapturaDjen, NovaSugestaoDjen, ResultadoConsulta, SugestaoDjen } from "@/domain/djen";
import type { RepositorioDjen } from "../repositorio-djen";
import { type ErroDoBanco, traduzirErroDoBanco } from "./erros";
import type { ClienteDados } from "./repositorio-supabase";

// Tabelas da 0006: captura_djen (uma linha por pessoa) e comunicacoes_djen.

export interface LinhaCaptura {
  ligada: boolean;
  numero_oab: string | null;
  uf_oab: string | null;
  aviso_aceito_em: string | null;
  ultima_consulta_ok: string | null;
  ultima_tentativa_em: string | null;
  tentativas_no_dia: number;
  ultimo_resultado: ResultadoConsulta | null;
}

export interface LinhaSugestao {
  id: string;
  djen_id: number | string;
  hash: string | null;
  numero_processo: string;
  data_disponibilizacao: string;
  sigiloso: boolean;
  tribunal: string | null;
  orgao: string | null;
  classe: string | null;
  tipo_comunicacao: string | null;
  tipo_documento: string | null;
  link: string | null;
  trecho: string | null;
  dias_situacao: SugestaoDjen["diasSituacao"];
  dias: number | null;
  unidade_dias: SugestaoDjen["unidadeDias"];
  trecho_dias: string | null;
  resumo_teor: string | null;
  status: SugestaoDjen["status"];
  cancelada_no_djen_em: string | null;
  criado_em: string;
}

const COLUNAS_CAPTURA = "ligada, numero_oab, uf_oab, aviso_aceito_em, ultima_consulta_ok, ultima_tentativa_em, tentativas_no_dia, ultimo_resultado";

export function paraCaptura(l: LinhaCaptura): CapturaDjen {
  return {
    ligada: l.ligada,
    numeroOab: l.numero_oab,
    ufOab: l.uf_oab,
    avisoAceitoEm: l.aviso_aceito_em,
    ultimaConsultaOk: l.ultima_consulta_ok,
    ultimaTentativaEm: l.ultima_tentativa_em,
    tentativasNoDia: l.tentativas_no_dia,
    ultimoResultado: l.ultimo_resultado,
  };
}

export function deSugestao(s: NovaSugestaoDjen): Omit<LinhaSugestao, "id" | "status" | "cancelada_no_djen_em" | "criado_em"> {
  return {
    djen_id: s.djenId,
    hash: s.hash,
    numero_processo: s.numeroProcesso,
    data_disponibilizacao: s.dataDisponibilizacao,
    sigiloso: s.sigiloso,
    tribunal: s.tribunal,
    orgao: s.orgao,
    classe: s.classe,
    tipo_comunicacao: s.tipoComunicacao,
    tipo_documento: s.tipoDocumento,
    link: s.link,
    trecho: s.trecho,
    dias_situacao: s.diasSituacao,
    dias: s.dias,
    unidade_dias: s.unidadeDias,
    trecho_dias: s.trechoDias,
    resumo_teor: s.resumoTeor,
  };
}

export function paraSugestao(l: LinhaSugestao): SugestaoDjen {
  return {
    id: l.id,
    djenId: Number(l.djen_id),
    hash: l.hash,
    numeroProcesso: l.numero_processo,
    dataDisponibilizacao: l.data_disponibilizacao,
    sigiloso: l.sigiloso,
    tribunal: l.tribunal,
    orgao: l.orgao,
    classe: l.classe,
    tipoComunicacao: l.tipo_comunicacao,
    tipoDocumento: l.tipo_documento,
    link: l.link,
    trecho: l.trecho,
    diasSituacao: l.dias_situacao,
    dias: l.dias,
    unidadeDias: l.unidade_dias,
    trechoDias: l.trecho_dias,
    resumoTeor: l.resumo_teor,
    status: l.status,
    canceladaNoDjenEm: l.cancelada_no_djen_em,
    criadoEm: l.criado_em,
  };
}

function conferir<T>(resposta: { data: T | null; error: ErroDoBanco | null }): T {
  if (resposta.error) throw traduzirErroDoBanco(resposta.error);
  return resposta.data as T;
}

/** Aceita o cliente da sessão (RLS) ou o cliente filtrado do agente (criarClienteDoUsuario). */
export function criarRepositorioDjenSupabase(sb: ClienteDados): RepositorioDjen {
  return {
    async obterCaptura() {
      const linha = conferir(await sb.from("captura_djen").select(COLUNAS_CAPTURA).maybeSingle()) as LinhaCaptura | null;
      return linha ? paraCaptura(linha) : null;
    },

    async salvarCaptura(dados) {
      const linha = conferir(
        await sb
          .from("captura_djen")
          .upsert({ ligada: dados.ligada, numero_oab: dados.numeroOab, uf_oab: dados.ufOab, aviso_aceito_em: dados.avisoAceitoEm }, { onConflict: "user_id" })
          .select(COLUNAS_CAPTURA)
          .single(),
      ) as LinhaCaptura;
      return paraCaptura(linha);
    },

    async registrarEstadoDaConsulta(estado) {
      const valores: Record<string, unknown> = {};
      if (estado.ultimaConsultaOk !== undefined) valores.ultima_consulta_ok = estado.ultimaConsultaOk;
      if (estado.ultimaTentativaEm !== undefined) valores.ultima_tentativa_em = estado.ultimaTentativaEm;
      if (estado.tentativasNoDia !== undefined) valores.tentativas_no_dia = estado.tentativasNoDia;
      if (estado.ultimoResultado !== undefined) valores.ultimo_resultado = estado.ultimoResultado;
      if (!Object.keys(valores).length) return;
      conferir(await sb.from("captura_djen").update(valores).select("ligada"));
    },

    async inserirSugestoes(linhas) {
      if (!linhas.length) return 0;
      // on conflict (user_id, djen_id) do nothing: só as linhas novas voltam.
      const novas = conferir(
        await sb.from("comunicacoes_djen").upsert(linhas.map(deSugestao), { onConflict: "user_id,djen_id", ignoreDuplicates: true }).select("id"),
      ) as { id: string }[] | null;
      return novas?.length ?? 0;
    },

    async marcarCanceladas(djenIds, quando) {
      if (!djenIds.length) return 0;
      conferir(await sb.from("comunicacoes_djen").update({ cancelada_no_djen_em: quando }).in("djen_id", djenIds).is("cancelada_no_djen_em", null).select("id"));
      const mudadas = conferir(
        await sb.from("comunicacoes_djen").update({ status: "cancelada" }).in("djen_id", djenIds).eq("status", "pendente").select("id"),
      ) as { id: string }[] | null;
      return mudadas?.length ?? 0;
    },

    async listarSugestoes(filtro) {
      let consulta = sb.from("comunicacoes_djen").select("*").order("data_disponibilizacao", { ascending: false });
      if (filtro?.status?.length) consulta = consulta.in("status", filtro.status);
      return (conferir(await consulta) as LinhaSugestao[]).map(paraSugestao);
    },

    async apagarSugestoesPendentes() {
      const apagadas = conferir(await sb.from("comunicacoes_djen").delete().eq("status", "pendente").select("id")) as { id: string }[] | null;
      return apagadas?.length ?? 0;
    },
  };
}
