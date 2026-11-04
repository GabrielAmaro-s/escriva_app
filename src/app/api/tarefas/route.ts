import { esquemaNovaTarefa } from "../esquemas";
import { lerCorpo, rotaDoUsuario } from "../rotas";

export const dynamic = "force-dynamic";

export const POST = rotaDoUsuario(async ({ repo, requisicao }) => repo.criarTarefa(await lerCorpo(requisicao, esquemaNovaTarefa)));
