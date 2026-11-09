import { somarDias } from "@/domain/datas";
import { alteracaoDePrazo, montarContagem, tribunalDoProcesso } from "@/domain/prazos";
import { detalhesProcessoVazios } from "@/domain/processo";
import { type ModeloQuadro, colunasDoModelo, novoId } from "@/domain/quadro";
import type { Cliente, Coluna, DetalhesProcesso, Etiqueta, IconeProjeto, PrioridadeTarefa, StatusProjeto, Tarefa, TipoColuna, Tom } from "@/domain/tipos";
import { FERIADOS_DOS_TRIBUNAIS } from "./feriados-tribunais";
import type { ArmazenamentoLocal } from "./repositorio-local";

// Dados de exemplo do modo local: casos jurídicos fictícios e genéricos, sem pessoas reais.
// Clientes com nomes de exemplo (Fulano de Tal, empresas "Exemplo Ltda"), sem CPF/CNPJ e sem número
// de processo, para não coincidir com documentos ou processos de verdade.
// A estrutura (quantidade de tarefas, colunas, prioridades e datas) segue o protótipo de design,
// e os testes do agente e da importação contam com ela.
// As datas são relativas ao dia de hoje para o exemplo continuar fazendo sentido.

const HOJE_DO_DESIGN = Date.UTC(2026, 10, 4);

/** Converte uma data do protótipo (base 4/11/2026) para a mesma distância a partir de hoje. */
function deslocar(iso: string | undefined, hoje = new Date()): string | null {
  if (!iso) return null;
  const [a, m, d] = iso.split("-").map(Number);
  const dias = Math.round((Date.UTC(a, m - 1, d) - HOJE_DO_DESIGN) / 86_400_000);
  const t = new Date(hoje);
  t.setDate(t.getDate() + dias);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

const TOM_DA_ETIQUETA: Record<string, Tom> = {
  Estratégia: "green",
  Documentos: "violet",
  Pesquisa: "green",
  Cartório: "gray",
  Petição: "red",
  Inicial: "blue",
  Cálculos: "blue",
  Decisão: "amber",
  Cliente: "blue",
  Audiência: "pink",
  Perícia: "amber",
  Levantamento: "green",
  Minuta: "violet",
  Cláusulas: "red",
  Parecer: "violet",
};

const TIPO: Record<string, TipoColuna> = { todo: "todo", doing: "doing", wait: "waiting", done: "done" };
const PRIORIDADE: Record<string, PrioridadeTarefa> = { low: "low", med: "medium", high: "high", urgent: "urgent" };

type Linha = [titulo: string, coluna: string, etiquetas?: string, prioridade?: string, prazo?: string, checklist?: [string, number][], descricao?: string];

interface ProjetoDeExemplo {
  nome: string;
  descricao: string;
  tipo: "project" | "campaign";
  modelo: ModeloQuadro;
  tom: Tom;
  icone: IconeProjeto;
  status: StatusProjeto;
  prazo?: string;
  inicio?: string;
  objetivo?: string;
  canais?: string[];
  tipoServico?: string;
  entregas?: [string, boolean][];
  cliente?: string;
  processo?: Partial<DetalhesProcesso>;
  tarefas: Linha[];
}

const CLIENTES: Pick<Cliente, "nome" | "tipo" | "telefone" | "email" | "observacoes">[] = [
  { nome: "Imobiliária Exemplo Ltda", tipo: "pj", telefone: null, email: null, observacoes: "Administra imóveis residenciais no centro." },
  { nome: "Distribuidora Exemplo Ltda", tipo: "pj", telefone: null, email: null, observacoes: null },
  { nome: "Fulano de Tal", tipo: "pf", telefone: null, email: null, observacoes: "Prefere contato pelo WhatsApp." },
  { nome: "Beltrana de Tal", tipo: "pf", telefone: null, email: null, observacoes: null },
  { nome: "Prestadora Exemplo Ltda", tipo: "pj", telefone: null, email: null, observacoes: null },
  { nome: "Loja Virtual Exemplo Ltda", tipo: "pj", telefone: null, email: null, observacoes: null },
];

const PROJETOS: ProjetoDeExemplo[] = [
  {
    nome: "Cobrança de aluguéis", descricao: "Cobrança de aluguéis e encargos atrasados no Juizado Especial Cível.", tipo: "project", modelo: "civel", tom: "violet", icone: "scales", status: "active", prazo: "2026-11-28",
    cliente: "Imobiliária Exemplo Ltda",
    processo: { area: "civel", fase: "inicial", polo: "autor", tribunal: "TJRS", orgao: "Juizado Especial Cível", parteContraria: "Locatário inadimplente (exemplo)", valorCausa: 18500 },
    tarefas: [
      ["Montar planilha do débito", "todo", "Estratégia", "med", "2026-11-28", [["Levantar aluguéis em aberto", 0], ["Aplicar correção e multa", 0]]],
      ["Pedir contrato ao cliente", "todo", "Documentos", "med", "2026-11-12"],
      ["Pesquisar jurisprudência do TJ", "todo", "Pesquisa", "low", "", [["Buscar cinco julgados", 0], ["Separar as ementas", 0], ["Resumir o entendimento", 0]]],
      ["Conferir custas iniciais", "todo", "Cartório", "low"],
      ["Redigir petição inicial", "doing", "Petição,Inicial", "high", "2026-11-10", [["Narrar os fatos", 1], ["Fundamentar o pedido", 1], ["Revisar com o cliente", 0], ["Ajustar versão final", 0]], "Redigir a petição inicial com base no contrato e na planilha aprovada, pedindo os aluguéis e os encargos em atraso."],
      ["Atualizar cálculos", "doing", "Cálculos", "med", "2026-11-20", [["Aluguéis", 1], ["Multa contratual", 0], ["Honorários", 0]]],
      ["Emitir guia de custas", "doing", "Cartório", "low", "2026-11-24"],
      ["Aguardar despacho inicial", "wait", "Decisão", "high", "2026-11-04"],
      ["Comprovantes do cliente", "wait", "Cliente", "med", "2026-11-06"],
      ["Primeira reunião com o cliente", "done"], ["Enviar notificação ao inquilino", "done", "Petição"], ["Minuta de acordo", "done", "Petição"], ["Analisar contrato de locação", "done", "Pesquisa"], ["Assinatura da procuração", "done"], ["Definir competência do JEC", "done", "Cartório"], ["Levantar débitos", "done", "Estratégia"],
    ],
  },
  {
    nome: "Contrato de prestação de serviços", descricao: "Revisão e redação do contrato de prestação de serviços de uma pequena empresa.", tipo: "campaign", modelo: "consultivo", tom: "red", icone: "briefcase", status: "active", inicio: "2026-12-01", prazo: "2027-02-15",
    objetivo: "Revisar o contrato antes da assinatura", canais: ["Contrato"], tipoServico: "Contrato", cliente: "Prestadora Exemplo Ltda",
    entregas: [["Reunião de levantamento", true], ["Minuta inicial", true], ["Cláusulas de rescisão e multa", false], ["Revisão com o cliente", false], ["Versão final para assinatura", false]],
    tarefas: [["Reunião de levantamento", "done", "Levantamento"], ["Minuta inicial", "done", "Minuta,Cláusulas"], ["Cláusulas de rescisão e multa", "doing", "Cláusulas", "high", "2026-11-25"], ["Pesquisar modelos de contrato", "doing", "Pesquisa", "med", "2026-11-18"], ["Conferir dados das partes", "todo", "Documentos", "med", "2026-11-30"], ["Lista de pendências", "todo", "Minuta", "low"], ["Aprovação do cliente", "wait", "Cliente", "med", "2026-11-09"]],
  },
  {
    nome: "Cobrança de cheques", descricao: "Ação monitória para cobrar cheques prescritos.", tipo: "project", modelo: "civel", tom: "blue", icone: "scales", status: "paused",
    cliente: "Distribuidora Exemplo Ltda",
    processo: { area: "civel", fase: "inicial", polo: "autor", tribunal: "TJRS", orgao: "Vara Cível", parteContraria: "Emitente dos cheques (exemplo)", valorCausa: 7200 },
    tarefas: [["Reunião inicial", "done", "Estratégia"], ["Petição da ação monitória", "doing", "Petição", "high", "2026-11-15"], ["Cópias dos cheques", "wait", "Documentos"], ["Calcular juros e correção", "todo", "", "med"]],
  },
  {
    nome: "Reclamação trabalhista", descricao: "Horas extras e verbas rescisórias de um ex-empregado do comércio.", tipo: "project", modelo: "trabalhista", tom: "green", icone: "gavel", status: "active", prazo: "2027-03-10",
    cliente: "Fulano de Tal",
    processo: { area: "trabalhista", fase: "instrucao", polo: "autor", tribunal: "TRT4", orgao: "Vara do Trabalho", parteContraria: "Comércio Exemplo Ltda", valorCausa: 42000 },
    tarefas: [["Entrevista com o cliente", "done"], ["Cálculo das verbas rescisórias", "done", "Cálculos"], ["Preparar testemunhas", "doing", "Audiência", "high", "2026-12-01"], ["Rol de testemunhas", "todo", "Audiência", "med", "2027-01-15"], ["Juntar holerites e CTPS", "todo", "Documentos"], ["Laudo pericial", "wait", "Perícia", "low", "2027-02-10"]],
  },
  {
    nome: "Parecer sobre LGPD", descricao: "Parecer sobre o tratamento de dados pessoais de clientes de uma loja virtual.", tipo: "campaign", modelo: "consultivo", tom: "amber", icone: "file", status: "active", inicio: "2026-11-20", prazo: "2026-12-05",
    objetivo: "Adequar a empresa à LGPD", canais: ["Parecer"], tipoServico: "Parecer", cliente: "Loja Virtual Exemplo Ltda",
    entregas: [["Questionário ao cliente", true], ["Parecer escrito", false], ["Política de privacidade", false], ["Reunião de apresentação", false]],
    tarefas: [["Questionário ao cliente", "done", "Levantamento"], ["Mapa de dados pessoais", "done", "Levantamento"], ["Redigir parecer", "doing", "Parecer", "high", "2026-11-14"], ["Revisar política de privacidade", "todo", "Minuta", "med", "2026-11-20"], ["Respostas do cliente", "wait", "Cliente", "med", "2026-11-17"]],
  },
  {
    nome: "Aposentadoria por idade", descricao: "Requerimento de aposentadoria por idade no INSS, já concedido.", tipo: "project", modelo: "previdenciario", tom: "green", icone: "scales", status: "done",
    cliente: "Beltrana de Tal",
    processo: { area: "previdenciario", fase: "administrativa", polo: "autor", parteContraria: "INSS" },
    tarefas: [["Reunir documentos do cliente", "done"], ["Simular tempo de contribuição", "done"], ["Protocolar requerimento no INSS", "done"], ["Conferir carta de concessão", "done"]],
  },
  {
    nome: "Notificação extrajudicial", descricao: "Notificação a um inquilino sobre aluguéis em atraso.", tipo: "campaign", modelo: "consultivo", tom: "pink", icone: "briefcase", status: "done", inicio: "2025-11-01", prazo: "2025-11-30",
    objetivo: "Cobrar os aluguéis sem precisar de ação judicial", canais: ["Notificação extrajudicial"], tipoServico: "Notificação extrajudicial", cliente: "Imobiliária Exemplo Ltda",
    entregas: [["Minuta da notificação", true], ["Envio pelo cartório", true], ["Comprovante de entrega", true]],
    tarefas: [["Minuta da notificação", "done", "Minuta"], ["Revisão com o cliente", "done"], ["Envio pelo cartório", "done", "Cartório"], ["Comprovante de entrega", "done"], ["Arquivar a resposta", "done"]],
  },
];

export function criarDadosDeExemplo(hoje = new Date()): ArmazenamentoLocal {
  const carimbo = hoje.toISOString();
  const clientes: Cliente[] = CLIENTES.map((c) => ({ id: novoId(), documento: null, ...c, criadoEm: carimbo, atualizadoEm: carimbo }));
  const idDoCliente = (nome?: string) => clientes.find((c) => c.nome === nome)?.id ?? null;
  const dados: ArmazenamentoLocal = { projects: [], campaigns: {}, columns: [], labels: [], tasks: [], clientes, processos: {} };
  const mover = (iso: string | undefined) => deslocar(iso, hoje);

  PROJETOS.forEach((pe, pi) => {
    const id = novoId();
    const campanha = pe.tipo === "campaign";
    dados.projects.push({
      id,
      name: pe.nome,
      description: pe.descricao,
      kind: pe.tipo,
      status: pe.status,
      color: pe.tom,
      icon: pe.icone,
      dueOn: campanha ? null : mover(pe.prazo),
      clienteId: idDoCliente(pe.cliente),
      position: (pi + 1) * 1024,
      archivedAt: null,
      createdAt: carimbo,
      updatedAt: carimbo,
    });
    if (campanha) {
      dados.campaigns[id] = {
        objective: pe.objetivo ?? null,
        startsOn: mover(pe.inicio),
        endsOn: mover(pe.prazo),
        channels: pe.canais ?? [],
        deliverables: (pe.entregas ?? []).map(([title, done]) => ({ id: novoId(), title, done })),
        tipoServico: pe.tipoServico ?? null,
      };
    } else if (pe.processo) {
      dados.processos![id] = { ...detalhesProcessoVazios(), ...pe.processo };
    }

    const colunas: Coluna[] = colunasDoModelo(pe.modelo).map((c, i) => ({ id: novoId(), projectId: id, title: c.title, kind: c.kind, position: (i + 1) * 1024 }));
    dados.columns.push(...colunas);

    const etiquetas = new Map<string, Etiqueta>();
    const etiquetaPara = (nome: string) => {
      if (!etiquetas.has(nome)) etiquetas.set(nome, { id: novoId(), projectId: id, name: nome, color: TOM_DA_ETIQUETA[nome] ?? "gray" });
      return etiquetas.get(nome)!.id;
    };

    pe.tarefas.forEach(([titulo, col, tags, prio, prazo, checklist, descricao], i) => {
      const coluna = colunas.find((c) => c.kind === TIPO[col])!;
      const concluida = coluna.kind === "done";
      const tarefa: Tarefa = {
        id: novoId(),
        projectId: id,
        columnId: coluna.id,
        title: titulo,
        description: descricao ?? null,
        dueOn: mover(prazo),
        tipo: "providencia",
        prazoFatal: null,
        contagem: null,
        localAudiencia: null,
        horarioAudiencia: null,
        priority: PRIORIDADE[prio ?? "low"],
        labelIds: (tags ? tags.split(",") : []).map(etiquetaPara),
        checklist: (checklist ?? []).map(([text, feito]) => ({ id: novoId(), text, done: Boolean(feito) })),
        links: [],
        completed: concluida,
        completedAt: concluida ? carimbo : null,
        position: (i + 1) * 1024,
        createdAt: carimbo,
        updatedAt: carimbo,
      };
      if (titulo === "Redigir petição inicial") {
        tarefa.links = [
          { id: novoId(), url: "", title: "Contrato de locação" },
          { id: novoId(), url: "", title: "Modelo de petição inicial" },
        ];
      }
      // Etapa 3: um prazo com memória do cálculo e documentos do cliente no checklist.
      if (titulo === "Rol de testemunhas" && tarefa.dueOn) {
        const { contagem, prazoInterno } = montarContagem(
          { inicio: somarDias(tarefa.dueOn, -14), meio: "portal", dias: 5, regra: "trabalhista", margem: 2 },
          FERIADOS_DOS_TRIBUNAIS,
          tribunalDoProcesso(dados.processos![id]),
        );
        Object.assign(tarefa, alteracaoDePrazo(contagem, prazoInterno));
      }
      if (titulo === "Juntar holerites e CTPS") {
        tarefa.checklist = [
          { id: novoId(), text: "Holerites dos últimos 12 meses", done: false, doCliente: true },
          { id: novoId(), text: "CTPS", done: false, doCliente: true },
          { id: novoId(), text: "Conferir as horas extras nos holerites", done: false },
        ];
      }
      dados.tasks.push(tarefa);
    });
    dados.labels.push(...etiquetas.values());
  });

  return dados;
}
