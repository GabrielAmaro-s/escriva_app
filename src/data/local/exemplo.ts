import { colunasDoModelo, modeloPadrao, novoId } from "@/domain/quadro";
import type { Coluna, Etiqueta, IconeProjeto, PrioridadeTarefa, StatusProjeto, Tarefa, TipoColuna, Tom } from "@/domain/tipos";
import type { ArmazenamentoLocal } from "./repositorio-local";

// Dados de exemplo do modo local, os mesmos do protótipo de design.
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
  Planejamento: "green",
  Conteúdo: "violet",
  Pesquisa: "green",
  Técnico: "gray",
  Design: "red",
  Desenvolvimento: "blue",
  Revisão: "amber",
  Externo: "blue",
  Home: "blue",
  Social: "pink",
  Mídia: "amber",
  "E-mail": "violet",
};

const TIPO: Record<string, TipoColuna> = { todo: "todo", doing: "doing", wait: "waiting", done: "done" };
const PRIORIDADE: Record<string, PrioridadeTarefa> = { low: "low", med: "medium", high: "high", urgent: "urgent" };

type Linha = [titulo: string, coluna: string, etiquetas?: string, prioridade?: string, prazo?: string, checklist?: [string, number][], descricao?: string];

interface ProjetoDeExemplo {
  nome: string;
  descricao: string;
  tipo: "project" | "campaign";
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
    nome: "Novo site", descricao: "Redesign do site institucional com novo conteúdo e otimização.", tipo: "project", tom: "violet", icone: "monitor", status: "active", prazo: "2026-11-28",
    tarefas: [
      ["Definir estrutura do site", "todo", "Planejamento", "med", "2026-11-28", [["Mapear páginas", 0], ["Definir navegação", 0]]],
      ["Coletar novos conteúdos", "todo", "Conteúdo", "med", "2026-11-12"],
      ["Revisar referências", "todo", "Pesquisa", "low", "", [["Benchmark de 5 sites", 0], ["Organizar no quadro", 0], ["Resumir achados", 0]]],
      ["Ajustar sitemap", "todo", "Técnico", "low"],
      ["Desenvolver layout da home", "doing", "Design,Home", "high", "2026-11-10", [["Definir estrutura do layout", 1], ["Criar proposta visual", 1], ["Validar com o time", 0], ["Ajustar versão final", 0]], "Criar o layout da página inicial com base no briefing aprovado, seguindo a nova identidade visual."],
      ["Implementar novas páginas", "doing", "Desenvolvimento", "med", "2026-11-20", [["Sobre", 1], ["Serviços", 0], ["Contato", 0]]],
      ["Configurar formulários", "doing", "Técnico", "low", "2026-11-24"],
      ["Aprovação do layout", "wait", "Revisão", "high", "2026-11-04"],
      ["Conteúdo final do cliente", "wait", "Externo", "med", "2026-11-06"],
      ["Briefing do projeto", "done"], ["Definir paleta de cores", "done", "Design"], ["Criar wireframes", "done", "Design"], ["Auditoria do site atual", "done", "Pesquisa"], ["Reunião de kickoff", "done"], ["Escolher plataforma", "done", "Técnico"], ["Levantar requisitos", "done", "Planejamento"],
    ],
  },
  {
    nome: "Campanha de Verão", descricao: "Planejamento e execução da campanha de verão nos canais digitais.", tipo: "campaign", tom: "red", icone: "megaphone", status: "active", inicio: "2026-12-01", prazo: "2027-02-15",
    objetivo: "Geração de leads", canais: ["Instagram", "YouTube", "Ads"],
    entregas: [["Roteiro dos vídeos", true], ["Peças para o feed", true], ["Landing page", false], ["Plano de mídia paga", false], ["Relatório final", false]],
    tarefas: [["Roteiro dos vídeos", "done", "Conteúdo"], ["Peças para o feed", "done", "Social,Design"], ["Landing page da campanha", "doing", "Desenvolvimento", "high", "2026-11-25"], ["Gravar depoimentos", "doing", "Conteúdo", "med", "2026-11-18"], ["Plano de mídia paga", "todo", "Mídia", "med", "2026-11-30"], ["Cronograma de posts", "todo", "Social", "low"], ["Aprovação do cliente", "wait", "Revisão", "med", "2026-11-09"]],
  },
  {
    nome: "Novo produto", descricao: "Desenvolvimento e lançamento do novo produto.", tipo: "project", tom: "blue", icone: "box", status: "paused",
    tarefas: [["Definir roadmap", "done", "Planejamento"], ["Protótipo v1", "doing", "Design", "high", "2026-11-15"], ["Pesquisa com usuários", "wait", "Pesquisa"], ["Precificação", "todo", "", "med"]],
  },
  {
    nome: "Evento anual", descricao: "Organização do evento com palestras, convidados e divulgação.", tipo: "project", tom: "green", icone: "calendar", status: "active", prazo: "2027-03-10",
    tarefas: [["Fechar local", "done"], ["Orçamento geral", "done", "Planejamento"], ["Convidar palestrantes", "doing", "Externo", "high", "2026-12-01"], ["Divulgação", "todo", "Social", "med", "2027-01-15"], ["Credenciamento", "todo", "Técnico"], ["Catering", "wait", "Externo", "low", "2027-02-10"]],
  },
  {
    nome: "Campanha de lançamento", descricao: "Divulgação do novo produto e geração de leads.", tipo: "campaign", tom: "amber", icone: "chart", status: "active", inicio: "2026-11-20", prazo: "2026-12-05",
    objetivo: "Lançamento do produto", canais: ["Instagram", "LinkedIn", "E-mail"],
    entregas: [["Teaser nas redes", true], ["Sequência de e-mails", false], ["Press kit", false], ["Post de lançamento", false]],
    tarefas: [["Teaser nas redes", "done", "Social"], ["Kit de imagens", "done", "Design"], ["Sequência de e-mails", "doing", "E-mail", "high", "2026-11-14"], ["Post de lançamento", "todo", "Social", "med", "2026-11-20"], ["Press kit", "wait", "Conteúdo", "med", "2026-11-17"]],
  },
  {
    nome: "Revisão de processos", descricao: "Atualização dos fluxos e documentos internos.", tipo: "project", tom: "green", icone: "check", status: "done",
    tarefas: [["Mapear fluxos atuais", "done"], ["Revisar documentos", "done"], ["Definir responsáveis", "done"], ["Publicar nova versão", "done"]],
  },
  {
    nome: "Campanha Black Friday", descricao: "Ações promocionais e aumento de vendas.", tipo: "campaign", tom: "pink", icone: "gift", status: "done", inicio: "2025-11-01", prazo: "2025-11-30",
    objetivo: "Aumento de vendas", canais: ["Instagram", "Ads", "E-mail"],
    entregas: [["Banners e criativos", true], ["Cupons e regras", true], ["Disparo de e-mails", true]],
    tarefas: [["Banners e criativos", "done", "Design"], ["Cupons e regras", "done"], ["Disparo de e-mails", "done", "E-mail"], ["Relatório de resultados", "done"], ["Retrospectiva", "done"]],
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

    const colunas: Coluna[] = colunasDoModelo(modeloPadrao(pe.tipo)).map((c, i) => ({ id: novoId(), projectId: id, title: c.title, kind: c.kind, position: (i + 1) * 1024 }));
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
      if (titulo === "Desenvolver layout da home") {
        tarefa.links = [
          { id: novoId(), url: "", title: "Briefing do projeto" },
          { id: novoId(), url: "", title: "Referências de layout" },
        ];
      }
      dados.tasks.push(tarefa);
    });
    dados.labels.push(...etiquetas.values());
  });

  return dados;
}
