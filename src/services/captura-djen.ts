import { createHash } from "node:crypto";
import { dataNoFuso } from "@/domain/datas";
import {
  CAPTURA_DESLIGADA,
  ITENS_POR_ENVIO,
  dataIsoValida,
  montarSugestao,
  planoDaConsulta,
  somarDiasCorridos,
  validarOab,
  type CapturaDjen,
  type ComunicacaoRecebida,
  type JanelaConsulta,
  type NovaSugestaoDjen,
  type PlanoConsulta,
  type ResultadoConsulta,
} from "@/domain/djen";
import { ErroDeValidacao } from "@/domain/erros";
import type { RepositorioDjen } from "@/data/repositorio-djen";

// Casos de uso da captura do DJEN, do lado do app. A consulta em si roda na VPS
// (services/consulta-djen.ts) e chega aqui pelas rotas /api/djen/*.
// Nesta fatia nada é enviado ao advogado: as sugestões ficam pendentes no banco.

export interface ContextoCaptura {
  fuso: string;
  agora?: Date;
}

export async function obterCaptura(repo: RepositorioDjen): Promise<CapturaDjen> {
  return (await repo.obterCaptura()) ?? { ...CAPTURA_DESLIGADA };
}

/**
 * Liga a captura para a OAB informada pelo próprio advogado, com o aviso de cobertura aceito.
 * Trocar a OAB apaga as sugestões pendentes da OAB anterior e recomeça a janela.
 * A conferência do nome ("É você?") é obrigatória antes do uso real e entra na fatia 2.
 */
export async function ligarCaptura(
  repo: RepositorioDjen,
  dados: { numeroOab: string; ufOab: string; avisoAceito: boolean },
  ctx: ContextoCaptura,
): Promise<CapturaDjen> {
  const oab = validarOab(dados.numeroOab, dados.ufOab);
  if (!oab.ok) throw new ErroDeValidacao(oab.erro);
  if (dados.avisoAceito !== true) throw new ErroDeValidacao("Para ligar a captura, leia e aceite o aviso de cobertura.");
  const antes = await obterCaptura(repo);
  if (antes.numeroOab && (antes.numeroOab !== oab.numero || antes.ufOab !== oab.uf)) await repo.apagarSugestoesPendentes();
  return repo.salvarCaptura({ ligada: true, numeroOab: oab.numero, ufOab: oab.uf, avisoAceitoEm: (ctx.agora ?? new Date()).toISOString() });
}

/** Desliga na hora e apaga as sugestões pendentes. A OAB fica guardada para religar. */
export async function desligarCaptura(repo: RepositorioDjen): Promise<{ captura: CapturaDjen; apagadas: number }> {
  const antes = await obterCaptura(repo);
  const captura = await repo.salvarCaptura({ ligada: false, numeroOab: antes.numeroOab, ufOab: antes.ufOab, avisoAceitoEm: antes.avisoAceitoEm });
  const apagadas = await repo.apagarSugestoesPendentes();
  return { captura, apagadas };
}

export type PlanoParaVps = Extract<PlanoConsulta, { consultar: false }> | (Extract<PlanoConsulta, { consultar: true }> & { numeroOab: string; ufOab: string });

/**
 * A VPS pergunta se deve consultar agora. Se sim, a tentativa já fica registrada
 * (como "em_andamento"), para que uma queda no meio também conte no limite do dia.
 */
export async function iniciarConsulta(repo: RepositorioDjen, ctx: ContextoCaptura): Promise<PlanoParaVps> {
  const agora = ctx.agora ?? new Date();
  const hoje = dataNoFuso(agora, ctx.fuso);
  const captura = await obterCaptura(repo);
  const dataDaUltima = captura.ultimaTentativaEm ? dataNoFuso(new Date(captura.ultimaTentativaEm), ctx.fuso) : null;
  const plano = planoDaConsulta(captura, hoje, agora, dataDaUltima);
  if (!plano.consultar) return plano;
  await repo.registrarEstadoDaConsulta({ ultimaTentativaEm: agora.toISOString(), tentativasNoDia: plano.tentativa, ultimoResultado: "em_andamento" });
  return { ...plano, numeroOab: captura.numeroOab!, ufOab: captura.ufOab! };
}

/** A janela que a VPS devolve precisa ser uma janela possível para hoje. */
function conferirJanela(janela: JanelaConsulta, hoje: string): void {
  if (!dataIsoValida(janela.inicio) || !dataIsoValida(janela.fim) || janela.inicio > janela.fim) throw new ErroDeValidacao("Janela de consulta inválida.");
  if (janela.fim > hoje || janela.fim < somarDiasCorridos(hoje, -1)) throw new ErroDeValidacao("A janela não termina hoje.");
}

/**
 * Fim da consulta. Só um "ok" avança a data da última consulta boa; "falhou" e "limite"
 * deixam a próxima tentativa do dia (12h ou 17h) recomeçar da mesma janela.
 */
export async function concluirConsulta(
  repo: RepositorioDjen,
  dados: { resultado: Exclude<ResultadoConsulta, "em_andamento">; janela: JanelaConsulta },
  ctx: ContextoCaptura,
): Promise<CapturaDjen> {
  const hoje = dataNoFuso(ctx.agora ?? new Date(), ctx.fuso);
  conferirJanela(dados.janela, hoje);
  const captura = await obterCaptura(repo);
  if (!captura.ligada) throw new ErroDeValidacao("A captura do DJEN está desligada nesta conta.");
  await repo.registrarEstadoDaConsulta(dados.resultado === "ok" ? { ultimoResultado: "ok", ultimaConsultaOk: dados.janela.fim } : { ultimoResultado: dados.resultado });
  return obterCaptura(repo);
}

/** SHA-256 do corpo normalizado, para a conferência de republicação (fatia 2). */
export function resumoDoTeor(corpo: string): string {
  return createHash("sha256").update(corpo.toLowerCase().replace(/\s+/g, " ").trim()).digest("hex");
}

export interface ResumoDoRecebimento {
  recebidas: number;
  novas: number;
  repetidas: number;
  canceladas: number;
  invalidas: number;
}

/**
 * Cada comunicação nova vira uma sugestão pendente, com o id do DJEN como chave contra
 * duplicidade. As canceladas pelo tribunal marcam a sugestão que já existe e não criam
 * outra. O teor inteiro não é guardado.
 */
export async function receberComunicacoes(repo: RepositorioDjen, itens: ComunicacaoRecebida[], ctx: ContextoCaptura): Promise<ResumoDoRecebimento> {
  if (itens.length > ITENS_POR_ENVIO) throw new ErroDeValidacao(`Envie até ${ITENS_POR_ENVIO} comunicações por vez.`);
  const captura = await obterCaptura(repo);
  if (!captura.ligada) throw new ErroDeValidacao("A captura do DJEN está desligada nesta conta.");

  const novas = new Map<number, NovaSugestaoDjen>();
  const canceladas: number[] = [];
  let invalidas = 0;
  for (const item of itens) {
    if (!item.ativa) {
      canceladas.push(item.djenId);
      continue;
    }
    const montada = montarSugestao(item);
    if (!montada.ok) {
      invalidas++;
      continue;
    }
    novas.set(montada.sugestao.djenId, { ...montada.sugestao, resumoTeor: montada.corpo ? resumoDoTeor(montada.corpo) : null });
  }

  const inseridas = await repo.inserirSugestoes([...novas.values()]);
  const mudadas = await repo.marcarCanceladas(canceladas, (ctx.agora ?? new Date()).toISOString());
  return { recebidas: itens.length, novas: inseridas, repetidas: itens.length - inseridas - canceladas.length - invalidas, canceladas: mudadas, invalidas };
}
