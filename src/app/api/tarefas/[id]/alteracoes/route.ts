import { rotaDoUsuario } from "../../../rotas";

export const dynamic = "force-dynamic";
// server-only, cliente admin e AsyncLocalStorage precisam do runtime Node.js.
export const runtime = "nodejs";

/** Histórico do prazo interno e do prazo fatal da tarefa. */
export const GET = rotaDoUsuario<{ id: string }>(({ repo }, { id }) => repo.listarAlteracoesDaTarefa(id));
