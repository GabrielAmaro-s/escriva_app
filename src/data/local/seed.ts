import { DEFAULT_COLUMNS, newId } from "@/domain/board";
import type { BoardColumn, ColorKey, Label, Task, TaskPriority } from "@/domain/types";
import type { Store } from "./local-repository";

function isoIn(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type SeedTask = {
  title: string;
  col: number;
  priority?: TaskPriority;
  due?: number;
  labels?: number[];
  checklist?: [string, boolean][];
  description?: string;
};

/** Dados de exemplo para o primeiro acesso no modo local. */
export function seedStore(): Store {
  const store: Store = { projects: [], campaigns: {}, columns: [], labels: [], tasks: [] };
  const stamp = new Date().toISOString();

  function project(
    name: string,
    description: string,
    color: ColorKey,
    kind: "project" | "campaign",
    status: "active" | "paused" | "done",
    labels: [string, ColorKey][],
    tasks: SeedTask[],
  ) {
    const id = newId();
    store.projects.push({
      id,
      name,
      description,
      kind,
      status,
      color,
      position: store.projects.length * 1024,
      archivedAt: null,
      createdAt: stamp,
      updatedAt: stamp,
    });
    const cols: BoardColumn[] = DEFAULT_COLUMNS.map((c, i) => ({
      id: newId(),
      projectId: id,
      title: c.title,
      kind: c.kind,
      position: (i + 1) * 1024,
    }));
    store.columns.push(...cols);
    const ls: Label[] = labels.map(([n, c]) => ({ id: newId(), projectId: id, name: n, color: c }));
    store.labels.push(...ls);
    tasks.forEach((t, i) => {
      const col = cols[t.col];
      const done = col.kind === "done";
      const task: Task = {
        id: newId(),
        projectId: id,
        columnId: col.id,
        title: t.title,
        description: t.description ?? null,
        dueOn: t.due === undefined ? null : isoIn(t.due),
        priority: t.priority ?? "medium",
        labelIds: (t.labels ?? []).map((n) => ls[n].id),
        checklist: (t.checklist ?? []).map(([text, d]) => ({ id: newId(), text, done: d })),
        links: [],
        completed: done,
        completedAt: done ? stamp : null,
        position: (i + 1) * 1024,
        createdAt: stamp,
        updatedAt: stamp,
      };
      store.tasks.push(task);
    });
    return id;
  }

  const newsletter = project(
    "Lançamento da newsletter",
    "Primeira edição e divulgação para a lista inicial.",
    "ameixa",
    "campaign",
    "active",
    [
      ["Conteúdo", "lavanda"],
      ["Design", "rosa"],
      ["Divulgação", "areia"],
    ],
    [
      { title: "Definir nome e frequência", col: 3, labels: [0] },
      { title: "Escrever a edição de estreia", col: 1, priority: "high", due: 2, labels: [0], checklist: [["Rascunho", true], ["Revisão", false], ["Agendar envio", false]] },
      { title: "Montar arte de capa", col: 0, due: 4, labels: [1] },
      { title: "Post de anúncio no Instagram", col: 0, due: 6, labels: [2] },
      { title: "Aprovação do texto com revisora", col: 2, labels: [0], description: "Enviei o rascunho por e-mail, aguardando retorno." },
    ],
  );
  store.campaigns[newsletter] = {
    objective: "Chegar a 300 inscritos no primeiro mês.",
    startsOn: isoIn(-3),
    endsOn: isoIn(27),
    channels: ["Instagram", "WhatsApp", "E-mail"],
    deliverables: [
      { id: newId(), title: "Edição #1", done: false },
      { id: newId(), title: "3 posts de divulgação", done: false },
      { id: newId(), title: "Página de inscrição", done: true },
    ],
  };

  project(
    "Estudos do semestre",
    "Resumos, revisões e provas organizados por semana.",
    "petroleo",
    "project",
    "active",
    [
      ["Prova", "rosa"],
      ["Resumo", "salvia"],
    ],
    [
      { title: "Resumo do capítulo 4", col: 0, due: 1, labels: [1] },
      { title: "Lista de exercícios 2", col: 1, labels: [1], checklist: [["Questões 1 a 5", true], ["Questões 6 a 10", false]] },
      { title: "Revisão para a prova", col: 0, priority: "urgent", due: 0, labels: [0] },
      { title: "Fichamento do artigo", col: 3, labels: [1] },
      { title: "Montar cronograma", col: 3 },
    ],
  );

  project(
    "Reforma do quarto",
    "Pintura, prateleiras e iluminação nova.",
    "salvia",
    "project",
    "paused",
    [],
    [
      { title: "Orçamento da pintura", col: 2, description: "Dois orçamentos pedidos." },
      { title: "Escolher luminária", col: 0, priority: "low" },
    ],
  );

  project(
    "Portfólio pessoal",
    "Site simples com projetos e contato.",
    "ceu",
    "project",
    "done",
    [],
    [
      { title: "Escolher domínio", col: 3 },
      { title: "Publicar primeira versão", col: 3 },
    ],
  );

  return store;
}
