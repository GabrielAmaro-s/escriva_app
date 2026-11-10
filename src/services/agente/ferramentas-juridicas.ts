import { z } from "zod";
import { clienteVazio } from "@/domain/cliente";
import { dataComDia, dataNoFuso, dataNumerica, interpretarDataHora, somarDias } from "@/domain/datas";
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
import { AVISO_CONTAGEM_EM_VALIDACAO, type SituacaoPrazo, REGRAS, diasEntreDatas, situacaoDoPrazo, ROTULO_MEIO, alteracaoDePrazo, formatarData, formatarDataCurta, regraSeguraDoProcesso, tribunalDoProcesso } from "@/domain/prazos";
import { dadosProjetoVazios } from "@/domain/projeto";
import { MODELOS_DE_QUADRO, documentosPendentes, ordenarPorPosicao, proximaPosicaoNaColuna, type ModeloQuadro } from "@/domain/quadro";
import type { Cliente, Projeto, Tarefa } from "@/domain/tipos";
import { criarCliente } from "../clientes";
import { alterarTarefa, calcularPrazoDaTarefa } from "../prazos";
import { criarProjeto } from "../projetos";
import {
  type ContextoAgente,
  ErroFerramenta,
  STATUS_PT,
  TIPO_PT,
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
import { PEDIR_SIM_REGISTRAR, confirmado, data, definir, type Ferramenta } from "./definicao";

// Ferramentas jurídicas do agente (etapa 4): intimação, processo, prazos e audiências.
// documentos_pendentes veio depois do piloto, com a marca Escriva.
// Usam os mesmos services da tela. Processo com segredo de justiça aparece só com nome e número.

const NADA_CRIADO = "Nada foi registrado.";
const OFERECER_CADASTRO = "Quer que eu cadastre o processo?";

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
      throw new ErroFerramenta(`Não achei o processo ${formatarNumeroCnj(digitos)} na sua conta. ${NADA_CRIADO} ${OFERECER_CADASTRO}`);
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
    throw new ErroFerramenta(`Achei mais de um processo parecido com "${texto}": ${processos.map((p) => `"${p.name}"`).join(", ")}. Qual deles? ${NADA_CRIADO}`);
  }
  const [consultivo] = procurarPorNome(
    visiveis.filter((p) => p.kind === "campaign"),
    texto,
    (p) => p.name,
  );
  if (consultivo) throw new ErroFerramenta(`${consultivo.name} é um caso consultivo: intimação só vale para processo. ${NADA_CRIADO}`);
  throw new ErroFerramenta(`Não achei processo parecido com "${texto}" na sua conta. ${NADA_CRIADO} ${OFERECER_CADASTRO}`);
}

/** Acha um processo ou caso consultivo não arquivado pelo número CNJ (exato) ou pelo nome. Só consulta. */
function escolherCaso(pedido: string, visiveis: Projeto[]): Projeto {
  const texto = pedido.trim();
  const digitos = normalizarNumeroCnj(texto);
  if (/^[\d\s.\-/]+$/.test(texto) && digitos.length >= 7) {
    const achado = visiveis.find((p) => p.processo?.numeroCnj === digitos);
    if (!achado) throw new ErroFerramenta(`Não achei o processo ${numeroCnjValido(digitos) ? formatarNumeroCnj(digitos) : texto} na sua conta.`);
    return achado;
  }
  const achados = procurarPorNome(visiveis, texto, (p) => p.name);
  if (!achados.length) throw new ErroFerramenta(`Não achei processo ou caso consultivo parecido com "${texto}" na sua conta.`);
  if (achados.length > 1) throw new ErroFerramenta(`Achei mais de um caso parecido com "${texto}": ${achados.map((p) => `"${p.name}"`).join(", ")}. Qual deles?`);
  return achados[0];
}

/** "a", "a e b", "a, b e c". */
function juntar(itens: string[]): string {
  return itens.length > 1 ? `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}` : (itens[0] ?? "");
}

type Situacao = SituacaoPrazo;
const diasEntre = diasEntreDatas;

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

  const documentosPendentesDoCliente = definir({
    nome: "documentos_pendentes",
    titulo: "Documentos pendentes",
    descricao:
      'Documentos que o cliente ainda não entregou: itens de checklist marcados como "do cliente" e não marcados como feitos, em tarefas abertas de processos e casos consultivos não arquivados, agrupados por cliente. Use "cliente" ou "processo" quando a pessoa pedir um só. Processo com segredo de justiça aparece só com nome e número, sem o cliente, no grupo "Em segredo de justiça", e por isso não entra no filtro por cliente: para ele, peça pelo nome ou número do processo. Não entra no resumo das 8h.',
    escrita: false,
    confirmacao: false,
    entrada: z.object({
      cliente: z.string().trim().min(1).max(120).optional().describe("Nome do cliente."),
      processo: z.string().trim().min(1).max(120).optional().describe("Número CNJ ou parte do nome do processo ou do caso consultivo."),
    }),
    async executar(ctx, args) {
      const [e, clientes] = await Promise.all([carregarEspaco(ctx), ctx.repo.listarClientes()]);
      const visiveis = e.projetos.filter((p) => !p.archivedAt);
      const emSegredo = (p: Projeto) => Boolean(p.processo?.segredoJustica);
      let casos = visiveis;
      let filtro = "";

      if (args.processo) {
        const caso = escolherCaso(args.processo, visiveis);
        casos = [caso];
        filtro = ` em ${caso.name}`;
      }
      if (args.cliente) {
        const achados = procurarPorNome(clientes, args.cliente, (c) => c.nome);
        if (!achados.length) throw new ErroFerramenta(`Não achei cliente parecido com "${args.cliente}" na sua conta.`);
        if (achados.length > 1) throw new ErroFerramenta(`Achei mais de um cliente parecido com "${args.cliente}": ${achados.map((c) => `"${c.nome}"`).join(", ")}. Qual deles?`);
        const [cliente] = achados;
        casos = casos.filter((p) => p.clienteId === cliente.id && !emSegredo(p));
        filtro = `${filtro} de ${cliente.nome}`;
      }

      const porId = new Map(casos.map((p) => [p.id, p]));
      const tarefas = new Map(e.tarefas.map((t) => [t.id, t]));
      const pendentes = documentosPendentes(e.tarefas.filter((t) => porId.has(t.projectId)));
      const nomeDoCliente = new Map(clientes.map((c) => [c.id, c.nome]));

      type Grupo = { grupo: string; cliente: string | null; segredo_justica?: true; itens: { documento: string; processo: string; link: string; dados: Record<string, unknown> }[] };
      const SEM_CLIENTE = "Sem cliente";
      const SEGREDO = "Em segredo de justiça";
      const grupos = new Map<string, Grupo>();
      for (const d of pendentes) {
        const p = porId.get(d.projectId)!;
        const t = tarefas.get(d.tarefaId)!;
        const link = linkDaTarefa(ctx, t);
        const nomeCliente = p.clienteId ? (nomeDoCliente.get(p.clienteId) ?? null) : null;
        const chave = emSegredo(p) ? SEGREDO : (nomeCliente ?? SEM_CLIENTE);
        if (!grupos.has(chave)) {
          grupos.set(chave, emSegredo(p) ? { grupo: SEGREDO, cliente: null, segredo_justica: true, itens: [] } : { grupo: chave, cliente: nomeCliente, itens: [] });
        }
        // Em segredo de justiça: nome e número do processo, sem cliente e sem o título da tarefa.
        const dados = emSegredo(p)
          ? { documento: d.texto, processo: processoCurto(p), link }
          : { documento: d.texto, processo: { ...processoCurto(p), tipo: TIPO_PT[p.kind] }, tarefa: t.title, link };
        grupos.get(chave)!.itens.push({ documento: d.texto, processo: p.name, link, dados });
      }

      // Clientes em ordem alfabética; "Sem cliente" e "Em segredo de justiça" no fim.
      const peso = (g: Grupo) => (g.segredo_justica ? 2 : g.cliente === null ? 1 : 0);
      const lista = [...grupos.values()].sort((a, b) => peso(a) - peso(b) || a.grupo.localeCompare(b.grupo, "pt-BR"));
      for (const g of lista) g.itens.sort((a, b) => a.processo.localeCompare(b.processo, "pt-BR"));

      const total = pendentes.length;
      let mensagem = `Nenhum documento pendente${filtro || " de cliente"}.`;
      if (total) {
        const comNome = lista.filter((g) => g.cliente !== null).length;
        const deQuantos = !args.cliente && comNome > 1 ? ` de ${plural(comNome, "cliente", "clientes")}` : "";
        const [primeiro, ...outros] = lista;
        const porCaso = new Map<string, string[]>();
        for (const i of primeiro.itens) porCaso.set(i.processo, [...(porCaso.get(i.processo) ?? []), i.documento]);
        const detalhe = [...porCaso].map(([caso, docs]) => `${juntar(docs)} (${caso})`).join("; ");
        const resto = outros.length ? ` E mais ${plural(outros.reduce((n, g) => n + g.itens.length, 0), "documento", "documentos")} em outros grupos.` : "";
        mensagem = `${plural(total, "documento pendente", "documentos pendentes")}${filtro}${deQuantos}. ${primeiro.grupo}: ${detalhe}.${resto}`;
      }
      return {
        mensagem,
        dados: {
          total,
          grupos: lista.map((g) => ({ grupo: g.grupo, cliente: g.cliente, ...(g.segredo_justica ? { segredo_justica: true } : {}), documentos: g.itens.map((i) => i.dados) })),
          ...(args.cliente ? { observacao: "Processos em segredo de justiça não entram no filtro por cliente." } : {}),
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
          mensagem: `${processo.name} corre na vara comum ou no juizado? A contagem muda no recesso.`,
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
        ? `Parece repetido: já existe o prazo “${repetidos[0].title}” neste processo, com a mesma disponibilização e a mesma quantidade de dias.`
        : null;
      const hoje = hojeNoFuso(ctx);
      const frase = `Prazo de ${args.dias} dias ${unidade}${args.em_dobro ? " em dobro" : ""} em ${processo.name}: vence ${dataComDia(contagem.vencimento, hoje)} (prazo interno ${dataComDia(interno, hoje)}).`;

      const previa = (motivo?: string) => ({
        mensagem: [motivo, frase, alertaRepetido, aviso, PEDIR_SIM_REGISTRAR].filter(Boolean).join(" "),
        dados: {
          precisa_confirmacao: true,
          processo: resumo,
          prazo,
          aviso,
          repetido: repetidos.length ? repetidos.map((t) => ({ id: t.id, titulo: t.title, link: linkDaTarefa(ctx, t) })) : null,
          pergunta: `Posso registrar esse prazo? ${PEDIR_SIM_REGISTRAR}`,
        },
      });

      if (!args.confirmado) return previa();
      if (args.prazo_fatal_esperado !== contagem.vencimento) {
        return previa(
          args.prazo_fatal_esperado
            ? `O cálculo mudou desde a prévia, que dizia ${dataComDia(args.prazo_fatal_esperado, hoje)}. ${NADA_CRIADO}`
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
      // "Vou lembrar em 26/11, 30/11 e no dia." (como no exemplo MensagemAgente do manual)
      const quandoLembra = [...lembretes]
        .sort((a, b) => a.quando.localeCompare(b.quando))
        .map((l) => (l.automatico === "dia" ? "no dia" : dataNumerica(dataNoFuso(new Date(l.quando), ctx.fuso), hoje)));
      const sobreLembretes = quandoLembra.length ? ` Vou lembrar ${quandoLembra.length > 1 ? `em ${quandoLembra.slice(0, -1).join(", ")} e ${quandoLembra.at(-1)}` : quandoLembra[0] === "no dia" ? "no dia" : `em ${quandoLembra[0]}`}.` : "";
      return {
        mensagem: `Registrei “${titulo}” em ${processo.name}: vence ${dataComDia(contagem.vencimento, hoje)} (prazo interno ${dataComDia(interno, hoje)}).${sobreLembretes}`,
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

  return { leitura: [prazosProximos, audienciasProximas, documentosPendentesDoCliente], escrita: [criarProcesso], comConfirmacao: [registrarIntimacao] };
}
