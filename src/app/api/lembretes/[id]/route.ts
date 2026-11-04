import { cancelarLembrete, remarcarLembrete } from "@/services/lembretes";
import { esquemaAlteracaoLembrete } from "../../esquemas";
import { lerCorpo, rotaDoUsuario } from "../../rotas";

export const dynamic = "force-dynamic";
// server-only, cliente admin e AsyncLocalStorage precisam do runtime Node.js.
export const runtime = "nodejs";

export const PATCH = rotaDoUsuario<{ id: string }>(async ({ repo, requisicao }, { id }) => {
  const alteracao = await lerCorpo(requisicao, esquemaAlteracaoLembrete);
  if (alteracao.status === "cancelado") return cancelarLembrete(repo, id);
  // Mudar o horário volta para pendente, para o agente agendar de novo.
  if (alteracao.quando) return remarcarLembrete(repo, id, alteracao.quando).then((l) => (alteracao.texto ? repo.atualizarLembrete(id, { texto: alteracao.texto }) : l));
  return repo.atualizarLembrete(id, alteracao);
});

export const DELETE = rotaDoUsuario<{ id: string }>(async ({ repo }, { id }) => {
  await repo.excluirLembrete(id);
});
