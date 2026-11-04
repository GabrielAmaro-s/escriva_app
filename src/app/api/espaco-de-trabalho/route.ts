import { rotaDoUsuario } from "../rotas";

export const dynamic = "force-dynamic";
// server-only, cliente admin e AsyncLocalStorage precisam do runtime Node.js.
export const runtime = "nodejs";

/** Colunas, tarefas e etiquetas de todos os projetos (Visão geral e Tarefas). */
export const GET = rotaDoUsuario(({ repo }) => repo.obterEspacoDeTrabalho());
