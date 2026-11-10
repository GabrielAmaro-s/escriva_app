import { dataNoFuso, descreverDia, isoNoFuso } from "@/domain/datas";
import { ROTULO_AREA, formatarNumeroCnj } from "@/domain/processo";
import { calcularProgresso, prazoDoProjeto } from "@/domain/projeto";
import { progressoDoChecklist } from "@/domain/quadro";
import type { Coluna, Etiqueta, PrioridadeTarefa, Projeto, StatusProjeto, Tarefa, TipoColuna } from "@/domain/tipos";
import type { Repositorio } from "@/data/repositorio";

// Peças comuns às ferramentas do agente: contexto, vocabulário em português,
// busca de processo/caso consultivo/tarefa por id ou nome aproximado e formatação das respostas.
// No código e no banco, processo é "project" e caso consultivo é "campaign"; nas respostas, o
// vocabulário é sempre o jurídico.

export interface ContextoAgente {
  repo: Repositorio;
  /** Fuso IANA usado para ler e mostrar datas (MYPLAN_FUSO_HORARIO). */
  fuso: string;
  /** Endereço público do app, sem barra no fim (NEXT_PUBLIC_APP_URL). */
  urlApp: string;
  /** Máximo de itens criados ou alterados num pedido (MCP_LIMITE_ITENS_POR_PEDIDO). */
  limiteItens: number;
  agora(): Date;
}

/** Erro esperado (pedido inválido, item não encontrado): vira resposta de erro legível. */
export class ErroFerramenta extends Error {}

export const PRIORIDADE_PT: Record<PrioridadeTarefa, "baixa" | "media" | "alta" | "urgente"> = { low: "baixa", medium: "media", high: "alta", urgent: "urgente" };
export const PRIORIDADE_DO_PT = { baixa: "low", media: "medium", alta: "high", urgente: "urgent" } as const satisfies Record<string, PrioridadeTarefa>;
export const COLUNA_PT: Record<TipoColuna, "a_fazer" | "em_andamento" | "aguardando" | "concluido"> = { todo: "a_fazer", doing: "em_andamento", waiting: "aguardando", done: "concluido" };
export const COLUNA_DO_PT = { a_fazer: "todo", em_andamento: "doing", aguardando: "waiting", concluido: "done" } as const satisfies Record<string, TipoColuna>;
export const STATUS_PT: Record<StatusProjeto, "ativo" | "pausado" | "concluido"> = { active: "ativo", paused: "pausado", done: "concluido" };
export const TIPO_PT: Record<Projeto["kind"], "processo" | "consultivo"> = { project: "processo", campaign: "consultivo" };

/** Aceita o vocabulário jurídico e, por compatibilidade, o antigo ("projeto", "campanha"). */
export const TIPOS_ACEITOS = ["processo", "consultivo", "projeto", "campanha"] as const;
export const ehConsultivo = (tipo: (typeof TIPOS_ACEITOS)[number]) => tipo === "consultivo" || tipo === "campanha";

/** "o processo X" ou "o caso consultivo X". */
export const nomeDoCaso = (p: Pick<Projeto, "kind" | "name">) => `${p.kind === "campaign" ? "o caso consultivo" : "o processo"} ${p.name}`;

/** Minúsculas, sem acento e sem espaços repetidos: "Campanha de Verão " -> "campanha de verao". */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Nota de semelhança entre o que foi pedido e um nome (0 = nada a ver). */
function semelhanca(pedido: string, nome: string): number {
  const a = normalizar(pedido);
  const b = normalizar(nome);
  if (!a) return 0;
  if (a === b) return 100;
  if (b.startsWith(a)) return 80;
  if (b.includes(a)) return 60;
  const palavras = a.split(" ").filter((p) => p.length > 2);
  if (!palavras.length) return 0;
  const achadas = palavras.filter((p) => b.includes(p)).length;
  return Math.round((achadas / palavras.length) * 50);
}

/** Itens com o id exato ou, sem ele, os de nome mais parecido (vazio se nenhum parece). Não lança erro. */
export function procurarPorNome<T extends { id: string }>(itens: T[], pedido: string, nomeDe: (i: T) => string): T[] {
  const porId = itens.find((i) => i.id === pedido.trim());
  if (porId) return [porId];
  const notas = itens.map((i) => ({ item: i, nota: semelhanca(pedido, nomeDe(i)) })).filter((x) => x.nota >= 25);
  if (!notas.length) return [];
  const melhor = Math.max(...notas.map((x) => x.nota));
  return notas.filter((x) => x.nota === melhor).map((x) => x.item);
}

/** Escolhe o item pelo id exato ou pelo nome mais parecido. Ambiguidade vira erro com as opções. */
function escolher<T extends { id: string }>(itens: T[], pedido: string, nomeDe: (i: T) => string, oQue: string): T {
  const porId = itens.find((i) => i.id === pedido.trim());
  if (porId) return porId;
  const notas = itens.map((i) => ({ item: i, nota: semelhanca(pedido, nomeDe(i)) })).filter((x) => x.nota >= 25);
  if (!notas.length) throw new ErroFerramenta(`Não encontrei ${oQue} parecido com "${pedido}".`);
  const melhor = Math.max(...notas.map((x) => x.nota));
  const empatados = notas.filter((x) => x.nota === melhor);
  if (empatados.length > 1) {
    throw new ErroFerramenta(`Encontrei mais de ${oQue} parecido com "${pedido}": ${empatados.map((x) => `"${nomeDe(x.item)}"`).join(", ")}. Qual deles?`);
  }
  return empatados[0].item;
}

export async function resolverProjeto(ctx: ContextoAgente, pedido: string, opcoes: { incluirArquivados?: boolean } = {}): Promise<Projeto> {
  const projetos = (await ctx.repo.listarProjetos()).filter((p) => opcoes.incluirArquivados || !p.archivedAt);
  return escolher(projetos, pedido, (p) => p.name, "um processo ou caso consultivo");
}

export async function carregarEspaco(ctx: ContextoAgente) {
  const [projetos, espaco] = await Promise.all([ctx.repo.listarProjetos(), ctx.repo.obterEspacoDeTrabalho()]);
  return { projetos, ...espaco };
}

export function resolverTarefa(tarefas: Tarefa[], pedido: string): Tarefa {
  return escolher(tarefas, pedido, (t) => t.title, "uma tarefa");
}

export function colunasDoProjeto(colunas: Coluna[], projetoId: string): Coluna[] {
  return colunas.filter((c) => c.projectId === projetoId).sort((a, b) => a.position - b.position);
}

/** Coluna pelo papel ("a_fazer"...) ou pelo título ("Em andamento"). */
export function resolverColuna(colunas: Coluna[], pedido: string): Coluna {
  const papel = COLUNA_DO_PT[pedido as keyof typeof COLUNA_DO_PT];
  const porPapel = papel && colunas.find((c) => c.kind === papel);
  if (porPapel) return porPapel;
  return escolher(colunas, pedido, (c) => c.title, "uma coluna");
}

// Links ---------------------------------------------------------------------------

export const linkDoProjeto = (ctx: ContextoAgente, projetoId: string) => `${ctx.urlApp}/projetos/${projetoId}`;
export const linkDaTarefa = (ctx: ContextoAgente, t: Pick<Tarefa, "id" | "projectId">) => `${ctx.urlApp}/projetos/${t.projectId}?tarefa=${t.id}`;

// Datas -----------------------------------------------------------------------------

export const hojeNoFuso = (ctx: ContextoAgente) => dataNoFuso(ctx.agora(), ctx.fuso);
export const instanteNoFuso = (ctx: ContextoAgente, iso: string) => isoNoFuso(new Date(iso), ctx.fuso);
export const diaFalado = (ctx: ContextoAgente, data: string) => descreverDia(data, hojeNoFuso(ctx));

/** "às 15:00" ou "amanhã às 09:30" para um instante. */
export function horarioFalado(ctx: ContextoAgente, iso: string): string {
  const local = isoNoFuso(new Date(iso), ctx.fuso);
  return `${descreverDia(local.slice(0, 10), hojeNoFuso(ctx))} às ${local.slice(11, 16)}`;
}

// Formato das tarefas e projetos nas respostas ------------------------------------------

export function resumoDaTarefa(ctx: ContextoAgente, t: Tarefa, extras: { colunas: Coluna[]; etiquetas: Etiqueta[]; projetos?: Projeto[] }) {
  const coluna = extras.colunas.find((c) => c.id === t.columnId);
  const checklist = progressoDoChecklist(t);
  const hoje = hojeNoFuso(ctx);
  return {
    id: t.id,
    titulo: t.title,
    tipo: t.tipo,
    processo: extras.projetos?.find((p) => p.id === t.projectId)?.name,
    processo_id: t.projectId,
    // Título real da coluna (do modelo jurídico) e o código do papel, que serve de entrada no mover_tarefa.
    coluna: coluna?.title ?? null,
    papel: coluna ? COLUNA_PT[coluna.kind] : null,
    prazo: t.dueOn,
    prazo_fatal: t.prazoFatal,
    atrasada: Boolean(t.dueOn && !t.completed && t.dueOn < hoje),
    prioridade: PRIORIDADE_PT[t.priority],
    etiquetas: t.labelIds.map((id) => extras.etiquetas.find((e) => e.id === id)?.name).filter(Boolean),
    checklist: checklist.total ? `${checklist.feitos}/${checklist.total}` : null,
    concluida: t.completed,
    link: linkDaTarefa(ctx, t),
  };
}

export function resumoDoProjeto(ctx: ContextoAgente, p: Projeto) {
  return {
    id: p.id,
    nome: p.name,
    tipo: TIPO_PT[p.kind],
    numero_cnj: p.processo?.numeroCnj ? formatarNumeroCnj(p.processo.numeroCnj) : null,
    area: p.processo?.area ? ROTULO_AREA[p.processo.area] : null,
    status: STATUS_PT[p.status],
    arquivado: Boolean(p.archivedAt),
    progresso: calcularProgresso(p),
    tarefas: `${p.doneCount} de ${p.taskCount}`,
    prazo: prazoDoProjeto(p),
    link: linkDoProjeto(ctx, p.id),
  };
}

export function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Cria as etiquetas que ainda não existem no projeto e devolve os ids. */
export async function idsDasEtiquetas(ctx: ContextoAgente, projetoId: string, nomes: string[], existentes: Etiqueta[]): Promise<string[]> {
  const ids: string[] = [];
  const doProjeto = existentes.filter((e) => e.projectId === projetoId);
  for (const nome of nomes.map((n) => n.trim()).filter(Boolean)) {
    let etiqueta = doProjeto.find((e) => normalizar(e.name) === normalizar(nome));
    if (!etiqueta) {
      etiqueta = await ctx.repo.criarEtiqueta(projetoId, nome.slice(0, 40), "gray");
      doProjeto.push(etiqueta);
      existentes.push(etiqueta);
    }
    if (!ids.includes(etiqueta.id)) ids.push(etiqueta.id);
  }
  return ids;
}
