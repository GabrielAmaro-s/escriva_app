import { z } from "zod";
import { ordenarPorPosicao } from "@/domain/quadro";
import { validarDadosCliente } from "@/domain/cliente";
import { ErroDeConflito } from "@/domain/erros";
import { ajustarAlteracaoAoTipo } from "@/domain/prazos";
import { validarDadosProjeto } from "@/domain/projeto";
import type { Cliente, Coluna, ContagemPrazo, DadosNovoFeriado, DetalhesCampanha, DetalhesProcesso, Etiqueta, Projeto, Tarefa } from "@/domain/tipos";
import type { Repositorio } from "@/data/repositorio";
import { criarFeriadoLocal } from "./prazos";

// Exportar e importar todos os dados de uma conta (ou do navegador) em JSON.
// Clientes, detalhes do processo e tipo de serviço entraram na etapa 2 como campos opcionais:
// arquivos exportados antes continuam válidos. Na etapa 3 entraram, também opcionais, o tipo da
// tarefa, o prazo fatal, a contagem, a audiência, o "documento do cliente" no checklist e os feriados locais.

export const VERSAO_EXPORTACAO = 1;

export interface DadosExportados {
  versao: typeof VERSAO_EXPORTACAO;
  exportadoEm: string;
  projetos: (Omit<Projeto, "campaign" | "processo" | "clienteId" | "taskCount" | "doneCount"> & { clienteId?: string | null })[];
  campanhas: (DetalhesCampanha & { projectId: string })[];
  clientes?: Cliente[];
  processos?: (DetalhesProcesso & { projectId: string })[];
  colunas: Coluna[];
  etiquetas: Etiqueta[];
  tarefas: (Omit<Tarefa, CamposDaEtapa3> & Partial<Pick<Tarefa, CamposDaEtapa3>>)[];
  /** Só os feriados locais (a carga dos tribunais vem com o sistema). */
  feriados?: DadosNovoFeriado[];
}

type CamposDaEtapa3 = "tipo" | "prazoFatal" | "contagem" | "localAudiencia" | "horarioAudiencia";

export interface ResumoImportacao {
  clientes: number;
  projetos: number;
  campanhas: number;
  colunas: number;
  etiquetas: number;
  tarefas: number;
}

export async function exportarDados(repo: Repositorio, agora = new Date()): Promise<DadosExportados> {
  const [projetos, espaco, clientes, feriados] = await Promise.all([repo.listarProjetos(), repo.obterEspacoDeTrabalho(), repo.listarClientes(), repo.listarFeriados()]);
  return {
    versao: VERSAO_EXPORTACAO,
    exportadoEm: agora.toISOString(),
    projetos: projetos.map(({ campaign: _c, processo: _p, taskCount: _t, doneCount: _d, ...p }) => p),
    campanhas: projetos.filter((p) => p.kind === "campaign" && p.campaign).map((p) => ({ projectId: p.id, ...p.campaign! })),
    clientes,
    processos: projetos.filter((p) => p.kind === "project" && p.processo).map((p) => ({ projectId: p.id, ...p.processo! })),
    colunas: espaco.colunas,
    etiquetas: espaco.etiquetas,
    tarefas: espaco.tarefas,
    feriados: feriados.filter((f) => f.userId !== null).map(({ data, ate, tribunal, tipo, descricao }) => ({ data, ate, tribunal, tipo, descricao })),
  };
}

// Validação do arquivo antes de gravar qualquer coisa ----------------------------

const data = z.string().nullable();
const tom = z.enum(["violet", "blue", "green", "amber", "red", "pink", "gray"]);

const esquemaExportacao = z.object({
  versao: z.literal(VERSAO_EXPORTACAO, { error: "Este arquivo é de uma versão do Tempestivo que esta tela não reconhece." }),
  exportadoEm: z.string(),
  projetos: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      kind: z.enum(["project", "campaign"]),
      status: z.enum(["active", "paused", "done"]),
      color: tom,
      icon: z.enum(["folder", "monitor", "box", "calendar", "chart", "check", "gift", "megaphone", "star", "target", "scales", "briefcase", "gavel", "file"]),
      dueOn: data,
      clienteId: z.string().nullable().optional(),
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
      tipoServico: z.string().nullable().optional(),
    }),
  ),
  clientes: z
    .array(
      z.object({
        id: z.string(),
        nome: z.string(),
        tipo: z.enum(["pf", "pj"]),
        documento: z.string().nullable(),
        telefone: z.string().nullable(),
        email: z.string().nullable(),
        observacoes: z.string().nullable(),
      }),
    )
    .optional(),
  processos: z
    .array(
      z.object({
        projectId: z.string(),
        numeroCnj: z.string().nullable(),
        tribunal: z.string().nullable(),
        orgao: z.string().nullable(),
        area: z.enum(["civel", "consumidor", "trabalhista", "previdenciario", "familia", "criminal", "tributario", "administrativo", "outra"]).nullable(),
        fase: z.enum(["administrativa", "inicial", "instrucao", "sentenca", "recurso", "execucao"]).nullable(),
        polo: z.enum(["autor", "reu", "terceiro"]).nullable(),
        parteContraria: z.string().nullable(),
        valorCausa: z.number().nullable(),
        segredoJustica: z.boolean(),
        linkAutos: z.string().nullable(),
      }),
    )
    .optional(),
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
      checklist: z.array(z.object({ id: z.string(), text: z.string(), done: z.boolean(), doCliente: z.boolean().optional() })),
      links: z.array(z.object({ id: z.string(), url: z.string(), title: z.string().nullable() })),
      completed: z.boolean(),
      completedAt: data,
      position: z.number(),
      createdAt: z.string(),
      updatedAt: z.string(),
      tipo: z.enum(["prazo", "providencia", "audiencia"]).optional(),
      prazoFatal: data.optional(),
      contagem: z.custom<ContagemPrazo>((v) => typeof v === "object" && v !== null && typeof (v as ContagemPrazo).vencimento === "string").nullable().optional(),
      localAudiencia: z.string().max(200).nullable().optional(),
      horarioAudiencia: data.optional(),
    }),
  ),
  feriados: z
    .array(
      z.object({
        data: z.string(),
        ate: data.optional(),
        tribunal: z.string().nullable().optional(),
        tipo: z.enum(["feriado", "suspensao", "expediente_reduzido"]).optional(),
        descricao: z.string(),
      }),
    )
    .optional(),
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
  const resumo: ResumoImportacao = { clientes: 0, projetos: 0, campanhas: 0, colunas: 0, etiquetas: 0, tarefas: 0 };
  const campanhaDe = new Map(dados.campanhas.map(({ projectId, ...c }) => [projectId, c]));
  const processoDe = new Map((dados.processos ?? []).map(({ projectId, ...d }) => [projectId, d]));

  // Clientes primeiro. Quem já existe na conta com o mesmo CPF/CNPJ é reaproveitado, não duplicado.
  const novoCliente = new Map<string, string>();
  if (dados.clientes?.length) {
    const existentes = await repo.listarClientes();
    for (const c of dados.clientes) {
      const validado = validarDadosCliente(c);
      if (!validado.ok) throw new Error(`Cliente "${c.nome}": ${validado.erro}`);
      const mesmo = validado.valor.documento ? existentes.find((e) => e.documento === validado.valor.documento) : undefined;
      if (mesmo) {
        novoCliente.set(c.id, mesmo.id);
        continue;
      }
      const criado = await repo.criarCliente(validado.valor);
      novoCliente.set(c.id, criado.id);
      resumo.clientes += 1;
    }
  }

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
      clienteId: p.clienteId ? (novoCliente.get(p.clienteId) ?? null) : null,
      processo: p.kind === "project" ? (processoDe.get(p.id) ?? null) : null,
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
        ...ajustarAlteracaoAoTipo(
          { tipo: "providencia", prazoFatal: null, contagem: null, localAudiencia: null, horarioAudiencia: null },
          {
            tipo: t.tipo ?? "providencia",
            prazoFatal: t.prazoFatal ?? null,
            contagem: t.contagem ?? null,
            localAudiencia: t.localAudiencia ?? null,
            horarioAudiencia: t.horarioAudiencia ?? null,
          },
        ),
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

  // Feriados locais: o que já existe na conta (mesma data e tribunal) fica como está.
  for (const f of dados.feriados ?? []) {
    try {
      await criarFeriadoLocal(repo, f);
    } catch (e) {
      if (!(e instanceof ErroDeConflito)) throw new Error(`Feriado de ${f.data}: ${e instanceof Error ? e.message : "inválido"}`);
    }
  }

  return resumo;
}

export function descreverResumo(r: ResumoImportacao): string {
  const partes = [
    `${r.projetos} ${r.projetos === 1 ? "processo" : "processos"}`,
    `${r.tarefas} ${r.tarefas === 1 ? "tarefa" : "tarefas"}`,
    `${r.etiquetas} ${r.etiquetas === 1 ? "etiqueta" : "etiquetas"}`,
    `${r.colunas} colunas`,
  ];
  if (r.campanhas) partes.splice(1, 0, `${r.campanhas} ${r.campanhas === 1 ? "caso consultivo" : "casos consultivos"}`);
  if (r.clientes) partes.unshift(`${r.clientes} ${r.clientes === 1 ? "cliente" : "clientes"}`);
  return `Importados: ${partes.join(", ")}.`;
}
