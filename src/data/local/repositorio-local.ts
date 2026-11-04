import { novoId, posicaoEntre } from "@/domain/quadro";
import type {
  AlteracaoTarefa,
  Coluna,
  DadosNovaColuna,
  DadosNovaTarefa,
  DadosProjeto,
  DetalhesCampanha,
  Etiqueta,
  Projeto,
  Quadro,
  Tarefa,
  Tom,
} from "@/domain/tipos";
import type { Repositorio } from "../repositorio";
import { criarDadosDeExemplo } from "./exemplo";

/**
 * Repositório no navegador (localStorage). Usado quando o Supabase não está
 * configurado, para experimentar o app sem backend.
 */

const CHAVE = "myplan:v2";

export type ProjetoGuardado = Omit<Projeto, "campaign" | "taskCount" | "doneCount">;

/** Formato salvo no navegador. As chaves continuam as mesmas para não perder dados já salvos. */
export interface ArmazenamentoLocal {
  projects: ProjetoGuardado[];
  campaigns: Record<string, DetalhesCampanha>;
  columns: Coluna[];
  labels: Etiqueta[];
  tasks: Tarefa[];
}

export function armazenamentoVazio(): ArmazenamentoLocal {
  return { projects: [], campaigns: {}, columns: [], labels: [], tasks: [] };
}

function carregar(): ArmazenamentoLocal {
  if (typeof window === "undefined") return armazenamentoVazio();
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (bruto) return JSON.parse(bruto) as ArmazenamentoLocal;
  } catch {
    // dados corrompidos: recomeça com o exemplo
  }
  const exemplo = criarDadosDeExemplo();
  salvar(exemplo);
  return exemplo;
}

function salvar(dados: ArmazenamentoLocal) {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(dados));
  } catch {
    // sem armazenamento disponível: segue em memória
  }
}

function hidratar(dados: ArmazenamentoLocal, p: ProjetoGuardado): Projeto {
  const tarefas = dados.tasks.filter((t) => t.projectId === p.id);
  return {
    ...p,
    campaign: p.kind === "campaign" ? (dados.campaigns[p.id] ?? null) : null,
    taskCount: tarefas.length,
    doneCount: tarefas.filter((t) => t.completed).length,
  };
}

const agora = () => new Date().toISOString();

export function criarRepositorioLocal(): Repositorio {
  let dados: ArmazenamentoLocal | null = null;
  const banco = () => (dados ??= carregar());
  const gravar = () => salvar(banco());

  return {
    modo: "local",

    async listarProjetos() {
      const s = banco();
      return structuredClone([...s.projects].sort((a, b) => a.position - b.position).map((p) => hidratar(s, p)));
    },

    async criarProjeto(entrada: DadosProjeto, colunas: DadosNovaColuna[]) {
      const s = banco();
      const id = novoId();
      const primeira = Math.min(0, ...s.projects.map((p) => p.position));
      const projeto: ProjetoGuardado = {
        id,
        name: entrada.name,
        description: entrada.description,
        kind: entrada.kind,
        status: entrada.status,
        color: entrada.color,
        icon: entrada.icon,
        dueOn: entrada.dueOn,
        position: posicaoEntre(null, s.projects.length ? primeira : null),
        archivedAt: null,
        createdAt: agora(),
        updatedAt: agora(),
      };
      s.projects.push(projeto);
      if (entrada.kind === "campaign" && entrada.campaign) s.campaigns[id] = structuredClone(entrada.campaign);
      colunas.forEach((c, i) =>
        s.columns.push({ id: novoId(), projectId: id, title: c.title, kind: c.kind, position: c.position ?? (i + 1) * 1024 }),
      );
      gravar();
      return structuredClone(hidratar(s, projeto));
    },

    async atualizarProjeto(id, entrada) {
      const s = banco();
      const p = s.projects.find((x) => x.id === id);
      if (!p) throw new Error("Projeto não encontrado.");
      const { campaign, ...resto } = entrada;
      Object.assign(p, resto, { updatedAt: agora() });
      if (campaign !== undefined) {
        if (campaign && p.kind === "campaign") s.campaigns[id] = structuredClone(campaign);
        else delete s.campaigns[id];
      }
      if (p.kind !== "campaign") delete s.campaigns[id];
      gravar();
      return structuredClone(hidratar(s, p));
    },

    async excluirProjeto(id) {
      const s = banco();
      s.projects = s.projects.filter((p) => p.id !== id);
      s.columns = s.columns.filter((c) => c.projectId !== id);
      s.labels = s.labels.filter((l) => l.projectId !== id);
      s.tasks = s.tasks.filter((t) => t.projectId !== id);
      delete s.campaigns[id];
      gravar();
    },

    async obterQuadro(projetoId): Promise<Quadro | null> {
      const s = banco();
      const p = s.projects.find((x) => x.id === projetoId);
      if (!p) return null;
      return structuredClone({
        projeto: hidratar(s, p),
        colunas: s.columns.filter((c) => c.projectId === projetoId),
        tarefas: s.tasks.filter((t) => t.projectId === projetoId),
        etiquetas: s.labels.filter((l) => l.projectId === projetoId),
      });
    },

    async obterEspacoDeTrabalho() {
      const s = banco();
      return structuredClone({ colunas: s.columns, tarefas: s.tasks, etiquetas: s.labels });
    },

    async criarTarefa(entrada: DadosNovaTarefa) {
      const s = banco();
      const coluna = s.columns.find((c) => c.id === entrada.columnId);
      const concluida = coluna?.kind === "done";
      const tarefa: Tarefa = {
        id: novoId(),
        projectId: entrada.projectId,
        columnId: entrada.columnId,
        title: entrada.title,
        description: entrada.description ?? null,
        dueOn: entrada.dueOn ?? null,
        priority: entrada.priority ?? "medium",
        labelIds: entrada.labelIds ?? [],
        checklist: [],
        links: [],
        completed: concluida,
        completedAt: concluida ? agora() : null,
        position: entrada.position ?? 1024,
        createdAt: agora(),
        updatedAt: agora(),
      };
      s.tasks.push(tarefa);
      gravar();
      return structuredClone(tarefa);
    },

    async atualizarTarefa(id, alteracao: AlteracaoTarefa) {
      const s = banco();
      const t = s.tasks.find((x) => x.id === id);
      if (!t) throw new Error("Tarefa não encontrada.");
      Object.assign(t, structuredClone(alteracao), { updatedAt: agora() });
      gravar();
      return structuredClone(t);
    },

    async excluirTarefa(id) {
      const s = banco();
      s.tasks = s.tasks.filter((t) => t.id !== id);
      gravar();
    },

    async criarEtiqueta(projetoId, nome, cor: Tom) {
      const s = banco();
      const etiqueta: Etiqueta = { id: novoId(), projectId: projetoId, name: nome, color: cor };
      s.labels.push(etiqueta);
      gravar();
      return etiqueta;
    },

    async excluirEtiqueta(id) {
      const s = banco();
      s.labels = s.labels.filter((l) => l.id !== id);
      s.tasks.forEach((t) => (t.labelIds = t.labelIds.filter((l) => l !== id)));
      gravar();
    },
  };
}
