import "server-only";
import { NextResponse } from "next/server";
import { ambientePublico } from "@/config/ambiente";
import { obterAmbienteServidor } from "@/config/ambiente-servidor";
import type { EscopoToken } from "@/domain/tipos";
import type { RepositorioDjen } from "@/data/repositorio-djen";
import { buscarTokenPorHash, criarRepositorioDjenDoAgente, criarRepositorioDoAgente } from "@/data/supabase/contexto-agente";
import { validarToken } from "@/services/tokens";
import { responderErro } from "../rotas";

// Rotas que a VPS chama durante a captura do DJEN. Autenticação igual à do MCP:
// Authorization: Bearer <token da instância>, que traz o userId. Os dados passam pelo
// repositório do agente (cliente admin com user_id forçado). Nada aqui chama o DJEN.

type Contexto = { repo: RepositorioDjen; userId: string; requisicao: Request; fuso: string };

export function rotaComToken(escopo: EscopoToken, executar: (ctx: Contexto) => Promise<unknown>): (requisicao: Request) => Promise<Response> {
  return async (requisicao) => {
    if (ambientePublico.modoLocal) return NextResponse.json({ erro: "A captura do DJEN precisa do Supabase configurado." }, { status: 503 });
    try {
      const cabecalho = requisicao.headers.get("authorization") ?? "";
      const token = cabecalho.match(/^Bearer\s+(\S+)$/i)?.[1];
      const ambiente = obterAmbienteServidor();
      if (!token || !ambiente.segredoTokens) return NextResponse.json({ erro: "Token inválido." }, { status: 401 });
      const validacao = await validarToken(token, { segredo: ambiente.segredoTokens, buscarPorHash: (hash) => buscarTokenPorHash(hash) });
      if (!validacao.ok) return NextResponse.json({ erro: "Token inválido." }, { status: 401 });
      const t = validacao.token;
      if (escopo === "escrita" && t.escopo !== "escrita") return NextResponse.json({ erro: "Este token só permite leitura." }, { status: 403 });
      await criarRepositorioDoAgente(t.userId)
        .atualizarTokenAgente(t.id, { ultimoUsoEm: new Date().toISOString() })
        .catch((e) => console.error("Não foi possível atualizar o último uso do token:", e));
      const resultado = await executar({ repo: criarRepositorioDjenDoAgente(t.userId), userId: t.userId, requisicao, fuso: ambiente.fusoHorario });
      return NextResponse.json(resultado ?? { ok: true });
    } catch (e) {
      return responderErro(e);
    }
  };
}
