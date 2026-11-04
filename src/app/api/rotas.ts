import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ambientePublico } from "@/config/ambiente";
import type { Repositorio } from "@/data/repositorio";
import { ErroNaoAutenticado, obterRepositorioDoUsuario } from "@/data/supabase/usuario-servidor";

// Utilitários das rotas de servidor que o navegador chama quando há Supabase.

export class ErroDeEntrada extends Error {}
export class ErroNaoEncontrado extends Error {}

type Contexto = { repo: Repositorio; userId: string; requisicao: Request };

/**
 * Envolve uma rota: exige login, entrega o repositório do usuário (com RLS)
 * e transforma erros em respostas JSON com mensagem em português.
 */
export function rotaDoUsuario<P = Record<string, never>>(
  executar: (ctx: Contexto, parametros: P) => Promise<unknown>,
): (requisicao: Request, extra: { params: Promise<P> }) => Promise<Response> {
  return async (requisicao, extra) => {
    if (ambientePublico.modoLocal) {
      return NextResponse.json({ erro: "Modo local: esta rota precisa do Supabase configurado." }, { status: 404 });
    }
    try {
      const { repo, userId } = await obterRepositorioDoUsuario();
      const resultado = await executar({ repo, userId, requisicao }, (await extra?.params) ?? ({} as P));
      if (resultado === undefined) return new NextResponse(null, { status: 204 });
      return NextResponse.json(resultado);
    } catch (e) {
      return responderErro(e);
    }
  };
}

export function responderErro(e: unknown): Response {
  if (e instanceof ErroNaoAutenticado) return NextResponse.json({ erro: e.message }, { status: 401 });
  if (e instanceof ErroDeEntrada) return NextResponse.json({ erro: e.message }, { status: 400 });
  if (e instanceof ErroNaoEncontrado) return NextResponse.json({ erro: e.message }, { status: 404 });
  if (e instanceof z.ZodError) return NextResponse.json({ erro: e.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  const mensagem = e instanceof Error ? e.message : "Algo deu errado no servidor. Tente de novo.";
  return NextResponse.json({ erro: mensagem }, { status: 500 });
}

/** Lê o corpo JSON e valida com zod. */
export async function lerCorpo<T extends z.ZodType>(requisicao: Request, esquema: T): Promise<z.infer<T>> {
  let corpo: unknown;
  try {
    corpo = await requisicao.json();
  } catch {
    throw new ErroDeEntrada("O corpo da requisição precisa ser JSON.");
  }
  const resultado = esquema.safeParse(corpo);
  if (!resultado.success) throw new ErroDeEntrada(resultado.error.issues[0]?.message ?? "Dados inválidos.");
  return resultado.data;
}
