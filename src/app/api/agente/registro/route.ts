import { rotaDoUsuario } from "../../rotas";

export const dynamic = "force-dynamic";
// server-only, cliente admin e AsyncLocalStorage precisam do runtime Node.js.
export const runtime = "nodejs";

/** As 20 últimas ações do agente. */
export const GET = rotaDoUsuario(({ repo }) => repo.listarRegistroAgente(20));
