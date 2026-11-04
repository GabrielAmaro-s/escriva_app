import { DEFAULT_COLUMNS, newId } from "@/domain/board";
import type { BoardColumn, ColumnKind, Label, ProjectIcon, ProjectStatus, Task, TaskPriority, Tone } from "@/domain/types";
import type { Store } from "./local-repository";

// Dados de exemplo do modo local, os mesmos do protótipo de design.
// As datas são relativas ao dia de hoje para o exemplo continuar fazendo sentido.

const DESIGN_TODAY = Date.UTC(2026, 10, 4);

/** Converte uma data do protótipo (base 4/11/2026) para a mesma distância a partir de hoje. */
function shift(iso: string | undefined): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const offset = Math.round((Date.UTC(y, m - 1, d) - DESIGN_TODAY) / 86_400_000);
  const t = new Date();
  t.setDate(t.getDate() + offset);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

const TAG_TONE: Record<string, Tone> = {
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

const KIND: Record<string, ColumnKind> = { todo: "todo", doing: "doing", wait: "waiting", done: "done" };
const PRIO: Record<string, TaskPriority> = { low: "low", med: "medium", high: "high", urgent: "urgent" };

type Row = [title: string, col: string, tags?: string, prio?: string, due?: string, checklist?: [string, number][], desc?: string];

interface SeedProject {
  name: string;
  desc: string;
  kind: "project" | "campaign";
  tone: Tone;
  icon: ProjectIcon;
  status: ProjectStatus;
  due?: string;
  start?: string;
  objective?: string;
  channels?: string[];
  deliv?: [string, boolean][];
  tasks: Row[];
}

const PROJECTS: SeedProject[] = [
  {
    name: "Novo site", desc: "Redesign do site institucional com novo conteúdo e otimização.", kind: "project", tone: "violet", icon: "monitor", status: "active", due: "2026-11-28",
    tasks: [
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
    name: "Campanha de Verão", desc: "Planejamento e execução da campanha de verão nos canais digitais.", kind: "campaign", tone: "red", icon: "megaphone", status: "active", start: "2026-12-01", due: "2027-02-15",
    objective: "Geração de leads", channels: ["Instagram", "YouTube", "Ads"],
    deliv: [["Roteiro dos vídeos", true], ["Peças para o feed", true], ["Landing page", false], ["Plano de mídia paga", false], ["Relatório final", false]],
    tasks: [["Roteiro dos vídeos", "done", "Conteúdo"], ["Peças para o feed", "done", "Social,Design"], ["Landing page da campanha", "doing", "Desenvolvimento", "high", "2026-11-25"], ["Gravar depoimentos", "doing", "Conteúdo", "med", "2026-11-18"], ["Plano de mídia paga", "todo", "Mídia", "med", "2026-11-30"], ["Cronograma de posts", "todo", "Social", "low"], ["Aprovação do cliente", "wait", "Revisão", "med", "2026-11-09"]],
  },
  {
    name: "Novo produto", desc: "Desenvolvimento e lançamento do novo produto.", kind: "project", tone: "blue", icon: "box", status: "paused",
    tasks: [["Definir roadmap", "done", "Planejamento"], ["Protótipo v1", "doing", "Design", "high", "2026-11-15"], ["Pesquisa com usuários", "wait", "Pesquisa"], ["Precificação", "todo", "", "med"]],
  },
  {
    name: "Evento anual", desc: "Organização do evento com palestras, convidados e divulgação.", kind: "project", tone: "green", icon: "calendar", status: "active", due: "2027-03-10",
    tasks: [["Fechar local", "done"], ["Orçamento geral", "done", "Planejamento"], ["Convidar palestrantes", "doing", "Externo", "high", "2026-12-01"], ["Divulgação", "todo", "Social", "med", "2027-01-15"], ["Credenciamento", "todo", "Técnico"], ["Catering", "wait", "Externo", "low", "2027-02-10"]],
  },
  {
    name: "Campanha de lançamento", desc: "Divulgação do novo produto e geração de leads.", kind: "campaign", tone: "amber", icon: "chart", status: "active", start: "2026-11-20", due: "2026-12-05",
    objective: "Lançamento do produto", channels: ["Instagram", "LinkedIn", "E-mail"],
    deliv: [["Teaser nas redes", true], ["Sequência de e-mails", false], ["Press kit", false], ["Post de lançamento", false]],
    tasks: [["Teaser nas redes", "done", "Social"], ["Kit de imagens", "done", "Design"], ["Sequência de e-mails", "doing", "E-mail", "high", "2026-11-14"], ["Post de lançamento", "todo", "Social", "med", "2026-11-20"], ["Press kit", "wait", "Conteúdo", "med", "2026-11-17"]],
  },
  {
    name: "Revisão de processos", desc: "Atualização dos fluxos e documentos internos.", kind: "project", tone: "green", icon: "check", status: "done",
    tasks: [["Mapear fluxos atuais", "done"], ["Revisar documentos", "done"], ["Definir responsáveis", "done"], ["Publicar nova versão", "done"]],
  },
  {
    name: "Campanha Black Friday", desc: "Ações promocionais e aumento de vendas.", kind: "campaign", tone: "pink", icon: "gift", status: "done", start: "2025-11-01", due: "2025-11-30",
    objective: "Aumento de vendas", channels: ["Instagram", "Ads", "E-mail"],
    deliv: [["Banners e criativos", true], ["Cupons e regras", true], ["Disparo de e-mails", true]],
    tasks: [["Banners e criativos", "done", "Design"], ["Cupons e regras", "done"], ["Disparo de e-mails", "done", "E-mail"], ["Relatório de resultados", "done"], ["Retrospectiva", "done"]],
  },
];

export function seedStore(): Store {
  const store: Store = { projects: [], campaigns: {}, columns: [], labels: [], tasks: [] };
  const stamp = new Date().toISOString();

  PROJECTS.forEach((sp, pi) => {
    const id = newId();
    const campaign = sp.kind === "campaign";
    store.projects.push({
      id,
      name: sp.name,
      description: sp.desc,
      kind: sp.kind,
      status: sp.status,
      color: sp.tone,
      icon: sp.icon,
      dueOn: campaign ? null : shift(sp.due),
      position: (pi + 1) * 1024,
      archivedAt: null,
      createdAt: stamp,
      updatedAt: stamp,
    });
    if (campaign) {
      store.campaigns[id] = {
        objective: sp.objective ?? null,
        startsOn: shift(sp.start),
        endsOn: shift(sp.due),
        channels: sp.channels ?? [],
        deliverables: (sp.deliv ?? []).map(([title, done]) => ({ id: newId(), title, done })),
      };
    }

    const cols: BoardColumn[] = DEFAULT_COLUMNS.map((c, i) => ({ id: newId(), projectId: id, title: c.title, kind: c.kind, position: (i + 1) * 1024 }));
    store.columns.push(...cols);

    const labels = new Map<string, Label>();
    const labelFor = (name: string) => {
      if (!labels.has(name)) labels.set(name, { id: newId(), projectId: id, name, color: TAG_TONE[name] ?? "gray" });
      return labels.get(name)!.id;
    };

    sp.tasks.forEach(([title, col, tags, prio, due, checklist, desc], i) => {
      const column = cols.find((c) => c.kind === KIND[col])!;
      const done = column.kind === "done";
      const task: Task = {
        id: newId(),
        projectId: id,
        columnId: column.id,
        title,
        description: desc ?? null,
        dueOn: shift(due),
        priority: PRIO[prio ?? "low"],
        labelIds: (tags ? tags.split(",") : []).map(labelFor),
        checklist: (checklist ?? []).map(([text, d]) => ({ id: newId(), text, done: Boolean(d) })),
        links: [],
        completed: done,
        completedAt: done ? stamp : null,
        position: (i + 1) * 1024,
        createdAt: stamp,
        updatedAt: stamp,
      };
      if (title === "Desenvolver layout da home") {
        task.links = [
          { id: newId(), url: "", title: "Briefing do projeto" },
          { id: newId(), url: "", title: "Referências de layout" },
        ];
      }
      store.tasks.push(task);
    });
    store.labels.push(...labels.values());
  });

  return store;
}
