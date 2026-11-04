import { z } from "zod";
import { ordenarPorPosicao } from "@/domain/quadro";
import { validarDadosProjeto } from "@/domain/projeto";
import type { Coluna, DetalhesCampanha, Etiqueta, Projeto, Tarefa } from "@/domain/tipos";
import type { Repositorio } from "@/data/repositorio";

// Exportar e importar todos os dados de uma conta (ou do navegador) em JSON.

export const VERSAO_EXPORTACAO = 1;

export interface DadosExportados {
  versao: typeof VERSAO_EXPORTACAO;
  exportadoEm: string;
  projetos: Omit<Projeto, "campaign" | "taskCount" | "doneCount">[];
  campanhas: (DetalhesCampanha & { projectId: string })[];
  colunas: Coluna[];
  etiquetas: Etiqueta[];
  tarefas: Tarefa[];
}

export interface ResumoImportacao {
  projetos: number;
  campanhas: number;
  colunas: number;
  etiquetas: number;
  tarefas: number;
}

export async function exportarDados(repo: Repositorio, agora = new Date()): Promise<DadosExportados> {
  const [projetos, espaco] = await Promise.all([repo.listarProjetos(), repo.obterEspacoDeTrabalho()]);
  return {
    versao: VERSAO_EXPORTACAO,
    exportadoEm: agora.toISOString(),
    projetos: projetos.map(({ campaign: _c, taskCount: _t, doneCount: _d, ...p }) => p),
    campanhas: projetos.filter((p) => p.kind === "campaign" && p.campaign).map((p) => ({ projectId: p.id, ...p.campaign! })),
    colunas: espaco.colunas,
    etiquetas: espaco.etiquetas,
    tarefas: espaco.tarefas,
  };
}

// Validação do arquivo antes de gravar qualquer coisa ----------------------------

const data = z.string().nullable();
const tom = z.enum(["violet", "blue", "green", "amber", "red", "pink", "gray"]);

const esquemaExportacao = z.object({
  versao: z.literal(VERSAO_EXPORTACAO, { error: "Este arquivo é de uma versão do myPlan que esta tela não reconhece." }),
  exportadoEm: z.string(),
  projetos: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      kind: z.enum(["project", "campaign"]),
      status: z.enum(["active", "paused", "done"]),
      color: tom,
      icon: z.enum(["folder", "monitor", "box", "calendar", "chart", "check", "gift", "megaphone", "star", "target"]),
      dueOn: data,
      position: z.number(),
      archivedAt: data,
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
  campanhas: z.array(
    z.object({
      projectId: z.string(),
      objective: z.string().nullable(),
      startsOn: data,
      endsOn: data,
      channels: z.array(z.string()),
      deliverables: z.array(z.object({ id: z.string(), title: z.string(), done: z.boolean() })),
    }),
  ),
  colunas: z.array(z.object({ id: z.string(), projectId: z.string(), title: z.string(), kind: z.enum(["todo", "doing", "waiting", "done"]), position: z.number() })),
  etiquetas: z.array(z.object({ id: z.string(), projectId: z.string(), name: z.string(), color: tom })),
  tarefas: z.array(
    z.object({
      id: z.string(),
      projectId: z.string(),
      columnId: z.string(),
      title: z.string(),
      description: z.string().nullable(),
      dueOn: data,
      priority: z.enum(["low", "medium", "high", "urgent"]),
      labelIds: z.array(z.string()),
      checklist: z.array(z.object({ id: z.string(), text: z.string(), done: z.boolean() })),
      links: z.array(z.object({ id: z.string(), url: z.string(), title: z.string().nullable() })),
      completed: z.boolean(),
      completedAt: data,
      position: z.number(),
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
});

export function lerArquivoExportado(entrada: unknown): DadosExportados {
  const resultado = esquemaExportacao.safeParse(entrada);
  if (!resultado.success) {
    const primeiro = resultado.error.issues[0];
    throw new Error(`Arquivo inválido: ${primeiro?.message ?? "formato desconhecido"}${primeiro?.path.length ? ` (em ${primeiro.path.join(".")})` : ""}.`);
  }
  return resultado.data as DadosExportados;
}

/**
 * Cria tudo no repositório de destino, preservando colunas, posições, etiquetas,
 * checklists, links, conclusão e arquivamento. Os ids mudam; as relações são refeitas.
 * Os projetos são criados do último para o primeiro porque cada novo entra no topo:
 * assim a ordem final fica igual à original.
 */
export async function importarDados(repo: Repositorio, entrada: unknown): Promise<ResumoImportacao> {
  const dados = lerArquivoExportado(entrada);
  const resumo: ResumoImportacao = { projetos: 0, campanhas: 0, colunas: 0, etiquetas: 0, tarefas: 0 };
  const campanhaDe = new Map(dados.campanhas.map(({ projectId, ...c }) => [projectId, c]));

  for (const p of ordenarPorPosicao(dados.projetos).reverse()) {
    const validado = validarDadosProjeto({
      name: p.name,
      description: p.description,
      kind: p.kind,
      status: p.status,
      color: p.color,
      icon: p.icon,
      dueOn: p.dueOn,
      campaign: p.kind === "campaign" ? (campanhaDe.get(p.id) ?? null) : null,
    });
    if (!validado.ok) throw new Error(`Projeto "${p.name}": ${validado.erro}`);

    const colunasOriginais = ordenarPorPosicao(dados.colunas.filter((c) => c.projectId === p.id));
    const novo = await repo.criarProjeto(
      validado.valor,
      colunasOriginais.map((c) => ({ title: c.title, kind: c.kind, position: c.position })),
    );
    resumo.projetos += 1;
    if (p.kind === "campaign" && validado.valor.campaign) resumo.campanhas += 1;
    if (p.archivedAt) await repo.atualizarProjeto(novo.id, { archivedAt: p.archivedAt });

    // As colunas novas saem na mesma ordem das originais.
    const quadro = await repo.obterQuadro(novo.id);
    const colunasNovas = ordenarPorPosicao(quadro?.colunas ?? []);
    const novaColuna = new Map(colunasOriginais.map((c, i) => [c.id, colunasNovas[i]?.id]));
    resumo.colunas += colunasNovas.length;

    const novaEtiqueta = new Map<string, string>();
    for (const e of dados.etiquetas.filter((x) => x.projectId === p.id)) {
      const criada = await repo.criarEtiqueta(novo.id, e.name, e.color);
      novaEtiqueta.set(e.id, criada.id);
      resumo.etiquetas += 1;
    }

    for (const t of ordenarPorPosicao(dados.tarefas.filter((x) => x.projectId === p.id))) {
      const colunaId = novaColuna.get(t.columnId);
      if (!colunaId) continue; // tarefa sem coluna válida no arquivo
      const criada = await repo.criarTarefa({
        projectId: novo.id,
        columnId: colunaId,
        title: t.title.slice(0, 200) || "Sem título",
        description: t.description,
        dueOn: t.dueOn,
        priority: t.priority,
        labelIds: t.labelIds.map((id) => novaEtiqueta.get(id)).filter((id): id is string => Boolean(id)),
        position: t.position,
      });
      await repo.atualizarTarefa(criada.id, {
        checklist: t.checklist,
        links: t.links,
        completed: t.completed,
        completedAt: t.completedAt,
      });
      resumo.tarefas += 1;
    }
  }

  return resumo;
}

export function descreverResumo(r: ResumoImportacao): string {
  const partes = [
    `${r.projetos} ${r.projetos === 1 ? "projeto" : "projetos"}`,
    `${r.tarefas} ${r.tarefas === 1 ? "tarefa" : "tarefas"}`,
    `${r.etiquetas} ${r.etiquetas === 1 ? "etiqueta" : "etiquetas"}`,
    `${r.colunas} colunas`,
  ];
  if (r.campanhas) partes.splice(1, 0, `${r.campanhas} ${r.campanhas === 1 ? "campanha" : "campanhas"}`);
  return `Importados: ${partes.join(", ")}.`;
}
