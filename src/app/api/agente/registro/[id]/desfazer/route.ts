import { ambienteServidor } from "@/config/ambiente-servidor";
import { aplicarDesfazer } from "@/services/desfazer";
import { ErroDeEntrada, ErroNaoEncontrado, rotaDoUsuario } from "../../../../rotas";

export const dynamic = "force-dynamic";
// server-only, cliente admin e AsyncLocalStorage precisam do runtime Node.js.
export const runtime = "nodejs";

export const POST = rotaDoUsuario<{ id: string }>(async ({ repo }, { id }) => {
  const registro = await repo.obterRegistroAgente(id);
  if (!registro) throw new ErroNaoEncontrado("Ação do agente não encontrada.");
  if (!registro.desfazer) throw new ErroDeEntrada("Esta ação não pode ser desfeita.");
  if (registro.desfeitoEm) throw new ErroDeEntrada("Esta ação já foi desfeita.");
  const mensagem = await aplicarDesfazer(repo, registro.desfazer, { fuso: ambienteServidor.fusoHorario });
  await repo.marcarRegistroDesfeito(id, new Date().toISOString());
  return { mensagem };
});
