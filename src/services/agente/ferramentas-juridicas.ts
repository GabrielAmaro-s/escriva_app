import { z } from "zod";
import { clienteVazio } from "@/domain/cliente";
import { interpretarDataHora, somarDias } from "@/domain/datas";
import { ErroDeConflito, ErroDeValidacao } from "@/domain/erros";
import { STATUS_ATIVOS } from "@/domain/lembrete";
import {
  AREAS,
  MENSAGEM_PROCESSO_DUPLICADO,
  ROTULO_AREA,
  areaSugeridaDoModelo,
  detalhesProcessoVazios,
  formatarNumeroCnj,
  modeloSugeridoDaArea,
  normalizarNumeroCnj,
  numeroCnjValido,
  validarDetalhesProcesso,
} from "@/domain/processo";
import { AVISO_CONTAGEM_EM_VALIDACAO, REGRAS, ROTULO_MEIO, alteracaoDePrazo, formatarData, formatarDataCurta, regraSeguraDoProcesso, tribunalDoProcesso } from "@/domain/prazos";
import { dadosProjetoVazios } from "@/domain/projeto";
import { MODELOS_DE_QUADRO, ordenarPorPosicao, proximaPosicaoNaColuna, type ModeloQuadro } from "@/domain/quadro";
import type { Cliente, Projeto, Tarefa } from "@/domain/tipos";
import { criarCliente } from "../clientes";
import { alterarTarefa, calcularPrazoDaTarefa } from "../prazos";
import { criarProjeto } from "../projetos";
import {
  type ContextoAgente,
  ErroFerramenta,
  STATUS_PT,
  carregarEspaco,
  diaFalado,
  hojeNoFuso,
  horarioFalado,
  instanteNoFuso,
  linkDaTarefa,
  linkDoProjeto,
  normalizar,
  plural,
  procurarPorNome,
} from "./auxiliares";
import { PEDIR_SIM, confirmado, data, definir, type Ferramenta } from "./definicao";

// Ferramentas jurídicas do agente (etapa 4): intimação, processo, prazos e audiências.
// Usam os mesmos services da tela. Processo com segredo de justiça aparece só com nome e número.

const NADA_CRIADO = "Nada foi criado.";

/** Erros de validação e de conflito dos services viram mensagem legível; os outros seguem como inesperados. */
function comoErroFerramenta(e: unknown): unknown {
  if (e instanceof ErroDeValidacao || e instanceof ErroDeConflito) return new ErroFerramenta(e.message);
  return e;
}

/** O processo nas respostas. Com segredo de justiça, só nome e número (sem partes, cliente ou órgão). */
function resumoDoProcesso(ctx: ContextoAgente, p: Projeto, clientes: Cliente[]) {
  const d = p.processo;
  const base = {
    id: p.id,
    nome: p.name,
    numero_cnj: d?.numeroCnj ? formatarNumeroCnj(d.numeroCnj) : null,
    ...(p.status !== "active" ? { status: STATUS_PT[p.status] } : {}),
    link: linkDoProjeto(ctx, p.id),
  };
  if (d?.segredoJustica) return { ...base, segredo_justica: true };
  return {
    ...base,
    area: d?.area ? ROTULO_AREA[d.area] : null,
    tribunal: tribunalDoProcesso(d),
    orgao: d?.orgao ?? null,
    parte_contraria: d?.parteContraria ?? null,
    cliente: clientes.find((c) => c.id === p.clienteId)?.nome ?? null,
  };
}

/** Nome e número, para listas (vale para todos, com ou sem segredo). Mostra o status quando não é ativo. */
function processoCurto(p: Projeto | undefined) {
  if (!p) return null;
  return {
    nome: p.name,
    numero_cnj: p.processo?.numeroCnj ? formatarNumeroCnj(p.processo.numeroCnj) : null,
    ...(p.status !== "active" ? { status: STATUS_PT[p.status] } : {}),
  };
}

/** Acha o processo pelo número CNJ (exato, na conta) ou pelo nome. Nunca cria nada. */
function encontrarProcesso(pedido: string, projetos: Projeto[]): Projeto {
  const texto = pedido.trim();
  const digitos = normalizarNumeroCnj(texto);
  if (/^[\d\s.\-/]+$/.test(texto) && digitos.length >= 7) {
    if (!numeroCnjValido(digitos)) {
      throw new ErroFerramenta(`${texto} não é um número de processo válido (formato 0000000-00.0000.0.00.0000). Confira os dígitos. ${NADA_CRIADO}`);
    }
    const achado = projetos.find((p) => p.kind === "project" && p.processo?.numeroCnj === digitos);
    if (!achado) {
      throw new ErroFerramenta(`Não encontrei nenhum processo com o número ${formatarNumeroCnj(digitos)} na sua conta. ${NADA_CRIADO} Se ele ainda não está cadastrado, use criar_processo.`);
    }
    if (achado.archivedAt) throw new ErroFerramenta(`O processo ${achado.name} está arquivado. Restaure no app antes de registrar a intimação. ${NADA_CRIADO}`);
    return achado;
  }
  const visiveis = projetos.filter((p) => !p.archivedAt);
  const processos = procurarPorNome(
    visiveis.filter((p) => p.kind === "project"),
    texto,
    (p) => p.name,
  );
  if (processos.length === 1) return processos[0];
  if (processos.length > 1) {
    throw new ErroFerramenta(`Encontrei mais de um processo parecido com "${texto}": ${processos.map((p) => `"${p.name}"`).join(", ")}. Qual deles? ${NADA_CRIADO}`);
  }
  const [consultivo] = procurarPorNome(
    visiveis.filter((p) => p.kind === "campaign"),
    texto,
    (p) => p.name,
  );
  if (consultivo) throw new ErroFerramenta(`${consultivo.name} é um caso consultivo: intimação só vale para processo. ${NADA_CRIADO}`);
  throw new ErroFerramenta(`Não encontrei processo parecido com "${texto}" na sua conta. ${NADA_CRIADO} Se ele ainda não está cadastrado, use criar_processo.`);
}

/** Dias entre duas datas AAAA-MM-DD (b - a). */
function diasEntre(a: string, b: string): number {
  const utc = (d: string) => {
    const [ano, mes, dia] = d.split("-").map(Number);
    return Date.UTC(ano, mes - 1, dia);
  };
  return Math.round((utc(b) - utc(a)) / 86_400_000);
}

type Situacao = "fatal_vencido" | "interno_vencido" | "vence_hoje" | "interno_hoje" | "no_prazo";

function situacaoDoPrazo(t: Tarefa, hoje: string): Situacao {
  if (t.prazoFatal && t.prazoFatal < hoje) return "fatal_vencido";
  if (t.prazoFatal === hoje) return "vence_hoje";
  if (t.dueOn && t.dueOn < hoje) return "interno_vencido";
  if (t.dueOn === hoje) return "interno_hoje";
  return "no_prazo";
}

function descreverSituacao(ctx: ContextoAgente, t: Tarefa, s: Situacao): string {
  if (s === "fatal_vencido") return `o prazo fatal venceu em ${formatarDataCurta(t.prazoFatal!)}`;
  if (s === "vence_hoje") return "vence hoje";
  if (s === "interno_vencido") return `o prazo interno passou; o fatal é ${t.prazoFatal ? diaFalado(ctx, t.prazoFatal) : "sem data"}`;
  if (s === "interno_hoje") return `prazo interno hoje; o fatal é ${t.prazoFatal ? diaFalado(ctx, t.prazoFatal) : "sem data"}`;
  return `vence ${t.prazoFatal ? diaFalado(ctx, t.prazoFatal) : diaFalado(ctx, t.dueOn!)}`;
}

const dias = z.number().int().min(0).max(60).default(7).describe("Quantos dias à frente (0 = só hoje). Padrão 7.");

export function ferramentasJuridicas(): { leitura: Ferramenta[]; escrita: Ferramenta[]; comConfirmacao: Ferramenta[] } {
  const prazosProximos = definir({
    nome: "prazos_proximos",
    titulo: "Prazos próximos",
    descricao:
      "Prazos abertos (tarefas do tipo prazo) com prazo fatal ou prazo interno até hoje + N dias, em todos os processos não arquivados (inclusive pausados), com os atrasados primeiro. Processo com segredo de justiça aparece só com nome e número.",
    escrita: false,
    confirmacao: false,
    entrada: z.object({ dias }),
    async executar(ctx, args) {
      const e = await carregarEspaco(ctx);
      const hoje = hojeNoFuso(ctx);
      const limite = somarDias(hoje, args.dias);
      const porId = new Map(e.projetos.filter((p) => !p.archivedAt).map((p) => [p.id, p]));
      const itens = e.tarefas
        .filter((t) => t.tipo === "prazo" && !t.completed && porId.has(t.projectId))
        .filter((t) => (t.prazoFatal !== null && t.prazoFatal <= limite) || (t.dueOn !== null && t.dueOn <= limite))
        .map((t) => ({ t, situacao: situacaoDoPrazo(t, hoje) }));
      const atrasado = (s: Situacao) => s === "fatal_vencido" || s === "interno_vencido";
      itens.sort((a, b) => Number(atrasado(b.situacao)) - Number(atrasado(a.situacao)) || (a.t.prazoFatal ?? a.t.dueOn ?? "").localeCompare(b.t.prazoFatal ?? b.t.dueOn ?? ""));
      const atrasados = itens.filter((i) => atrasado(i.situacao)).length;
      const ate = args.dias === 0 ? "para hoje" : `até ${formatarDataCurta(limite)}`;
      let mensagem = `Nenhum prazo aberto ${ate}.`;
      if (itens.length) {
        const [primeiro] = itens;
        mensagem = `${plural(itens.length, "prazo", "prazos")} ${ate}${atrasados ? `, ${plural(atrasados, "atrasado", "atrasados")}` : ""}. O mais urgente: “${primeiro.t.title}” (${porId.get(primeiro.t.projectId)!.name}), ${descreverSituacao(ctx, primeiro.t, primeiro.situacao)}.`;
      }
      return {
        mensagem,
        dados: {
          prazos: itens.map(({ t, situacao }) => ({
            id: t.id,
            titulo: t.title,
            processo: processoCurto(porId.get(t.projectId)),
            prazo_fatal: t.prazoFatal,
            prazo_interno: t.dueOn,
            situacao,
            dias_ate_o_fatal: t.prazoFatal ? diasEntre(hoje, t.prazoFatal) : null,
            link: linkDaTarefa(ctx, t),
          })),
        },
      };
    },
  });

  const audienciasProximas = definir({
    nome: "audiencias_proximas",
    titulo: "Audiências próximas",
    descricao:
      "Audiências abertas (tarefas do tipo audiência) de hoje até hoje + N dias, em ordem de horário, em todos os processos não arquivados. As de hoje que já passaram vêm com passou=true.",
    escrita: false,
    confirmacao: false,
    entrada: z.object({ dias }),
    async executar(ctx, args) {
      const e = await carregarEspaco(ctx);
      const hoje = hojeNoFuso(ctx);
      const desde = interpretarDataHora(`${hoje}T00:00`, ctx.fuso)!.getTime();
      const ate = interpretarDataHora(`${somarDias(hoje, args.dias)}T23:59`, ctx.fuso)!.getTime();
      const porId = new Map(e.projetos.filter((p) => !p.archivedAt).map((p) => [p.id, p]));
      const agora = ctx.agora().getTime();
      const lista = e.tarefas
        .filter((t) => t.tipo === "audiencia" && !t.completed && t.horarioAudiencia && porId.has(t.projectId))
        .filter((t) => {
          const quando = new Date(t.horarioAudiencia!).getTime();
          return quando >= desde && quando <= ate;
        })
        .sort((a, b) => a.horarioAudiencia!.localeCompare(b.horarioAudiencia!));
      const proxima = lista.find((t) => new Date(t.horarioAudiencia!).getTime() >= agora);
      const periodo = args.dias === 0 ? "hoje" : `até ${formatarDataCurta(somarDias(hoje, args.dias))}`;
      const mensagem = !lista.length
        ? `Nenhuma audiência ${periodo}.`
        : `${plural(lista.length, "audiência", "audiências")} ${periodo}.${
            proxima ? ` A próxima: ${horarioFalado(ctx, proxima.horarioAudiencia!)}${proxima.localAudiencia ? `, ${proxima.localAudiencia}` : ""} (${porId.get(proxima.projectId)!.name}).` : ""
          }`;
      return {
        mensagem,
        dados: {
          audiencias: lista.map((t) => ({
            id: t.id,
            titulo: t.title,
            processo: processoCurto(porId.get(t.projectId)),
            quando: instanteNoFuso(ctx, t.horarioAudiencia!),
            local: t.localAudiencia,
            passou: new Date(t.horarioAudiencia!).getTime() < agora,
            link: linkDaTarefa(ctx, t),
          })),
        },
      };
    },
  });

  const criarProcesso = definir({
    nome: "criar_processo",
    titulo: "Criar processo",
    descricao:
      'Cadastra um processo com nome, número CNJ, área, órgão (vara ou juizado), modelo de quadro e cliente. Cliente que não existe é cadastrado só com o nome. Área e modelo se sugerem: modelo "civel", "trabalhista", "previdenciario" ou "familia"; sem nenhum dos dois, vale "civel". Informe o órgão quando souber: é por ele que registrar_intimacao sabe se é juizado.',
    escrita: true,
    confirmacao: false,
    entrada: z.object({
      nome: z.string().trim().min(1).max(120),
      numero_cnj: z.string().trim().max(30).optional().describe("Com ou sem pontuação."),
      area: z.enum(AREAS as [string, ...string[]]).optional().describe(`Uma de: ${AREAS.join(", ")}.`),
      orgao: z.string().trim().max(120).optional().describe('Vara ou juizado (ex.: "2ª Vara Cível", "Juizado Especial Cível").'),
      modelo: z.enum(["civel", "trabalhista", "previdenciario", "familia"]).optional(),
      cliente: z.string().trim().min(1).max(120).optional().describe("Nome do cliente."),
    }),
    async executar(ctx, args) {
      const area = (args.area ?? null) as (typeof AREAS)[number] | null;
      const modelo: ModeloQuadro = args.modelo ?? (area ? modeloSugeridoDaArea(area) : null) ?? "civel";
      const areaFinal = area ?? areaSugeridaDoModelo(modelo);
      const processo = validarDetalhesProcesso({ ...detalhesProcessoVazios(areaFinal), numeroCnj: args.numero_cnj ?? null, orgao: args.orgao ?? null });
      if (!processo.ok) throw new ErroFerramenta(`${processo.erro} ${NADA_CRIADO}`);

      // Confere o número antes de cadastrar o cliente, para não deixar cliente sem processo.
      const [projetos, clientes] = await Promise.all([ctx.repo.listarProjetos(), ctx.repo.listarClientes()]);
      if (processo.valor.numeroCnj && projetos.some((p) => p.processo?.numeroCnj === processo.valor.numeroCnj)) {
        throw new ErroFerramenta(`${MENSAGEM_PROCESSO_DUPLICADO} ${NADA_CRIADO}`);
      }

      let cliente: Cliente | null = null;
      let clienteNovo = false;
      if (args.cliente) {
        const mesmos = clientes.filter((c) => normalizar(c.nome) === normalizar(args.cliente!));
        if (mesmos.length > 1) {
          throw new ErroFerramenta(`Há ${mesmos.length} clientes chamados "${args.cliente}". Cadastre o processo sem cliente e escolha o certo no app. ${NADA_CRIADO}`);
        }
        cliente = mesmos[0] ?? null;
        if (!cliente) {
          try {
            cliente = await criarCliente(ctx.repo, { ...clienteVazio(), nome: args.cliente });
          } catch (e) {
            throw comoErroFerramenta(e);
          }
          clienteNovo = true;
        }
      }

      let criado: Projeto;
      try {
        criado = await criarProjeto(ctx.repo, { ...dadosProjetoVazios("project"), name: args.nome, clienteId: cliente?.id ?? null, processo: processo.valor }, modelo);
      } catch (e) {
        throw comoErroFerramenta(e);
      }
      const numero = criado.processo?.numeroCnj ? ` (${formatarNumeroCnj(criado.processo.numeroCnj)})` : "";
      const sobreCliente = cliente ? `, cliente ${cliente.nome}${clienteNovo ? " (cadastrei agora)" : ""}` : "";
      return {
        mensagem: `Criei o processo ${criado.name}${numero}${sobreCliente}. Modelo ${MODELOS_DE_QUADRO[modelo].nome}.`,
        dados: {
          processo: { ...resumoDoProcesso(ctx, criado, cliente ? [cliente] : []), modelo: MODELOS_DE_QUADRO[modelo].nome },
          cliente_cadastrado: clienteNovo,
          link: linkDoProjeto(ctx, criado.id),
        },
        desfazer: { tipo: "excluir_projeto", id: criado.id },
      };
    },
  });

  const registrarIntimacao = definir({
    nome: "registrar_intimacao",
    titulo: "Registrar intimação",
    descricao:
      'Calcula o prazo de uma intimação e, depois do "sim", cria a tarefa do tipo prazo com lembretes automáticos. Extraia os campos do texto da intimação sem inventar: o que não estiver no texto, pergunte. Sem "regra", vale a que o processo permite afirmar (trabalhista, penal, juizado quando o órgão diz Juizado); se a resposta trouxer precisa_regra, pergunte "vara comum ou juizado?". Sempre chame primeiro com confirmado=false e mostre o vencimento, o prazo interno, a memória e o aviso. Com confirmado=true, repita os mesmos campos e passe prazo_fatal_esperado igual ao prazo_fatal da prévia: se o recálculo mudar, volta uma prévia nova e nada é criado.',
    escrita: true,
    confirmacao: true,
    entrada: z.object({
      processo: z.string().trim().min(1).describe("Número CNJ (com ou sem pontuação) ou parte do nome do processo."),
      disponibilizacao: data.describe("Data da disponibilização no DJe, da ciência no portal ou da intimação pessoal."),
      meio: z.enum(["dje", "portal", "pessoal"]),
      dias: z.number().int().min(1).max(365).describe("Quantidade de dias do prazo, como está na intimação (sem dobrar)."),
      regra: z.enum(["civel", "trabalhista", "juizado", "penal"]).optional().describe('"civel" (vara comum, CPC), "juizado", "trabalhista" ou "penal".'),
      em_dobro: z.boolean().default(false).describe("Prazo em dobro (Fazenda Pública, Defensoria, litisconsortes com procuradores diferentes)."),
      excecao_recesso_penal: z.boolean().default(false).describe("Só no penal: réu preso, Lei Maria da Penha ou medida urgente (CPP, art. 798-A). O prazo corre no recesso."),
      titulo: z.string().trim().min(1).max(200).optional().describe('Ex.: "Contestação". Sem título, vira "Prazo de N dias (intimação de DD/MM)".'),
      texto_original: z.string().trim().min(1).max(10_000).describe("O texto da intimação como chegou. Vai para a descrição da tarefa."),
      margem: z.number().int().min(0).max(30).optional().describe("Dias úteis do prazo interno antes do fatal. Sem ela, vale a das Configurações."),
      confirmado,
      prazo_fatal_esperado: data.optional().describe("Com confirmado=true: o prazo_fatal que a prévia mostrou."),
    }),
    async executar(ctx, args) {
      const [projetos, clientes] = await Promise.all([ctx.repo.listarProjetos(), ctx.repo.listarClientes()]);
      const processo = encontrarProcesso(args.processo, projetos);
      const resumo = resumoDoProcesso(ctx, processo, clientes);

      const regra = args.regra ?? regraSeguraDoProcesso(processo.processo);
      if (!regra) {
        return {
          mensagem: `Antes de calcular: ${processo.name} corre em vara comum ou em juizado? No recesso de fim de ano a contagem muda. ${NADA_CRIADO}`,
          dados: {
            precisa_regra: true,
            processo: resumo,
            pergunta: "Vara comum ou juizado?",
            opcoes: { civel: "vara comum (CPC)", juizado: "juizado especial", trabalhista: REGRAS.trabalhista.rotulo, penal: REGRAS.penal.rotulo },
          },
        };
      }
      if (args.excecao_recesso_penal && regra !== "penal") {
        throw new ErroFerramenta(`A exceção do recesso (art. 798-A do CPP) só vale para prazo penal. ${NADA_CRIADO}`);
      }

      let calculo: Awaited<ReturnType<typeof calcularPrazoDaTarefa>>;
      try {
        calculo = await calcularPrazoDaTarefa(ctx.repo, processo.id, {
          inicio: args.disponibilizacao,
          meio: args.meio,
          dias: args.dias,
          regra,
          emDobro: args.em_dobro,
          suspenderNoRecesso: args.excecao_recesso_penal ? false : undefined,
          margem: args.margem,
        });
      } catch (e) {
        throw comoErroFerramenta(e);
      }
      const { contagem } = calculo;
      const interno = calculo.prazoInterno <= contagem.vencimento ? calculo.prazoInterno : contagem.vencimento;
      const unidade = contagem.unidade === "uteis" ? "úteis" : "corridos";
      const titulo = args.titulo ?? `Prazo de ${args.dias} dias ${unidade}${args.em_dobro ? " em dobro" : ""} (intimação de ${formatarDataCurta(args.disponibilizacao)})`;

      const quadro = await ctx.repo.obterQuadro(processo.id);
      if (!quadro) throw new ErroFerramenta(`Processo não encontrado. ${NADA_CRIADO}`);
      const repetidos = quadro.tarefas.filter((t) => !t.completed && t.tipo === "prazo" && t.contagem?.inicio === args.disponibilizacao && t.contagem?.dias === args.dias);

      const prazo = {
        titulo,
        prazo_fatal: contagem.vencimento,
        prazo_interno: interno,
        dias: args.dias,
        unidade,
        em_dobro: args.em_dobro,
        regra: REGRAS[regra].rotulo,
        regra_codigo: regra,
        regra_origem: args.regra ? "informada" : "pelo processo",
        meio: ROTULO_MEIO[args.meio],
        tribunal: contagem.tribunal,
        memoria: contagem.memoria,
      };
      const aviso = AVISO_CONTAGEM_EM_VALIDACAO;
      const alertaRepetido = repetidos.length
        ? `Atenção: parece repetido, já existe o prazo “${repetidos[0].title}” neste processo com a mesma disponibilização e a mesma quantidade de dias.`
        : null;
      const frase = `Prazo de ${args.dias} dias ${unidade}${args.em_dobro ? " em dobro" : ""} em ${processo.name}: vence ${formatarData(contagem.vencimento)} (prazo interno ${formatarData(interno)}).`;

      const previa = (motivo?: string) => ({
        mensagem: [motivo, frase, alertaRepetido, aviso, PEDIR_SIM].filter(Boolean).join(" "),
        dados: {
          precisa_confirmacao: true,
          processo: resumo,
          prazo,
          aviso,
          repetido: repetidos.length ? repetidos.map((t) => ({ id: t.id, titulo: t.title, link: linkDaTarefa(ctx, t) })) : null,
          pergunta: `Posso registrar esse prazo? ${PEDIR_SIM}`,
        },
      });

      if (!args.confirmado) return previa();
      if (args.prazo_fatal_esperado !== contagem.vencimento) {
        return previa(
          args.prazo_fatal_esperado
            ? `O cálculo mudou desde a prévia (ela dizia ${formatarData(args.prazo_fatal_esperado)}). ${NADA_CRIADO}`
            : `Falta o prazo_fatal_esperado da prévia. ${NADA_CRIADO}`,
        );
      }

      // Mesmo caminho da tela: cria a tarefa e aplica o cálculo, o que acerta os lembretes automáticos.
      const colunas = ordenarPorPosicao(quadro.colunas);
      const destino = colunas.find((c) => c.kind === "todo") ?? colunas[0];
      const criada = await ctx.repo.criarTarefa({
        projectId: processo.id,
        columnId: destino.id,
        title: titulo,
        description: args.texto_original,
        position: proximaPosicaoNaColuna(quadro.tarefas, destino.id),
      });
      let tarefa: Tarefa;
      try {
        tarefa = await alterarTarefa(ctx.repo, criada, alteracaoDePrazo(contagem, interno), { fuso: ctx.fuso, agora: ctx.agora() });
      } catch (e) {
        await ctx.repo.excluirTarefa(criada.id).catch(() => undefined);
        throw comoErroFerramenta(e);
      }
      const lembretes = (await ctx.repo.listarLembretes({ tarefaId: tarefa.id, status: STATUS_ATIVOS })).filter((l) => l.automatico);
      const sobreLembretes = lembretes.length ? ` ${plural(lembretes.length, "lembrete automático", "lembretes automáticos")}.` : "";
      return {
        mensagem: `Registrei “${titulo}” em ${processo.name}: vence ${formatarData(contagem.vencimento)} (prazo interno ${formatarData(interno)}).${sobreLembretes}${aviso ? ` ${aviso}` : ""}`,
        dados: {
          processo: resumo,
          prazo,
          aviso,
          tarefa: { id: tarefa.id, titulo: tarefa.title, link: linkDaTarefa(ctx, tarefa) },
          lembretes: lembretes.map((l) => ({ id: l.id, quando: instanteNoFuso(ctx, l.quando), tipo: l.automatico })),
        },
        desfazer: { tipo: "excluir_tarefas", ids: [tarefa.id] },
      };
    },
  });

  return { leitura: [prazosProximos, audienciasProximas], escrita: [criarProcesso], comConfirmacao: [registrarIntimacao] };
}
