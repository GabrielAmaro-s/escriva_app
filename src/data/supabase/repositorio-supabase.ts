import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * O repositório só usa `from(tabela)`. Assim ele aceita tanto o cliente do usuário
 * (com RLS) quanto o cliente filtrado do agente (contexto-agente.ts).
 */
export type ClienteDados = Pick<SupabaseClient, "from">;
import { MARGEM_PADRAO } from "@/domain/prazos";
import { posicaoEntre } from "@/domain/quadro";
import type {
  AlteracaoLembrete,
  AlteracaoTarefa,
  DadosCliente,
  DadosNovaColuna,
  DadosNovaTarefa,
  DadosNovoFeriado,
  DadosNovoLembrete,
  DadosNovoRegistro,
  DadosNovoToken,
  DadosProjeto,
  FiltroLembretes,
  Tom,
} from "@/domain/tipos";
import type { Repositorio } from "../repositorio";
import {
  type LinhaAlteracao,
  type LinhaCliente,
  type LinhaFeriado,
  type LinhaColuna,
  type LinhaContagem,
  type LinhaEtiqueta,
  type LinhaProjeto,
  type LinhaTarefa,
  type LinhaLembrete,
  type LinhaRegistro,
  type LinhaToken,
  COLUNAS_TOKEN,
  deAlteracaoLembrete,
  deAlteracaoTarefa,
  deCampanha,
  deDadosCliente,
  deDadosProjeto,
  deProcesso,
  paraAlteracao,
  paraCliente,
  paraColuna,
  paraFeriado,
  paraEtiqueta,
  paraProjeto,
  paraLembrete,
  paraRegistro,
  paraTarefa,
  paraToken,
} from "./conversores";
import { type ErroDoBanco, traduzirErroDoBanco } from "./erros";

const SELECAO_PROJETO = "*, campaign_details(*), processo_detalhes(*)";

function conferir<T>(resposta: { data: T | null; error: ErroDoBanco | null }): T {
  if (resposta.error) throw traduzirErroDoBanco(resposta.error);
  return resposta.data as T;
}

export function criarRepositorioSupabase(sb: ClienteDados): Repositorio {
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

  async function salvarProcesso(projetoId: string, dados: Partial<DadosProjeto>) {
    if (dados.processo === undefined && dados.kind === undefined) return;
    if (dados.kind === "campaign" || dados.processo === null) {
      conferir(await sb.from("processo_detalhes").delete().eq("project_id", projetoId));
      return;
    }
    if (dados.processo) {
      conferir(await sb.from("processo_detalhes").upsert(deProcesso(projetoId, dados.processo)));
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
      if (dados.kind === "project" && dados.processo) {
        try {
          await salvarProcesso(linha.id, dados);
        } catch (e) {
          // Número repetido: não deixa um processo pela metade (as colunas vão junto, em cascata).
          await sb.from("projects").delete().eq("id", linha.id);
          throw e;
        }
      }

      const projeto = await buscarProjeto(linha.id);
      if (!projeto) throw new Error("Não foi possível carregar o projeto criado.");
      return projeto;
    },

    async atualizarProjeto(id, dados) {
      const alteracao = deDadosProjeto(dados);
      if (Object.keys(alteracao).length) conferir(await sb.from("projects").update(alteracao).eq("id", id));
      await salvarCampanha(id, dados);
      await salvarProcesso(id, dados);
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
            tipo: dados.tipo ?? "providencia",
            prazo_fatal: dados.prazoFatal ?? null,
            contagem: dados.contagem ?? null,
            local_audiencia: dados.localAudiencia ?? null,
            horario_audiencia: dados.horarioAudiencia ?? null,
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

    async listarClientes() {
      return (conferir(await sb.from("clientes").select("*").order("nome")) as LinhaCliente[]).map(paraCliente);
    },

    async criarCliente(dados: DadosCliente) {
      return paraCliente(conferir(await sb.from("clientes").insert(deDadosCliente(dados)).select("*").single()) as LinhaCliente);
    },

    async atualizarCliente(id, dados) {
      return paraCliente(conferir(await sb.from("clientes").update(deDadosCliente(dados)).eq("id", id).select("*").single()) as LinhaCliente);
    },

    async excluirCliente(id) {
      conferir(await sb.from("clientes").delete().eq("id", id));
    },

    async listarLembretes(filtro: FiltroLembretes = {}) {
      let consulta = sb.from("lembretes").select("*");
      if (filtro.status) consulta = consulta.in("status", filtro.status);
      if (filtro.tarefaId) consulta = consulta.eq("tarefa_id", filtro.tarefaId);
      if (filtro.ate) consulta = consulta.lte("quando", filtro.ate);
      return (conferir(await consulta.order("quando")) as LinhaLembrete[]).map(paraLembrete);
    },

    async criarLembrete(dados: DadosNovoLembrete) {
      const linha = conferir(
        await sb
          .from("lembretes")
          .insert({
            texto: dados.texto,
            quando: dados.quando,
            tarefa_id: dados.tarefaId ?? null,
            projeto_id: dados.projetoId ?? null,
            origem: dados.origem ?? "app",
            automatico: dados.automatico ?? null,
          })
          .select("*")
          .single(),
      ) as LinhaLembrete;
      return paraLembrete(linha);
    },

    async atualizarLembrete(id, alteracao: AlteracaoLembrete) {
      const linha = conferir(await sb.from("lembretes").update(deAlteracaoLembrete(alteracao)).eq("id", id).select("*").single()) as LinhaLembrete;
      return paraLembrete(linha);
    },

    async excluirLembrete(id) {
      conferir(await sb.from("lembretes").delete().eq("id", id));
    },

    async listarFeriados() {
      return (conferir(await sb.from("feriados").select("*").order("data")) as LinhaFeriado[]).map(paraFeriado);
    },

    async criarFeriado(dados: DadosNovoFeriado) {
      const linha = conferir(
        await sb
          .from("feriados")
          .insert({ data: dados.data, ate: dados.ate ?? null, tribunal: dados.tribunal ?? null, tipo: dados.tipo ?? "feriado", descricao: dados.descricao })
          .select("*")
          .single(),
      ) as LinhaFeriado;
      return paraFeriado(linha);
    },

    async excluirFeriado(id) {
      conferir(await sb.from("feriados").delete().eq("id", id));
    },

    async listarAlteracoesDaTarefa(tarefaId) {
      const linhas = conferir(
        await sb.from("registro_alteracoes").select("*").eq("entidade", "tarefa").eq("entidade_id", tarefaId).order("criado_em", { ascending: false }),
      ) as LinhaAlteracao[];
      return linhas.map(paraAlteracao);
    },

    async obterPreferencias() {
      const linha = conferir(await sb.from("preferencias").select("margem_prazo_interno").maybeSingle()) as { margem_prazo_interno: number } | null;
      return { margemPrazoInterno: linha?.margem_prazo_interno ?? MARGEM_PADRAO };
    },

    async salvarPreferencias(preferencias) {
      const linha = conferir(
        await sb
          .from("preferencias")
          .upsert({ margem_prazo_interno: preferencias.margemPrazoInterno }, { onConflict: "user_id" })
          .select("margem_prazo_interno")
          .single(),
      ) as { margem_prazo_interno: number };
      return { margemPrazoInterno: linha.margem_prazo_interno };
    },

    async listarTokensAgente() {
      const linhas = conferir(await sb.from("tokens_agente").select(COLUNAS_TOKEN).order("criado_em", { ascending: false })) as LinhaToken[];
      return linhas.map(paraToken);
    },

    async criarTokenAgente(dados: DadosNovoToken) {
      const linha = conferir(
        await sb
          .from("tokens_agente")
          .insert({ nome: dados.nome, escopo: dados.escopo, hash: dados.hash, expira_em: dados.expiraEm })
          .select(COLUNAS_TOKEN)
          .single(),
      ) as LinhaToken;
      return paraToken(linha);
    },

    async atualizarTokenAgente(id, alteracao) {
      const linha: Record<string, unknown> = {};
      if (alteracao.revogadoEm !== undefined) linha.revogado_em = alteracao.revogadoEm;
      if (alteracao.ultimoUsoEm !== undefined) linha.ultimo_uso_em = alteracao.ultimoUsoEm;
      conferir(await sb.from("tokens_agente").update(linha).eq("id", id));
    },

    async listarRegistroAgente(limite) {
      const linhas = conferir(await sb.from("registro_agente").select("*").order("criado_em", { ascending: false }).limit(limite)) as LinhaRegistro[];
      return linhas.map(paraRegistro);
    },

    async obterRegistroAgente(id) {
      const linha = conferir(await sb.from("registro_agente").select("*").eq("id", id).maybeSingle()) as LinhaRegistro | null;
      return linha ? paraRegistro(linha) : null;
    },

    async registrarAtividadeAgente(dados: DadosNovoRegistro) {
      const linha = conferir(
        await sb
          .from("registro_agente")
          .insert({
            token_id: dados.tokenId,
            ferramenta: dados.ferramenta,
            entrada: dados.entrada ?? {},
            resultado: dados.resultado ?? null,
            sucesso: dados.sucesso,
            desfazer: dados.desfazer,
          })
          .select("*")
          .single(),
      ) as LinhaRegistro;
      return paraRegistro(linha);
    },

    async marcarRegistroDesfeito(id, quando) {
      conferir(await sb.from("registro_agente").update({ desfeito_em: quando }).eq("id", id));
    },

    async obterHeartbeatAgente() {
      const linha = conferir(await sb.from("heartbeats_agente").select("ultimo_em").maybeSingle()) as { ultimo_em: string } | null;
      return linha?.ultimo_em ?? null;
    },

    async registrarHeartbeatAgente(quando) {
      conferir(await sb.from("heartbeats_agente").upsert({ ultimo_em: quando }, { onConflict: "user_id" }));
    },
  };
}
