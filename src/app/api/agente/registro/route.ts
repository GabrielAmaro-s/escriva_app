import { rotaDoUsuario } from "../../rotas";

export const dynamic = "force-dynamic";

/** As 20 últimas ações do agente. */
export const GET = rotaDoUsuario(({ repo }) => repo.listarRegistroAgente(20));
