import { type ModeloQuadro, colunasDoModelo, novoId } from "@/domain/quadro";
import type { Coluna, Etiqueta, IconeProjeto, PrioridadeTarefa, StatusProjeto, Tarefa, TipoColuna, Tom } from "@/domain/tipos";
import type { ArmazenamentoLocal } from "./repositorio-local";

// Dados de exemplo do modo local: casos jurídicos fictícios e genéricos, sem pessoas reais.
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
  entregas?: [string, boolean][];
  tarefas: Linha[];
}

const PROJETOS: ProjetoDeExemplo[] = [
  {
    nome: "Cobrança de aluguéis", descricao: "Cobrança de aluguéis e encargos atrasados no Juizado Especial Cível.", tipo: "project", modelo: "civel", tom: "violet", icone: "folder", status: "active", prazo: "2026-11-28",
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
    nome: "Contrato de prestação de serviços", descricao: "Revisão e redação do contrato de prestação de serviços de uma pequena empresa.", tipo: "campaign", modelo: "consultivo", tom: "red", icone: "megaphone", status: "active", inicio: "2026-12-01", prazo: "2027-02-15",
    objetivo: "Revisar o contrato antes da assinatura", canais: ["Contrato"],
    entregas: [["Reunião de levantamento", true], ["Minuta inicial", true], ["Cláusulas de rescisão e multa", false], ["Revisão com o cliente", false], ["Versão final para assinatura", false]],
    tarefas: [["Reunião de levantamento", "done", "Levantamento"], ["Minuta inicial", "done", "Minuta,Cláusulas"], ["Cláusulas de rescisão e multa", "doing", "Cláusulas", "high", "2026-11-25"], ["Pesquisar modelos de contrato", "doing", "Pesquisa", "med", "2026-11-18"], ["Conferir dados das partes", "todo", "Documentos", "med", "2026-11-30"], ["Lista de pendências", "todo", "Minuta", "low"], ["Aprovação do cliente", "wait", "Cliente", "med", "2026-11-09"]],
  },
  {
    nome: "Cobrança de cheques", descricao: "Ação monitória para cobrar cheques prescritos.", tipo: "project", modelo: "civel", tom: "blue", icone: "folder", status: "paused",
    tarefas: [["Reunião inicial", "done", "Estratégia"], ["Petição da ação monitória", "doing", "Petição", "high", "2026-11-15"], ["Cópias dos cheques", "wait", "Documentos"], ["Calcular juros e correção", "todo", "", "med"]],
  },
  {
    nome: "Reclamação trabalhista", descricao: "Horas extras e verbas rescisórias de um ex-empregado do comércio.", tipo: "project", modelo: "trabalhista", tom: "green", icone: "calendar", status: "active", prazo: "2027-03-10",
    tarefas: [["Entrevista com o cliente", "done"], ["Cálculo das verbas rescisórias", "done", "Cálculos"], ["Preparar testemunhas", "doing", "Audiência", "high", "2026-12-01"], ["Rol de testemunhas", "todo", "Audiência", "med", "2027-01-15"], ["Juntar holerites e CTPS", "todo", "Documentos"], ["Laudo pericial", "wait", "Perícia", "low", "2027-02-10"]],
  },
  {
    nome: "Parecer sobre LGPD", descricao: "Parecer sobre o tratamento de dados pessoais de clientes de uma loja virtual.", tipo: "campaign", modelo: "consultivo", tom: "amber", icone: "chart", status: "active", inicio: "2026-11-20", prazo: "2026-12-05",
    objetivo: "Adequar a empresa à LGPD", canais: ["Parecer"],
    entregas: [["Questionário ao cliente", true], ["Parecer escrito", false], ["Política de privacidade", false], ["Reunião de apresentação", false]],
    tarefas: [["Questionário ao cliente", "done", "Levantamento"], ["Mapa de dados pessoais", "done", "Levantamento"], ["Redigir parecer", "doing", "Parecer", "high", "2026-11-14"], ["Revisar política de privacidade", "todo", "Minuta", "med", "2026-11-20"], ["Respostas do cliente", "wait", "Cliente", "med", "2026-11-17"]],
  },
  {
    nome: "Aposentadoria por idade", descricao: "Requerimento de aposentadoria por idade no INSS, já concedido.", tipo: "project", modelo: "previdenciario", tom: "green", icone: "check", status: "done",
    tarefas: [["Reunir documentos do cliente", "done"], ["Simular tempo de contribuição", "done"], ["Protocolar requerimento no INSS", "done"], ["Conferir carta de concessão", "done"]],
  },
  {
    nome: "Notificação extrajudicial", descricao: "Notificação a um inquilino sobre aluguéis em atraso.", tipo: "campaign", modelo: "consultivo", tom: "pink", icone: "gift", status: "done", inicio: "2025-11-01", prazo: "2025-11-30",
    objetivo: "Cobrar os aluguéis sem precisar de ação judicial", canais: ["Notificação extrajudicial"],
    entregas: [["Minuta da notificação", true], ["Envio pelo cartório", true], ["Comprovante de entrega", true]],
    tarefas: [["Minuta da notificação", "done", "Minuta"], ["Revisão com o cliente", "done"], ["Envio pelo cartório", "done", "Cartório"], ["Comprovante de entrega", "done"], ["Arquivar a resposta", "done"]],
  },
];

export function criarDadosDeExemplo(hoje = new Date()): ArmazenamentoLocal {
  const dados: ArmazenamentoLocal = { projects: [], campaigns: {}, columns: [], labels: [], tasks: [] };
  const carimbo = hoje.toISOString();
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
      };
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
      dados.tasks.push(tarefa);
    });
    dados.labels.push(...etiquetas.values());
  });

  return dados;
}
