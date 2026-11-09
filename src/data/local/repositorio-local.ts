import { MENSAGEM_CLIENTE_DUPLICADO } from "@/domain/cliente";
import { ErroDeConflito } from "@/domain/erros";
import { MENSAGEM_PROCESSO_DUPLICADO } from "@/domain/processo";
import { novoId, posicaoEntre } from "@/domain/quadro";
import type {
  AlteracaoLembrete,
  AlteracaoTarefa,
  Cliente,
  Coluna,
  DadosCliente,
  DetalhesProcesso,
  DadosNovoLembrete,
  DadosNovoRegistro,
  DadosNovoToken,
  FiltroLembretes,
  Lembrete,
  RegistroAgente,
  TokenAgente,
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

/** clienteId é opcional porque dados salvos antes da etapa 2 não têm o campo. */
export type ProjetoGuardado = Omit<Projeto, "campaign" | "processo" | "clienteId" | "taskCount" | "doneCount"> & { clienteId?: string | null };

/** Formato salvo no navegador. As chaves continuam as mesmas para não perder dados já salvos. */
export interface ArmazenamentoLocal {
  projects: ProjetoGuardado[];
  campaigns: Record<string, DetalhesCampanha>;
  columns: Coluna[];
  labels: Etiqueta[];
  tasks: Tarefa[];
  // Campos novos (opcionais para continuar lendo o que já estava salvo)
  lembretes?: Lembrete[];
  tokens?: (TokenAgente & { hash: string })[];
  registro?: RegistroAgente[];
  heartbeat?: string | null;
  clientes?: Cliente[];
  processos?: Record<string, DetalhesProcesso>;
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
    campaign: p.kind === "campaign" ? hidratarCampanha(dados.campaigns[p.id]) : null,
    clienteId: p.clienteId ?? null,
    processo: p.kind === "project" ? (dados.processos?.[p.id] ?? null) : null,
    taskCount: tarefas.length,
    doneCount: tarefas.filter((t) => t.completed).length,
  };
}

/** Campanhas salvas antes da etapa 2 não têm tipoServico: vale o primeiro canal, como na migração 0004. */
function hidratarCampanha(c: DetalhesCampanha | undefined): DetalhesCampanha | null {
  if (!c) return null;
  return { ...c, tipoServico: c.tipoServico ?? (c.channels[0]?.trim() || null) };
}

const agora = () => new Date().toISOString();

/**
 * Lê o que estiver salvo neste navegador sem criar os dados de exemplo.
 * Devolve null se não houver nada (ou se não estiver no navegador).
 */
export function lerDadosDoNavegador(): ArmazenamentoLocal | null {
  if (typeof window === "undefined") return null;
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as ArmazenamentoLocal) : null;
  } catch {
    return null;
  }
}

/** Depois de importar para a conta, guarda uma cópia com outro nome e esconde o botão de importar. */
export function arquivarDadosDoNavegador() {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return;
    window.localStorage.setItem(`${CHAVE}:importado:${new Date().toISOString()}`, bruto);
    window.localStorage.removeItem(CHAVE);
  } catch {
    // sem armazenamento: nada a arquivar
  }
}

export interface OpcoesRepositorioLocal {
  /** Dados iniciais. Sem eles, lê do navegador (ou cria o exemplo). */
  dados?: ArmazenamentoLocal;
  /** false mantém tudo só em memória (testes e leitura para importação). */
  persistir?: boolean;
}

export function criarRepositorioLocal(opcoes: OpcoesRepositorioLocal = {}): Repositorio {
  const persistir = opcoes.persistir ?? !opcoes.dados;
  let dados: ArmazenamentoLocal | null = opcoes.dados ? structuredClone(opcoes.dados) : null;
  const banco = () => (dados ??= carregar());
  const gravar = () => {
    if (persistir) salvar(banco());
  };

  // As mesmas garantias do banco (índices únicos e chave do cliente), para o modo local se comportar igual.
  const conferirCliente = (s: ArmazenamentoLocal, clienteId: string | null | undefined) => {
    if (clienteId && !(s.clientes ?? []).some((c) => c.id === clienteId)) throw new Error("Cliente não encontrado.");
  };
  const conferirNumero = (s: ArmazenamentoLocal, projetoId: string, processo: DetalhesProcesso | null | undefined) => {
    const numero = processo?.numeroCnj;
    if (!numero) return;
    const repetido = Object.entries(s.processos ?? {}).some(([id, d]) => id !== projetoId && d.numeroCnj === numero && s.projects.some((p) => p.id === id));
    if (repetido) throw new ErroDeConflito(MENSAGEM_PROCESSO_DUPLICADO);
  };
  const conferirDocumento = (s: ArmazenamentoLocal, clienteId: string | null, documento: string | null | undefined) => {
    if (documento && (s.clientes ?? []).some((c) => c.id !== clienteId && c.documento === documento)) throw new ErroDeConflito(MENSAGEM_CLIENTE_DUPLICADO);
  };

  return {
    modo: "local",

    async listarProjetos() {
      const s = banco();
      return structuredClone([...s.projects].sort((a, b) => a.position - b.position).map((p) => hidratar(s, p)));
    },

    async criarProjeto(entrada: DadosProjeto, colunas: DadosNovaColuna[]) {
      const s = banco();
      const id = novoId();
      conferirCliente(s, entrada.clienteId);
      if (entrada.kind === "project") conferirNumero(s, id, entrada.processo);
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
        clienteId: entrada.clienteId ?? null,
        position: posicaoEntre(null, s.projects.length ? primeira : null),
        archivedAt: null,
        createdAt: agora(),
        updatedAt: agora(),
      };
      s.projects.push(projeto);
      if (entrada.kind === "campaign" && entrada.campaign) s.campaigns[id] = structuredClone(entrada.campaign);
      if (entrada.kind === "project" && entrada.processo) (s.processos ??= {})[id] = structuredClone(entrada.processo);
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
      const { campaign, processo, ...resto } = entrada;
      conferirCliente(s, resto.clienteId);
      if ((resto.kind ?? p.kind) === "project") conferirNumero(s, id, processo);
      Object.assign(p, resto, { updatedAt: agora() });
      if (processo !== undefined) {
        if (processo && p.kind === "project") (s.processos ??= {})[id] = structuredClone(processo);
        else delete s.processos?.[id];
      }
      if (p.kind !== "project") delete s.processos?.[id];
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
      s.lembretes = (s.lembretes ?? []).filter((l) => l.projetoId !== id);
      delete s.campaigns[id];
      delete s.processos?.[id];
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
      s.lembretes = (s.lembretes ?? []).filter((l) => l.tarefaId !== id);
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

    async listarClientes() {
      return structuredClone([...(banco().clientes ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
    },

    async criarCliente(dados: DadosCliente) {
      const s = banco();
      conferirDocumento(s, null, dados.documento);
      const cliente: Cliente = { id: novoId(), ...structuredClone(dados), criadoEm: agora(), atualizadoEm: agora() };
      (s.clientes ??= []).push(cliente);
      gravar();
      return structuredClone(cliente);
    },

    async atualizarCliente(id, dados) {
      const s = banco();
      const c = (s.clientes ?? []).find((x) => x.id === id);
      if (!c) throw new Error("Cliente não encontrado.");
      if (dados.documento !== undefined) conferirDocumento(s, id, dados.documento);
      Object.assign(c, structuredClone(dados), { atualizadoEm: agora() });
      gravar();
      return structuredClone(c);
    },

    async excluirCliente(id) {
      const s = banco();
      s.clientes = (s.clientes ?? []).filter((c) => c.id !== id);
      // Como no banco (on delete set null): os processos ficam, sem cliente.
      for (const p of s.projects) if (p.clienteId === id) p.clienteId = null;
      gravar();
    },

    async listarLembretes(filtro: FiltroLembretes = {}) {
      const lista = (banco().lembretes ?? []).filter(
        (l) =>
          (!filtro.status || filtro.status.includes(l.status)) &&
          (!filtro.tarefaId || l.tarefaId === filtro.tarefaId) &&
          (!filtro.ate || l.quando <= filtro.ate),
      );
      return structuredClone([...lista].sort((a, b) => a.quando.localeCompare(b.quando)));
    },

    async criarLembrete(entrada: DadosNovoLembrete) {
      const s = banco();
      const lembrete: Lembrete = {
        id: novoId(),
        tarefaId: entrada.tarefaId ?? null,
        projetoId: entrada.projetoId ?? null,
        texto: entrada.texto,
        quando: entrada.quando,
        status: "pendente",
        origem: entrada.origem ?? "app",
        agendadoEm: null,
        enviadoEm: null,
        criadoEm: agora(),
      };
      (s.lembretes ??= []).push(lembrete);
      gravar();
      return structuredClone(lembrete);
    },

    async atualizarLembrete(id, alteracao: AlteracaoLembrete) {
      const l = (banco().lembretes ?? []).find((x) => x.id === id);
      if (!l) throw new Error("Lembrete não encontrado.");
      Object.assign(l, alteracao);
      gravar();
      return structuredClone(l);
    },

    async excluirLembrete(id) {
      const s = banco();
      s.lembretes = (s.lembretes ?? []).filter((l) => l.id !== id);
      gravar();
    },

    async listarTokensAgente() {
      return structuredClone((banco().tokens ?? []).map(({ hash: _h, ...t }) => t)).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    },

    async criarTokenAgente(entrada: DadosNovoToken) {
      const s = banco();
      const token = { id: novoId(), ...entrada, ultimoUsoEm: null, revogadoEm: null, criadoEm: agora() };
      (s.tokens ??= []).push(token);
      gravar();
      const { hash: _h, ...publico } = token;
      return structuredClone(publico);
    },

    async atualizarTokenAgente(id, alteracao) {
      const t = (banco().tokens ?? []).find((x) => x.id === id);
      if (!t) throw new Error("Token não encontrado.");
      Object.assign(t, alteracao);
      gravar();
    },

    async listarRegistroAgente(limite) {
      // Mais novo primeiro; no empate de horário (mesmo milissegundo), o inserido por último.
      return structuredClone([...(banco().registro ?? [])].reverse().sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, limite));
    },

    async obterRegistroAgente(id) {
      return structuredClone((banco().registro ?? []).find((r) => r.id === id) ?? null);
    },

    async registrarAtividadeAgente(entrada: DadosNovoRegistro) {
      const s = banco();
      const linha: RegistroAgente = { id: novoId(), ...structuredClone(entrada), desfeitoEm: null, criadoEm: agora() };
      (s.registro ??= []).push(linha);
      gravar();
      return structuredClone(linha);
    },

    async marcarRegistroDesfeito(id, quando) {
      const r = (banco().registro ?? []).find((x) => x.id === id);
      if (r) r.desfeitoEm = quando;
      gravar();
    },

    async obterHeartbeatAgente() {
      return banco().heartbeat ?? null;
    },

    async registrarHeartbeatAgente(quando) {
      banco().heartbeat = quando;
      gravar();
    },
  };
}
