import type { DadosProjeto, DetalhesCampanha, IconeProjeto, Projeto, StatusProjeto, Tom } from "./tipos";

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

export const ICONES_PROJETO: IconeProjeto[] = ["folder", "monitor", "box", "calendar", "chart", "check", "gift", "megaphone", "star", "target"];

/** Sugestões para o campo channels, que na tela do Consultivo aparece como "Tipo de serviço". */
export const SUGESTOES_DE_CANAIS = ["Contrato", "Parecer", "Notificação extrajudicial", "Inventário extrajudicial"];

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

export function filtrarProjetos(projetos: Projeto[], filtro: FiltroProjetos, busca = ""): Projeto[] {
  const termo = busca.trim().toLowerCase();
  const combina = (p: Projeto) => !termo || `${p.name} ${p.description ?? ""}`.toLowerCase().includes(termo);
  if (filtro === "archived") return projetos.filter((p) => p.archivedAt && combina(p));
  return projetos.filter((p) => !p.archivedAt && (filtro === "all" || p.status === filtro) && combina(p));
}

export function campanhaVazia(): DetalhesCampanha {
  return { objective: null, startsOn: null, endsOn: null, channels: [], deliverables: [] };
}

export function dadosProjetoVazios(tipo: Projeto["kind"] = "project"): DadosProjeto {
  return {
    name: "",
    description: null,
    kind: tipo,
    status: "active",
    color: tipo === "campaign" ? "red" : "violet",
    icon: tipo === "campaign" ? "megaphone" : "folder",
    dueOn: null,
    campaign: tipo === "campaign" ? campanhaVazia() : null,
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
      return { ok: false, erro: "A data de fim precisa ser depois do início." };
    }
    campanha = {
      objective: c.objective?.trim() || null,
      startsOn: c.startsOn || null,
      endsOn: c.endsOn || null,
      channels: c.channels.map((canal) => canal.trim()).filter(Boolean),
      deliverables: c.deliverables.filter((e) => e.title.trim()),
    };
  }

  return {
    ok: true,
    valor: {
      ...dados,
      name: nome,
      description: dados.description?.trim() || null,
      dueOn: dados.kind === "campaign" ? null : dados.dueOn || null,
      campaign: campanha,
    },
  };
}
