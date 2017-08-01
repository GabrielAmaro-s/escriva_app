import { salvarPreferencias } from "@/services/prazos";
import { esquemaPreferencias } from "../esquemas";
import { lerCorpo, rotaDoUsuario } from "../rotas";

export const dynamic = "force-dynamic";
// server-only, cliente admin e AsyncLocalStorage precisam do runtime Node.js.
export const runtime = "nodejs";

export const GET = rotaDoUsuario(({ repo }) => repo.obterPreferencias());

export const PATCH = rotaDoUsuario(async ({ repo, requisicao }) => salvarPreferencias(repo, await lerCorpo(requisicao, esquemaPreferencias)));
