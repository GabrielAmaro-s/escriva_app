import { criarFeriadoLocal, listarFeriados } from "@/services/prazos";
import { esquemaNovoFeriado } from "../esquemas";
import { lerCorpo, rotaDoUsuario } from "../rotas";

export const dynamic = "force-dynamic";
// server-only, cliente admin e AsyncLocalStorage precisam do runtime Node.js.
export const runtime = "nodejs";

export const GET = rotaDoUsuario(({ repo }) => listarFeriados(repo));

export const POST = rotaDoUsuario(async ({ repo, requisicao }) => criarFeriadoLocal(repo, await lerCorpo(requisicao, esquemaNovoFeriado)));
