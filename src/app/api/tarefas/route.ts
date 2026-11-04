import { esquemaNovaTarefa } from "../esquemas";
import { lerCorpo, rotaDoUsuario } from "../rotas";

export const dynamic = "force-dynamic";
// server-only, cliente admin e AsyncLocalStorage precisam do runtime Node.js.
export const runtime = "nodejs";

export const POST = rotaDoUsuario(async ({ repo, requisicao }) => repo.criarTarefa(await lerCorpo(requisicao, esquemaNovaTarefa)));
