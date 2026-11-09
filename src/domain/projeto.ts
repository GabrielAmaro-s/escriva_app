import { detalhesProcessoVazios, normalizarNumeroCnj, validarDetalhesProcesso } from "./processo";
import type { AreaProcesso, DadosProjeto, DetalhesCampanha, DetalhesProcesso, IconeProjeto, Projeto, StatusProjeto, Tom } from "./tipos";

export const ROTULO_STATUS: Record<StatusProjeto, string> = {
  active: "Ativo",
  paused: "Pausado",
  done: "Concluído",
};

/** Tom do selo de status. */
export const TOM_STATUS: Record<StatusProjeto, Tom> = {
  active: "green",
  paused: "amber",
  done: "blue",
};

export const TONS_PROJETO: Tom[] = ["violet", "blue", "green", "amber", "red", "pink"];
const TODOS_OS_TONS: Tom[] = [...TONS_PROJETO, "gray"];

export const NOME_DO_TOM: Record<Tom, string> = {
  violet: "Violeta",
  blue: "Azul",
  green: "Verde",
  amber: "Âmbar",
  red: "Vermelho",
  pink: "Rosa",
  gray: "Cinza",
};

export const ICONES_PROJETO: IconeProjeto[] = ["folder", "monitor", "box", "calendar", "chart", "check", "gift", "megaphone", "star", "target", "scales", "briefcase", "gavel", "file"];

/** Sugestões para o "Tipo de serviço" do caso consultivo (campo tipoServico). */
export const SUGESTOES_DE_SERVICO = ["Contrato", "Parecer", "Notificação extrajudicial", "Inventário extrajudicial"];

export function ehTom(valor: unknown): valor is Tom {
  return typeof valor === "string" && (TODOS_OS_TONS as string[]).includes(valor);
}

export function ehIconeProjeto(valor: unknown): valor is IconeProjeto {
  return typeof valor === "string" && (ICONES_PROJETO as string[]).includes(valor);
}

export function calcularProgresso(projeto: Pick<Projeto, "taskCount" | "doneCount">): number {
  if (projeto.taskCount === 0) return 0;
  return Math.round((projeto.doneCount / projeto.taskCount) * 100);
}

/** Data final que vale para o projeto: prazo do projeto ou fim da campanha. */
export function prazoDoProjeto(p: Pick<Projeto, "kind" | "dueOn" | "campaign">): string | null {
  return p.kind === "campaign" ? (p.campaign?.endsOn ?? p.dueOn) : p.dueOn;
}

export type FiltroProjetos = "all" | StatusProjeto | "archived";

export interface OpcoesBusca {
  /** Nome do cliente pelo id, para a busca também achar pelo cliente. */
  nomeDoCliente?: (id: string) => string | undefined;
  /** Só processos desta área (casos consultivos ficam de fora). */
  area?: AreaProcesso | null;
}

/** Busca por nome, descrição, cliente, número do processo (com ou sem pontuação) ou parte contrária. */
export function filtrarProjetos(projetos: Projeto[], filtro: FiltroProjetos, busca = "", opcoes: OpcoesBusca = {}): Projeto[] {
  const termo = busca.trim().toLowerCase();
  const digitos = normalizarNumeroCnj(termo);
  const combina = (p: Projeto) => {
    if (!termo) return true;
    const cliente = p.clienteId ? (opcoes.nomeDoCliente?.(p.clienteId) ?? "") : "";
    const textos = `${p.name} ${p.description ?? ""} ${cliente} ${p.processo?.parteContraria ?? ""}`.toLowerCase();
    if (textos.includes(termo)) return true;
    return digitos.length >= 4 && Boolean(p.processo?.numeroCnj?.includes(digitos));
  };
  const naArea = (p: Projeto) => !opcoes.area || p.processo?.area === opcoes.area;
  if (filtro === "archived") return projetos.filter((p) => p.archivedAt && combina(p) && naArea(p));
  return projetos.filter((p) => !p.archivedAt && (filtro === "all" || p.status === filtro) && combina(p) && naArea(p));
}

export function campanhaVazia(): DetalhesCampanha {
  return { objective: null, startsOn: null, endsOn: null, channels: [], deliverables: [], tipoServico: null };
}

export function dadosProjetoVazios(tipo: Projeto["kind"] = "project"): DadosProjeto {
  return {
    name: "",
    description: null,
    kind: tipo,
    status: "active",
    color: tipo === "campaign" ? "red" : "violet",
    icon: tipo === "campaign" ? "briefcase" : "scales",
    dueOn: null,
    campaign: tipo === "campaign" ? campanhaVazia() : null,
    clienteId: null,
    // A área inicial acompanha o modelo padrão de processo (Cível/JEC).
    processo: tipo === "campaign" ? null : detalhesProcessoVazios("civel"),
  };
}

export function paraDadosProjeto(p: Projeto): DadosProjeto {
  return {
    name: p.name,
    description: p.description,
    kind: p.kind,
    status: p.status,
    color: p.color,
    icon: p.icon,
    dueOn: p.dueOn,
    campaign: p.campaign,
    clienteId: p.clienteId,
    processo: p.kind === "project" ? (p.processo ?? detalhesProcessoVazios()) : null,
  };
}

/** Normaliza e valida a entrada antes de chegar ao repositório. */
export function validarDadosProjeto(dados: DadosProjeto): { ok: true; valor: DadosProjeto } | { ok: false; erro: string } {
  const nome = dados.name.trim();
  if (!nome) return { ok: false, erro: "Dê um nome para continuar." };
  if (nome.length > 120) return { ok: false, erro: "O nome pode ter até 120 caracteres." };

  let campanha: DetalhesCampanha | null = null;
  if (dados.kind === "campaign") {
    const c = dados.campaign ?? campanhaVazia();
    if (c.startsOn && c.endsOn && c.endsOn < c.startsOn) {
      return { ok: false, erro: "O prazo de entrega precisa ser depois da data de recebimento." };
    }
    const channels = c.channels.map((canal) => canal.trim()).filter(Boolean);
    // Sem tipo de serviço, vale o primeiro canal (a mesma regra da migração 0004).
    const tipoServico = c.tipoServico?.trim() || channels[0] || null;
    if (tipoServico && tipoServico.length > 80) return { ok: false, erro: "O tipo de serviço pode ter até 80 caracteres." };
    campanha = {
      objective: c.objective?.trim() || null,
      startsOn: c.startsOn || null,
      endsOn: c.endsOn || null,
      channels,
      deliverables: c.deliverables.filter((e) => e.title.trim()),
      tipoServico,
    };
  }

  // Detalhes do processo: ausentes ficam ausentes (não mexe); caso consultivo nunca tem.
  let processo: DetalhesProcesso | null | undefined = dados.processo;
  if (dados.kind === "campaign") processo = dados.processo === undefined ? undefined : null;
  else if (dados.processo) {
    const r = validarDetalhesProcesso(dados.processo);
    if (!r.ok) return r;
    processo = r.valor;
  }

  const valor: DadosProjeto = {
    ...dados,
    name: nome,
    description: dados.description?.trim() || null,
    dueOn: dados.kind === "campaign" ? null : dados.dueOn || null,
    campaign: campanha,
  };
  if (processo !== undefined) valor.processo = processo;
  else delete valor.processo;
  if (dados.clienteId !== undefined) valor.clienteId = dados.clienteId || null;
  return { ok: true, valor };
}
