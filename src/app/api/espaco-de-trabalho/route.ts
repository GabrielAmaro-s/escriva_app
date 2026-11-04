import { rotaDoUsuario } from "../rotas";

export const dynamic = "force-dynamic";

/** Colunas, tarefas e etiquetas de todos os projetos (Visão geral e Tarefas). */
export const GET = rotaDoUsuario(({ repo }) => repo.obterEspacoDeTrabalho());
