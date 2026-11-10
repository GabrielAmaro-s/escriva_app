import { z } from "zod";
import { interpretarDataHora } from "@/domain/datas";
import { ordenarPorQuando } from "@/domain/lembrete";
import { MODELOS, alteracaoAoMudarColuna, ordenarPorPosicao, proximaPosicaoNaColuna } from "@/domain/quadro";
import type { AlteracaoTarefa, Desfazer, PrioridadeTarefa, Tarefa } from "@/domain/tipos";
import { criarLembrete, lembretesProximos, marcarLembrete } from "../lembretes";
import { dadosProjetoVazios } from "@/domain/projeto";
import { criarProjeto } from "../projetos";
import {
  COLUNA_PT,
  TIPOS_ACEITOS,
  type ContextoAgente,
  ErroFerramenta,
  PRIORIDADE_DO_PT,
  PRIORIDADE_PT,
  carregarEspaco,
  colunasDoProjeto,
  diaFalado,
  ehConsultivo,
  hojeNoFuso,
  horarioFalado,
  idsDasEtiquetas,
  instanteNoFuso,
  linkDaTarefa,
  linkDoProjeto,
  nomeDoCaso,
  normalizar,
  plural,
  resolverColuna,
  resolverProjeto,
  resolverTarefa,
  resumoDaTarefa,
  resumoDoProjeto,
} from "./auxiliares";

// As ferramentas do servidor MCP do myPlan.
// As descrições são fixas: nenhum texto vindo de tarefas, links ou mensagens entra nelas.

export interface ResultadoFerramenta {
  /** Frase curta, pronta para o WhatsApp. */
  mensagem: string;
  /** Dados estruturados para o agente (listas, ids, links). */
  dados?: Record<string, unknown>;
  /** Como reverter (vai para registro_agente.desfazer). */
  desfazer?: Desfazer | null;
}

export interface Ferramenta<E extends z.ZodObject = z.ZodObject> {
  nome: string;
  titulo: string;
  descricao: string;
  /** Altera dados? Tokens de leitura não enxergam estas. */
  escrita: boolean;
  /** Exige `confirmado: true` para aplicar. */
  confirmacao: boolean;
  entrada: E;
  executar(ctx: ContextoAgente, args: z.infer<E>): Promise<ResultadoFerramenta>;
}

const definir = <E extends z.ZodObject>(f: Ferramenta<E>) => f as unknown as Ferramenta;

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Use a data no formato AAAA-MM-DD." });
const prioridade = z.enum(["baixa", "media", "alta", "urgente"]);
const coluna = z.string().describe('Papel da coluna ("a_fazer", "em_andamento", "aguardando", "concluido") ou o título dela (ex.: "Aguardando decisão").');
const refProjeto = z.string().min(1).describe('Id do processo ou caso consultivo, ou parte do nome (ex.: "cobrança de aluguéis").');
const refTarefa = z.string().min(1).describe("Id da tarefa (de buscar_tarefas ou ver_quadro) ou o título exato.");
const confirmado = z.boolean().default(false).describe("false (padrão) só mostra a prévia. Use true depois que a pessoa disser sim.");

const PEDIR_SIM = 'Responda "sim" para confirmar.';

export function criarFerramentas(config: { limiteItens: number }): Ferramenta[] {
  const limite = config.limiteItens;

  return [
    // Leitura -------------------------------------------------------------------------
    definir({
      nome: "listar_projetos",
      titulo: "Listar processos e casos consultivos",
      descricao: "Lista os processos e casos consultivos com status, número, área, progresso (%), tarefas concluídas e prazo.",
      escrita: false,
      confirmacao: false,
      entrada: z.object({
        tipo: z.enum([...TIPOS_ACEITOS, "todos"]).default("todos").describe('"processo", "consultivo" ou "todos".'),
        incluir_arquivados: z.boolean().default(false),
      }),
      async executar(ctx, args) {
        const projetos = (await ctx.repo.listarProjetos()).filter(
          (p) => (args.incluir_arquivados || !p.archivedAt) && (args.tipo === "todos" || ehConsultivo(args.tipo) === (p.kind === "campaign")),
        );
        const processos = projetos.filter((p) => p.kind === "project").length;
        const consultivos = projetos.length - processos;
        const partes = [processos || !consultivos ? plural(processos, "processo", "processos") : null, consultivos ? plural(consultivos, "caso consultivo", "casos consultivos") : null].filter(Boolean);
        return { mensagem: `${partes.join(" e ")}.`, dados: { projetos: projetos.map((p) => resumoDoProjeto(ctx, p)) } };
      },
    }),

    definir({
      nome: "ver_quadro",
      titulo: "Ver quadro",
      descricao: "Mostra as colunas (título e papel), tarefas e etiquetas de um processo ou caso consultivo. Aceita o id ou parte do nome.",
      escrita: false,
      confirmacao: false,
      entrada: z.object({ projeto: refProjeto }),
      async executar(ctx, args) {
        const projeto = await resolverProjeto(ctx, args.projeto, { incluirArquivados: true });
        const quadro = await ctx.repo.obterQuadro(projeto.id);
        if (!quadro) throw new ErroFerramenta("Processo ou caso consultivo não encontrado.");
        const extras = { colunas: quadro.colunas, etiquetas: quadro.etiquetas };
        return {
          mensagem: `Quadro de ${projeto.name}: ${plural(quadro.tarefas.length, "tarefa", "tarefas")}.`,
          dados: {
            projeto: resumoDoProjeto(ctx, projeto),
            colunas: ordenarPorPosicao(quadro.colunas).map((c) => ({
              id: c.id,
              titulo: c.title,
              papel: COLUNA_PT[c.kind],
              tarefas: ordenarPorPosicao(quadro.tarefas.filter((t) => t.columnId === c.id)).map((t) => resumoDaTarefa(ctx, t, extras)),
            })),
            etiquetas: quadro.etiquetas.map((e) => e.name),
          },
        };
      },
    }),

    definir({
      nome: "buscar_tarefas",
      titulo: "Buscar tarefas",
      descricao: "Filtra tarefas por texto, processo ou caso consultivo, prioridade, etiqueta e prazo. Por padrão só traz as abertas.",
      escrita: false,
      confirmacao: false,
      entrada: z.object({
        texto: z.string().optional().describe("Procura no título e na descrição."),
        projeto: refProjeto.optional(),
        prioridade: prioridade.optional(),
        etiqueta: z.string().optional(),
        prazo_de: data.optional(),
        prazo_ate: data.optional(),
        atrasadas: z.boolean().optional().describe("true: só as com prazo vencido."),
        incluir_concluidas: z.boolean().default(false),
        limite: z.number().int().min(1).max(50).default(20),
      }),
      async executar(ctx, args) {
        const e = await carregarEspaco(ctx);
        const projeto = args.projeto ? await resolverProjeto(ctx, args.projeto, { incluirArquivados: true }) : null;
        const hoje = hojeNoFuso(ctx);
        const termo = args.texto ? normalizar(args.texto) : "";
        const etiquetaIds = args.etiqueta ? e.etiquetas.filter((x) => normalizar(x.name) === normalizar(args.etiqueta!)).map((x) => x.id) : null;
        const ativos = new Set(e.projetos.filter((p) => !p.archivedAt).map((p) => p.id));
        const encontradas = e.tarefas
          .filter((t) => (projeto ? t.projectId === projeto.id : ativos.has(t.projectId)))
          .filter((t) => args.incluir_concluidas || !t.completed)
          .filter((t) => !termo || normalizar(`${t.title} ${t.description ?? ""}`).includes(termo))
          .filter((t) => !args.prioridade || t.priority === PRIORIDADE_DO_PT[args.prioridade])
          .filter((t) => !etiquetaIds || t.labelIds.some((id) => etiquetaIds.includes(id)))
          .filter((t) => !args.prazo_de || (t.dueOn !== null && t.dueOn >= args.prazo_de))
          .filter((t) => !args.prazo_ate || (t.dueOn !== null && t.dueOn <= args.prazo_ate))
          .filter((t) => !args.atrasadas || (t.dueOn !== null && t.dueOn < hoje && !t.completed))
          .sort((a, b) => (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999"));
        const lista = encontradas.slice(0, args.limite);
        return {
          mensagem: `${plural(encontradas.length, "tarefa encontrada", "tarefas encontradas")}${encontradas.length > lista.length ? ` (mostrando ${lista.length})` : ""}.`,
          dados: { tarefas: lista.map((t) => resumoDaTarefa(ctx, t, e)) },
        };
      },
    }),

    definir({
      nome: "resumir_projeto",
      titulo: "Resumir processo ou caso consultivo",
      descricao: "Resumo de um processo ou caso consultivo: progresso, tarefas atrasadas, próximas entregas e o que está na coluna de espera (papel aguardando, com o título real dela).",
      escrita: false,
      confirmacao: false,
      entrada: z.object({ projeto: refProjeto }),
      async executar(ctx, args) {
        const projeto = await resolverProjeto(ctx, args.projeto, { incluirArquivados: true });
        const quadro = (await ctx.repo.obterQuadro(projeto.id))!;
        const extras = { colunas: quadro.colunas, etiquetas: quadro.etiquetas };
        const hoje = hojeNoFuso(ctx);
        const abertas = quadro.tarefas.filter((t) => !t.completed);
        const atrasadas = abertas.filter((t) => t.dueOn && t.dueOn < hoje);
        const proximas = abertas
          .filter((t) => t.dueOn && t.dueOn >= hoje)
          .sort((a, b) => a.dueOn!.localeCompare(b.dueOn!))
          .slice(0, 5);
        const colunaAguardando = quadro.colunas.find((c) => c.kind === "waiting");
        const aguardando = abertas.filter((t) => t.columnId === colunaAguardando?.id);
        const r = resumoDoProjeto(ctx, projeto);
        const partes = [`${projeto.name}: ${r.progresso}% (${r.tarefas} tarefas)`];
        if (atrasadas.length) partes.push(plural(atrasadas.length, "atrasada", "atrasadas"));
        if (proximas[0]) partes.push(`próxima entrega ${diaFalado(ctx, proximas[0].dueOn!)}`);
        if (aguardando.length) partes.push(`${aguardando.length} em ${colunaAguardando!.title}`);
        return {
          mensagem: `${partes.join(", ")}.`,
          dados: {
            projeto: r,
            atrasadas: atrasadas.map((t) => resumoDaTarefa(ctx, t, extras)),
            proximas_entregas: proximas.map((t) => resumoDaTarefa(ctx, t, extras)),
            aguardando: aguardando.map((t) => resumoDaTarefa(ctx, t, extras)),
          },
        };
      },
    }),

    definir({
      nome: "lembretes_proximos",
      titulo: "Lembretes próximos",
      descricao:
        "Lembretes pendentes das próximas N horas (padrão 1), incluindo os atrasados. Chame a cada heartbeat: a chamada também avisa ao myPlan que o agente está ativo.",
      escrita: false,
      confirmacao: false,
      entrada: z.object({ horas: z.number().min(0.25).max(168).default(1) }),
      async executar(ctx, args) {
        await ctx.repo.registrarHeartbeatAgente(ctx.agora().toISOString());
        const lista = ordenarPorQuando(await lembretesProximos(ctx.repo, args.horas, ctx.agora()));
        const { tarefas } = await ctx.repo.obterEspacoDeTrabalho();
        return {
          mensagem: lista.length ? `${plural(lista.length, "lembrete", "lembretes")} para agendar.` : "Nenhum lembrete para agendar.",
          dados: {
            lembretes: lista.map((l) => {
              const tarefa = l.tarefaId ? tarefas.find((t) => t.id === l.tarefaId) : undefined;
              return { id: l.id, texto: l.texto, quando: instanteNoFuso(ctx, l.quando), tarefa_id: l.tarefaId, link: tarefa ? linkDaTarefa(ctx, tarefa) : null };
            }),
          },
        };
      },
    }),

    // Escrita -------------------------------------------------------------------------
    definir({
      nome: "criar_tarefas",
      titulo: "Criar tarefas",
      descricao: `Cria uma ou várias tarefas (providências, até ${limite} por pedido) num processo ou caso consultivo. Etiquetas que não existem são criadas. Para prazo de intimação, use registrar_intimacao.`,
      escrita: true,
      confirmacao: false,
      entrada: z.object({
        projeto: refProjeto,
        tarefas: z
          .array(
            z.object({
              titulo: z.string().trim().min(1).max(200),
              descricao: z.string().max(5000).optional(),
              prazo: data.optional(),
              prioridade: prioridade.optional(),
              etiquetas: z.array(z.string()).max(10).optional(),
              coluna: coluna.optional(),
              checklist: z.array(z.string().max(500)).max(50).optional(),
            }),
          )
          .min(1)
          .max(limite, { error: `Posso criar até ${limite} tarefas por pedido.` }),
      }),
      async executar(ctx, args) {
        const projeto = await resolverProjeto(ctx, args.projeto);
        const quadro = (await ctx.repo.obterQuadro(projeto.id))!;
        const colunas = ordenarPorPosicao(quadro.colunas);
        const etiquetas = [...quadro.etiquetas];
        const todas = [...quadro.tarefas];
        const criadas: Tarefa[] = [];
        for (const nova of args.tarefas) {
          const destino = nova.coluna ? resolverColuna(colunas, nova.coluna) : (colunas.find((c) => c.kind === "todo") ?? colunas[0]);
          let tarefa = await ctx.repo.criarTarefa({
            projectId: projeto.id,
            columnId: destino.id,
            title: nova.titulo,
            description: nova.descricao ?? null,
            dueOn: nova.prazo ?? null,
            priority: nova.prioridade ? PRIORIDADE_DO_PT[nova.prioridade] : "medium",
            labelIds: await idsDasEtiquetas(ctx, projeto.id, nova.etiquetas ?? [], etiquetas),
            position: proximaPosicaoNaColuna(todas, destino.id),
          });
          const extra: AlteracaoTarefa = {};
          if (nova.checklist?.length) extra.checklist = nova.checklist.map((text) => ({ id: crypto.randomUUID(), text, done: false }));
          if (destino.kind === "done" && !tarefa.completed) Object.assign(extra, { completed: true, completedAt: ctx.agora().toISOString() });
          if (Object.keys(extra).length) tarefa = await ctx.repo.atualizarTarefa(tarefa.id, extra);
          criadas.push(tarefa);
          todas.push(tarefa);
        }
        const prazos = [...new Set(criadas.map((t) => t.dueOn))];
        const sobrePrazo = prazos.length === 1 && prazos[0] ? `, prazo ${diaFalado(ctx, prazos[0])}` : "";
        const quais = criadas.length === 1 ? `“${criadas[0].title}”` : plural(criadas.length, "tarefa", "tarefas");
        return {
          mensagem: `Criei ${quais} em ${projeto.name}${sobrePrazo}.`,
          dados: { tarefas: criadas.map((t) => ({ id: t.id, titulo: t.title, prazo: t.dueOn, link: linkDaTarefa(ctx, t) })), link: linkDoProjeto(ctx, projeto.id) },
          desfazer: { tipo: "excluir_tarefas", ids: criadas.map((t) => t.id) },
        };
      },
    }),

    definir({
      nome: "atualizar_tarefa",
      titulo: "Atualizar tarefa",
      descricao: "Muda título, descrição, prazo, prioridade ou etiquetas de uma tarefa. Prazo null remove a data. Etiquetas substituem as atuais.",
      escrita: true,
      confirmacao: false,
      entrada: z.object({
        tarefa: refTarefa,
        titulo: z.string().trim().min(1).max(200).optional(),
        descricao: z.string().max(5000).nullable().optional(),
        prazo: data.nullable().optional(),
        prioridade: prioridade.optional(),
        etiquetas: z.array(z.string()).max(10).optional(),
      }),
      async executar(ctx, args) {
        const e = await carregarEspaco(ctx);
        const tarefa = resolverTarefa(e.tarefas, args.tarefa);
        const alteracao: AlteracaoTarefa = {};
        if (args.titulo !== undefined) alteracao.title = args.titulo;
        if (args.descricao !== undefined) alteracao.description = args.descricao;
        if (args.prazo !== undefined) alteracao.dueOn = args.prazo;
        if (args.prioridade) alteracao.priority = PRIORIDADE_DO_PT[args.prioridade];
        if (args.etiquetas) alteracao.labelIds = await idsDasEtiquetas(ctx, tarefa.projectId, args.etiquetas, e.etiquetas);
        if (!Object.keys(alteracao).length) throw new ErroFerramenta("Diga o que mudar: título, descrição, prazo, prioridade ou etiquetas.");
        const antes = Object.fromEntries(Object.keys(alteracao).map((k) => [k, tarefa[k as keyof Tarefa]])) as AlteracaoTarefa;
        const atualizada = await ctx.repo.atualizarTarefa(tarefa.id, alteracao);
        const mudancas = [
          alteracao.title !== undefined && "título",
          alteracao.description !== undefined && "descrição",
          alteracao.dueOn !== undefined && (alteracao.dueOn ? `prazo para ${diaFalado(ctx, alteracao.dueOn)}` : "sem prazo"),
          alteracao.priority && `prioridade ${PRIORIDADE_PT[alteracao.priority]}`,
          alteracao.labelIds && "etiquetas",
        ].filter(Boolean);
        return {
          mensagem: `Atualizei “${atualizada.title}”: ${mudancas.join(", ")}.`,
          dados: { tarefa: resumoDaTarefa(ctx, atualizada, e), link: linkDaTarefa(ctx, atualizada) },
          desfazer: { tipo: "restaurar_tarefas", tarefas: [{ id: tarefa.id, alteracao: antes }] },
        };
      },
    }),

    definir({
      nome: "mover_tarefa",
      titulo: "Mover tarefa",
      descricao: "Move uma tarefa para outra coluna do quadro. Ir para Concluído marca como concluída; sair de lá reabre.",
      escrita: true,
      confirmacao: false,
      entrada: z.object({ tarefa: refTarefa, coluna }),
      async executar(ctx, args) {
        const e = await carregarEspaco(ctx);
        const tarefa = resolverTarefa(e.tarefas, args.tarefa);
        const destino = resolverColuna(colunasDoProjeto(e.colunas, tarefa.projectId), args.coluna);
        if (destino.id === tarefa.columnId) return { mensagem: `“${tarefa.title}” já está em ${destino.title}.`, dados: { link: linkDaTarefa(ctx, tarefa) } };
        const alteracao = {
          ...alteracaoAoMudarColuna(tarefa, destino, ctx.agora()),
          position: proximaPosicaoNaColuna(
            e.tarefas.filter((t) => t.id !== tarefa.id),
            destino.id,
          ),
        };
        await ctx.repo.atualizarTarefa(tarefa.id, alteracao);
        return {
          mensagem: `Movi “${tarefa.title}” para ${destino.title}.`,
          dados: { link: linkDaTarefa(ctx, tarefa) },
          desfazer: {
            tipo: "restaurar_tarefas",
            tarefas: [{ id: tarefa.id, alteracao: { columnId: tarefa.columnId, position: tarefa.position, completed: tarefa.completed, completedAt: tarefa.completedAt } }],
          },
        };
      },
    }),

    definir({
      nome: "adicionar_checklist",
      titulo: "Adicionar checklist",
      descricao: `Adiciona subtarefas (itens de checklist) ao fim do checklist de uma tarefa, até ${limite} por pedido.`,
      escrita: true,
      confirmacao: false,
      entrada: z.object({
        tarefa: refTarefa,
        itens: z
          .array(z.string().trim().min(1).max(500))
          .min(1)
          .max(limite, { error: `Posso adicionar até ${limite} itens por pedido.` }),
      }),
      async executar(ctx, args) {
        const e = await carregarEspaco(ctx);
        const tarefa = resolverTarefa(e.tarefas, args.tarefa);
        const checklist = [...tarefa.checklist, ...args.itens.map((text) => ({ id: crypto.randomUUID(), text, done: false }))];
        await ctx.repo.atualizarTarefa(tarefa.id, { checklist });
        return {
          mensagem: `Adicionei ${plural(args.itens.length, "item", "itens")} ao checklist de “${tarefa.title}”.`,
          dados: { checklist: checklist.map((i) => ({ texto: i.text, feito: i.done })), link: linkDaTarefa(ctx, tarefa) },
          desfazer: { tipo: "restaurar_tarefas", tarefas: [{ id: tarefa.id, alteracao: { checklist: tarefa.checklist } }] },
        };
      },
    }),

    definir({
      nome: "criar_lembrete",
      titulo: "Criar lembrete",
      descricao:
        'Cria um lembrete com data e hora, ligado ou não a uma tarefa. "quando" em ISO; sem fuso, vale o horário local do myPlan (ex.: 2026-11-07T15:00). Depois de criar, agende o envio e chame marcar_lembrete com status "agendado".',
      escrita: true,
      confirmacao: false,
      entrada: z.object({
        texto: z.string().trim().min(1).max(500),
        quando: z.string().min(10),
        tarefa: refTarefa.optional(),
      }),
      async executar(ctx, args) {
        const instante = interpretarDataHora(args.quando, ctx.fuso);
        if (!instante) throw new ErroFerramenta('Não entendi a data e hora. Use ISO, por exemplo "2026-11-07T15:00".');
        let tarefa: Tarefa | undefined;
        if (args.tarefa) tarefa = resolverTarefa((await ctx.repo.obterEspacoDeTrabalho()).tarefas, args.tarefa);
        const lembrete = await criarLembrete(ctx.repo, {
          texto: args.texto,
          quando: instante.toISOString(),
          tarefaId: tarefa?.id ?? null,
          projetoId: tarefa?.projectId ?? null,
          origem: "agente",
        });
        return {
          mensagem: `Lembrete marcado para ${horarioFalado(ctx, lembrete.quando)}.`,
          dados: { lembrete: { id: lembrete.id, texto: lembrete.texto, quando: instanteNoFuso(ctx, lembrete.quando) }, link: tarefa ? linkDaTarefa(ctx, tarefa) : null },
          desfazer: { tipo: "excluir_lembretes", ids: [lembrete.id] },
        };
      },
    }),

    definir({
      nome: "marcar_lembrete",
      titulo: "Marcar lembrete",
      descricao:
        'Muda um lembrete para "agendado" (o envio foi programado) ou "enviado" (a mensagem já saiu). Passe "quando_esperado" com o horário agendado: se o lembrete foi remarcado ou cancelado no app, a chamada falha e a mensagem não deve ser enviada.',
      escrita: true,
      confirmacao: false,
      entrada: z.object({
        lembrete: z.string().min(1).describe("Id do lembrete."),
        status: z.enum(["agendado", "enviado"]),
        quando_esperado: z.string().optional(),
      }),
      async executar(ctx, args) {
        const [antes] = (await ctx.repo.listarLembretes()).filter((l) => l.id === args.lembrete);
        if (!antes) throw new ErroFerramenta("Lembrete não encontrado.");
        const esperado = args.quando_esperado ? interpretarDataHora(args.quando_esperado, ctx.fuso)?.toISOString() : undefined;
        try {
          const lembrete = await marcarLembrete(ctx.repo, antes.id, args.status, { quandoEsperado: esperado, agora: ctx.agora() });
          return {
            mensagem: args.status === "agendado" ? `Lembrete agendado para ${horarioFalado(ctx, lembrete.quando)}.` : "Lembrete marcado como enviado.",
            dados: { lembrete: { id: lembrete.id, status: lembrete.status, quando: instanteNoFuso(ctx, lembrete.quando) } },
            desfazer: { tipo: "restaurar_lembrete", id: antes.id, alteracao: { status: antes.status, agendadoEm: antes.agendadoEm, enviadoEm: antes.enviadoEm } },
          };
        } catch (e) {
          throw new ErroFerramenta(e instanceof Error ? e.message : "Não foi possível marcar o lembrete.");
        }
      },
    }),

    definir({
      nome: "criar_projeto",
      titulo: "Criar caso consultivo ou processo",
      descricao:
        'Cria um caso consultivo (tipo "consultivo") ou um processo simples (tipo "processo"). Para processo com número, área e cliente, prefira criar_processo. As colunas vêm do modelo de quadro: "civel" (A fazer, Em andamento, Aguardando decisão, Concluído), "trabalhista" (A fazer, Em andamento, Aguardando audiência, Concluído), "previdenciario" (Documentos do cliente, Requerimento INSS, Aguardando INSS/Justiça, Concluído), "familia" (A fazer, Em andamento, Aguardando, Concluído) ou "consultivo" (A fazer, Redigindo, Aguardando cliente, Entregue). "consultivo" serve só para caso consultivo; os outros quatro, só para processo. Sem modelo, usa "civel" para processo e "consultivo" para caso consultivo.',
      escrita: true,
      confirmacao: false,
      entrada: z.object({
        nome: z.string().trim().min(1).max(120),
        tipo: z.enum(TIPOS_ACEITOS).default("processo").describe('"processo" ou "consultivo".'),
        descricao: z.string().max(2000).optional(),
        prazo: data.optional().describe("Prazo do processo (ou prazo de entrega do caso consultivo)."),
        inicio: data.optional().describe("Só caso consultivo: recebido em."),
        objetivo: z.string().max(200).optional().describe("Só caso consultivo: pedido do cliente."),
        canais: z.array(z.string().max(40)).max(10).optional().describe("Só caso consultivo: o primeiro vira o tipo de serviço (ex.: Contrato, Parecer)."),
        cor: z.enum(["violet", "blue", "green", "amber", "red", "pink"]).optional(),
        modelo: z.enum(MODELOS).optional().describe("Modelo de quadro: civel, trabalhista, previdenciario, familia ou consultivo."),
      }),
      async executar(ctx, args) {
        const campanha = ehConsultivo(args.tipo);
        try {
          const projeto = await criarProjeto(
            ctx.repo,
            {
              name: args.nome,
              description: args.descricao ?? null,
              kind: campanha ? "campaign" : "project",
              status: "active",
              color: args.cor ?? (campanha ? "red" : "violet"),
              icon: dadosProjetoVazios(campanha ? "campaign" : "project").icon,
              dueOn: campanha ? null : (args.prazo ?? null),
              campaign: campanha ? { objective: args.objetivo ?? null, startsOn: args.inicio ?? null, endsOn: args.prazo ?? null, channels: args.canais ?? [], deliverables: [] } : null,
            },
            args.modelo,
          );
          return {
            mensagem: `Criei ${nomeDoCaso(projeto)}.`,
            dados: { projeto: resumoDoProjeto(ctx, projeto), link: linkDoProjeto(ctx, projeto.id) },
            desfazer: { tipo: "excluir_projeto", id: projeto.id },
          };
        } catch (e) {
          throw new ErroFerramenta(e instanceof Error ? e.message : "Não foi possível criar.");
        }
      },
    }),

    // Com confirmação ----------------------------------------------------------------
    definir({
      nome: "sugerir_prioridades",
      titulo: "Sugerir prioridades",
      descricao:
        "Propõe prioridades e uma nova ordem para as tarefas abertas de um processo ou caso consultivo, pelo prazo (atrasada: urgente; até 2 dias: alta; até 7: média). Com confirmado=false devolve só a prévia; com true aplica. Pode receber sugestões próprias em \"sugestoes\".",
      escrita: true,
      confirmacao: true,
      entrada: z.object({
        projeto: refProjeto,
        sugestoes: z
          .array(z.object({ tarefa: refTarefa, prioridade }))
          .max(limite * 5)
          .optional(),
        confirmado,
      }),
      async executar(ctx, args) {
        const projeto = await resolverProjeto(ctx, args.projeto);
        const quadro = (await ctx.repo.obterQuadro(projeto.id))!;
        const hoje = hojeNoFuso(ctx);
        const abertas = quadro.tarefas.filter((t) => !t.completed);
        const prioridadeNova = new Map<string, PrioridadeTarefa>();
        if (args.sugestoes?.length) {
          for (const s of args.sugestoes) prioridadeNova.set(resolverTarefa(abertas, s.tarefa).id, PRIORIDADE_DO_PT[s.prioridade]);
        } else {
          for (const t of abertas) {
            if (!t.dueOn) continue;
            const dias = Math.round((Date.parse(t.dueOn) - Date.parse(hoje)) / 86_400_000);
            prioridadeNova.set(t.id, dias < 0 ? "urgent" : dias <= 2 ? "high" : dias <= 7 ? "medium" : t.priority);
          }
        }
        const peso: Record<PrioridadeTarefa, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        const mudancas: { tarefa: Tarefa; alteracao: AlteracaoTarefa }[] = [];
        for (const c of quadro.colunas) {
          const daColuna = ordenarPorPosicao(abertas.filter((t) => t.columnId === c.id));
          const novaOrdem = [...daColuna].sort(
            (a, b) =>
              peso[prioridadeNova.get(a.id) ?? a.priority] - peso[prioridadeNova.get(b.id) ?? b.priority] ||
              (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999") ||
              a.position - b.position,
          );
          // Se a ordem mudou, renumera a coluna (1024, 2048...) para a nova sequência.
          const ordemMudou = novaOrdem.some((t, i) => t.id !== daColuna[i].id);
          novaOrdem.forEach((t, i) => {
            const alteracao: AlteracaoTarefa = {};
            const p = prioridadeNova.get(t.id);
            if (p && p !== t.priority) alteracao.priority = p;
            const posicao = (i + 1) * 1024;
            if (ordemMudou && posicao !== t.position) alteracao.position = posicao;
            if (Object.keys(alteracao).length) mudancas.push({ tarefa: t, alteracao });
          });
        }
        const previa = mudancas.map(({ tarefa, alteracao }) => ({
          tarefa: tarefa.title,
          id: tarefa.id,
          prioridade: alteracao.priority ? `${PRIORIDADE_PT[tarefa.priority]} -> ${PRIORIDADE_PT[alteracao.priority]}` : PRIORIDADE_PT[tarefa.priority],
          muda_ordem: alteracao.position !== undefined,
        }));
        if (!mudancas.length) return { mensagem: `As prioridades de ${projeto.name} já estão em ordem.`, dados: { previa: [] } };
        if (!args.confirmado) {
          return {
            mensagem: `Sugiro mudar ${plural(mudancas.length, "tarefa", "tarefas")} em ${projeto.name}. ${PEDIR_SIM}`,
            dados: { precisa_confirmacao: true, previa, pergunta: `Posso aplicar estas mudanças em ${projeto.name}? ${PEDIR_SIM}` },
          };
        }
        for (const { tarefa, alteracao } of mudancas) await ctx.repo.atualizarTarefa(tarefa.id, alteracao);
        return {
          mensagem: `Reorganizei ${plural(mudancas.length, "tarefa", "tarefas")} em ${projeto.name}.`,
          dados: { aplicado: previa, link: linkDoProjeto(ctx, projeto.id) },
          desfazer: { tipo: "restaurar_tarefas", tarefas: mudancas.map(({ tarefa }) => ({ id: tarefa.id, alteracao: { priority: tarefa.priority, position: tarefa.position } })) },
        };
      },
    }),

    definir({
      nome: "concluir_em_lote",
      titulo: "Concluir em lote",
      descricao: `Conclui várias tarefas de uma vez (até ${limite}), movendo para Concluído. Com confirmado=false devolve só a prévia; com true aplica.`,
      escrita: true,
      confirmacao: true,
      entrada: z.object({
        tarefas: z
          .array(refTarefa)
          .min(1)
          .max(limite, { error: `Posso concluir até ${limite} tarefas por pedido.` }),
        confirmado,
      }),
      async executar(ctx, args) {
        const e = await carregarEspaco(ctx);
        const escolhidas = [...new Map(args.tarefas.map((ref) => resolverTarefa(e.tarefas, ref)).map((t) => [t.id, t])).values()];
        const abertas = escolhidas.filter((t) => !t.completed);
        if (!abertas.length) return { mensagem: "Essas tarefas já estão concluídas.", dados: { previa: [] } };
        const previa = abertas.map((t) => ({ id: t.id, tarefa: t.title, projeto: e.projetos.find((p) => p.id === t.projectId)?.name }));
        if (!args.confirmado) {
          return {
            mensagem: `Vou concluir ${plural(abertas.length, "tarefa", "tarefas")}. ${PEDIR_SIM}`,
            dados: { precisa_confirmacao: true, previa, pergunta: `Posso concluir ${plural(abertas.length, "tarefa", "tarefas")}? ${PEDIR_SIM}` },
          };
        }
        const todas = [...e.tarefas];
        for (const t of abertas) {
          const concluido = colunasDoProjeto(e.colunas, t.projectId).find((c) => c.kind === "done");
          const alteracao: AlteracaoTarefa = concluido
            ? {
                ...alteracaoAoMudarColuna(t, concluido, ctx.agora()),
                position: proximaPosicaoNaColuna(
                  todas.filter((x) => x.id !== t.id),
                  concluido.id,
                ),
              }
            : { completed: true, completedAt: ctx.agora().toISOString() };
          const atualizada = await ctx.repo.atualizarTarefa(t.id, alteracao);
          todas.splice(todas.findIndex((x) => x.id === t.id), 1, atualizada);
        }
        return {
          mensagem: `Concluí ${plural(abertas.length, "tarefa", "tarefas")}.`,
          dados: { concluidas: previa.map((p) => ({ ...p, link: linkDaTarefa(ctx, { id: p.id, projectId: abertas.find((t) => t.id === p.id)!.projectId }) })) },
          desfazer: {
            tipo: "restaurar_tarefas",
            tarefas: abertas.map((t) => ({ id: t.id, alteracao: { columnId: t.columnId, position: t.position, completed: t.completed, completedAt: t.completedAt } })),
          },
        };
      },
    }),

    definir({
      nome: "excluir_tarefa",
      titulo: "Excluir tarefa ou lembrete",
      descricao: 'Exclui uma tarefa ou um lembrete (informe só um dos dois). Com confirmado=false devolve só a prévia; com true exclui. Dá para desfazer em Configurações > Agente.',
      escrita: true,
      confirmacao: true,
      entrada: z.object({
        tarefa: refTarefa.optional(),
        lembrete: z.string().optional().describe("Id do lembrete."),
        confirmado,
      }),
      async executar(ctx, args) {
        if (Boolean(args.tarefa) === Boolean(args.lembrete)) throw new ErroFerramenta("Informe a tarefa ou o lembrete a excluir (só um).");
        if (args.lembrete) {
          const [lembrete] = (await ctx.repo.listarLembretes()).filter((l) => l.id === args.lembrete);
          if (!lembrete) throw new ErroFerramenta("Lembrete não encontrado.");
          if (!args.confirmado) {
            return {
              mensagem: `Vou excluir o lembrete de ${horarioFalado(ctx, lembrete.quando)}. ${PEDIR_SIM}`,
              dados: { precisa_confirmacao: true, previa: { lembrete: lembrete.texto, quando: instanteNoFuso(ctx, lembrete.quando) }, pergunta: `Posso excluir este lembrete? ${PEDIR_SIM}` },
            };
          }
          await ctx.repo.excluirLembrete(lembrete.id);
          return { mensagem: "Excluí o lembrete.", dados: {}, desfazer: { tipo: "recriar_lembrete", lembrete } };
        }
        const e = await carregarEspaco(ctx);
        const tarefa = resolverTarefa(e.tarefas, args.tarefa!);
        const projeto = e.projetos.find((p) => p.id === tarefa.projectId);
        if (!args.confirmado) {
          return {
            mensagem: `Vou excluir “${tarefa.title}” de ${projeto?.name}. ${PEDIR_SIM}`,
            dados: { precisa_confirmacao: true, previa: resumoDaTarefa(ctx, tarefa, e), pergunta: `Posso excluir “${tarefa.title}”? ${PEDIR_SIM}` },
          };
        }
        await ctx.repo.excluirTarefa(tarefa.id);
        return { mensagem: `Excluí “${tarefa.title}”.`, dados: { link: linkDoProjeto(ctx, tarefa.projectId) }, desfazer: { tipo: "recriar_tarefa", tarefa } };
      },
    }),
  ];
}

/** Nomes das 15 ferramentas, na ordem em que aparecem para o agente. */
export const NOMES_DAS_FERRAMENTAS = criarFerramentas({ limiteItens: 10 }).map((f) => f.nome);

