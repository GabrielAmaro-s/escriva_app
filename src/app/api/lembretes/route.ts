import type { StatusLembrete } from "@/domain/tipos";
import { criarLembrete, listarLembretes } from "@/services/lembretes";
import { esquemaNovoLembrete } from "../esquemas";
import { lerCorpo, rotaDoUsuario } from "../rotas";

export const dynamic = "force-dynamic";

/** ?status=pendente,agendado&tarefaId=... */
export const GET = rotaDoUsuario(({ repo, requisicao }) => {
  const parametros = new URL(requisicao.url).searchParams;
  const status = parametros.get("status")?.split(",").filter(Boolean) as StatusLembrete[] | undefined;
  return listarLembretes(repo, { status, tarefaId: parametros.get("tarefaId") ?? undefined });
});

export const POST = rotaDoUsuario(async ({ repo, requisicao }) => {
  const dados = await lerCorpo(requisicao, esquemaNovoLembrete);
  return criarLembrete(repo, { ...dados, origem: "app" });
});
