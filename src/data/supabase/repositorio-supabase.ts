import type { SupabaseClient } from "@supabase/supabase-js";
import { posicaoEntre } from "@/domain/quadro";
import type { AlteracaoTarefa, DadosNovaColuna, DadosNovaTarefa, DadosProjeto, Tom } from "@/domain/tipos";
import type { Repositorio } from "../repositorio";
import {
  type LinhaColuna,
  type LinhaContagem,
  type LinhaEtiqueta,
  type LinhaProjeto,
  type LinhaTarefa,
  deAlteracaoTarefa,
  deCampanha,
  deDadosProjeto,
  paraColuna,
  paraEtiqueta,
  paraProjeto,
  paraTarefa,
} from "./conversores";

const SELECAO_PROJETO = "*, campaign_details(*)";

function conferir<T>(resposta: { data: T | null; error: { message: string } | null }): T {
  if (resposta.error) throw new Error(resposta.error.message);
  return resposta.data as T;
}

export function criarRepositorioSupabase(sb: SupabaseClient): Repositorio {
  async function contagensDe(ids?: string[]): Promise<Map<string, LinhaContagem>> {
    let consulta = sb.from("project_task_counts").select("*");
    if (ids) consulta = consulta.in("project_id", ids);
    const linhas = conferir(await consulta) as LinhaContagem[];
    return new Map(linhas.map((l) => [l.project_id, l]));
  }

  async function buscarProjeto(id: string) {
    const linha = conferir(await sb.from("projects").select(SELECAO_PROJETO).eq("id", id).maybeSingle()) as LinhaProjeto | null;
    if (!linha) return null;
    const contagens = await contagensDe([id]);
    return paraProjeto(linha, contagens.get(id));
  }

  async function salvarCampanha(projetoId: string, dados: Partial<DadosProjeto>) {
    if (dados.campaign === undefined && dados.kind === undefined) return;
    if (dados.kind === "project" || dados.campaign === null) {
      conferir(await sb.from("campaign_details").delete().eq("project_id", projetoId));
      return;
    }
    if (dados.campaign) {
      conferir(await sb.from("campaign_details").upsert(deCampanha(projetoId, dados.campaign)));
    }
  }

  return {
    modo: "supabase",

    async listarProjetos() {
      const [linhas, contagens] = await Promise.all([sb.from("projects").select(SELECAO_PROJETO).order("position"), contagensDe()]);
      return (conferir(linhas) as LinhaProjeto[]).map((l) => paraProjeto(l, contagens.get(l.id)));
    },

    async criarProjeto(dados: DadosProjeto, colunas: DadosNovaColuna[]) {
      const primeira = conferir(await sb.from("projects").select("position").order("position").limit(1)) as { position: number }[];
      const linha = conferir(
        await sb
          .from("projects")
          .insert({ ...deDadosProjeto(dados), position: posicaoEntre(null, primeira[0]?.position ?? null) })
          .select("id")
          .single(),
      ) as { id: string };

      conferir(
        await sb
          .from("board_columns")
          .insert(colunas.map((c, i) => ({ project_id: linha.id, title: c.title, kind: c.kind, position: c.position ?? (i + 1) * 1024 }))),
      );
      if (dados.kind === "campaign" && dados.campaign) await salvarCampanha(linha.id, dados);

      const projeto = await buscarProjeto(linha.id);
      if (!projeto) throw new Error("Não foi possível carregar o projeto criado.");
      return projeto;
    },

    async atualizarProjeto(id, dados) {
      const alteracao = deDadosProjeto(dados);
      if (Object.keys(alteracao).length) conferir(await sb.from("projects").update(alteracao).eq("id", id));
      await salvarCampanha(id, dados);
      const projeto = await buscarProjeto(id);
      if (!projeto) throw new Error("Projeto não encontrado.");
      return projeto;
    },

    async excluirProjeto(id) {
      conferir(await sb.from("projects").delete().eq("id", id));
    },

    async obterQuadro(projetoId) {
      const [projeto, colunas, tarefas, etiquetas] = await Promise.all([
        buscarProjeto(projetoId),
        sb.from("board_columns").select("*").eq("project_id", projetoId).order("position"),
        sb.from("tasks").select("*").eq("project_id", projetoId).order("position"),
        sb.from("labels").select("*").eq("project_id", projetoId).order("name"),
      ]);
      if (!projeto) return null;
      return {
        projeto,
        colunas: (conferir(colunas) as LinhaColuna[]).map(paraColuna),
        tarefas: (conferir(tarefas) as LinhaTarefa[]).map(paraTarefa),
        etiquetas: (conferir(etiquetas) as LinhaEtiqueta[]).map(paraEtiqueta),
      };
    },

    async obterEspacoDeTrabalho() {
      const [colunas, tarefas, etiquetas] = await Promise.all([
        sb.from("board_columns").select("*").order("position"),
        sb.from("tasks").select("*").order("position"),
        sb.from("labels").select("*").order("name"),
      ]);
      return {
        colunas: (conferir(colunas) as LinhaColuna[]).map(paraColuna),
        tarefas: (conferir(tarefas) as LinhaTarefa[]).map(paraTarefa),
        etiquetas: (conferir(etiquetas) as LinhaEtiqueta[]).map(paraEtiqueta),
      };
    },

    async criarTarefa(dados: DadosNovaTarefa) {
      const linha = conferir(
        await sb
          .from("tasks")
          .insert({
            project_id: dados.projectId,
            column_id: dados.columnId,
            title: dados.title,
            description: dados.description ?? null,
            due_on: dados.dueOn ?? null,
            priority: dados.priority ?? "medium",
            label_ids: dados.labelIds ?? [],
            position: dados.position ?? 1024,
          })
          .select("*")
          .single(),
      ) as LinhaTarefa;
      return paraTarefa(linha);
    },

    async atualizarTarefa(id, alteracao: AlteracaoTarefa) {
      const linha = conferir(await sb.from("tasks").update(deAlteracaoTarefa(alteracao)).eq("id", id).select("*").single()) as LinhaTarefa;
      return paraTarefa(linha);
    },

    async excluirTarefa(id) {
      conferir(await sb.from("tasks").delete().eq("id", id));
    },

    async criarEtiqueta(projetoId, nome, cor: Tom) {
      const linha = conferir(await sb.from("labels").insert({ project_id: projetoId, name: nome, color: cor }).select("*").single()) as LinhaEtiqueta;
      return paraEtiqueta(linha);
    },

    async excluirEtiqueta(id) {
      conferir(await sb.from("labels").delete().eq("id", id));
    },
  };
}
