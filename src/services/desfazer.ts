import type { Desfazer } from "@/domain/tipos";
import type { Repositorio } from "@/data/repositorio";
import { sincronizarLembretesAutomaticos, type ContextoPrazos } from "./prazos";

/**
 * Reverte uma ação do agente a partir do que ficou guardado em registro_agente.desfazer.
 * Com `ctx`, as tarefas recriadas ou restauradas também recuperam os lembretes automáticos.
 */
export async function aplicarDesfazer(repo: Repositorio, desfazer: Desfazer, ctx?: ContextoPrazos): Promise<string> {
  switch (desfazer.tipo) {
    case "excluir_tarefas":
      for (const id of desfazer.ids) await repo.excluirTarefa(id).catch(() => undefined);
      return desfazer.ids.length === 1 ? "Tarefa removida." : `${desfazer.ids.length} tarefas removidas.`;

    case "restaurar_tarefas":
      for (const { id, alteracao } of desfazer.tarefas) {
        const tarefa = await repo.atualizarTarefa(id, alteracao);
        if (ctx) await sincronizarLembretesAutomaticos(repo, tarefa, ctx);
      }
      return desfazer.tarefas.length === 1 ? "Tarefa restaurada." : `${desfazer.tarefas.length} tarefas restauradas.`;

    case "recriar_tarefa": {
      const t = desfazer.tarefa;
      const nova = await repo.criarTarefa({
        projectId: t.projectId,
        columnId: t.columnId,
        title: t.title,
        description: t.description,
        dueOn: t.dueOn,
        // Registros gravados antes da etapa 3 não têm estes campos.
        tipo: t.tipo ?? "providencia",
        prazoFatal: t.prazoFatal ?? null,
        contagem: t.contagem ?? null,
        localAudiencia: t.localAudiencia ?? null,
        horarioAudiencia: t.horarioAudiencia ?? null,
        priority: t.priority,
        labelIds: t.labelIds,
        position: t.position,
      });
      const recriada = await repo.atualizarTarefa(nova.id, { checklist: t.checklist, links: t.links, completed: t.completed, completedAt: t.completedAt });
      if (ctx) await sincronizarLembretesAutomaticos(repo, recriada, ctx);
      return "Tarefa recriada.";
    }

    case "excluir_lembretes":
      for (const id of desfazer.ids) await repo.excluirLembrete(id).catch(() => undefined);
      return "Lembrete removido.";

    case "restaurar_lembrete":
      await repo.atualizarLembrete(desfazer.id, desfazer.alteracao);
      return "Lembrete restaurado.";

    case "recriar_lembrete": {
      const l = desfazer.lembrete;
      const novo = await repo.criarLembrete({ texto: l.texto, quando: l.quando, tarefaId: l.tarefaId, projetoId: l.projetoId, origem: l.origem });
      if (l.status !== "pendente") await repo.atualizarLembrete(novo.id, { status: l.status, agendadoEm: l.agendadoEm, enviadoEm: l.enviadoEm });
      return "Lembrete recriado.";
    }

    case "excluir_projeto":
      await repo.excluirProjeto(desfazer.id);
      return "Projeto removido.";
  }
}
