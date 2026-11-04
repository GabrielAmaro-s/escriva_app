import "server-only";
import type { Repositorio } from "../repositorio";
import { criarRepositorioSupabase } from "./repositorio-supabase";
import { obterSupabaseServidor } from "./servidor";

export class ErroNaoAutenticado extends Error {
  constructor() {
    super("Entre na sua conta para continuar.");
  }
}

/**
 * Repositório do usuário logado, com o cliente da sessão (cookies).
 * Toda consulta passa pelo RLS: a pessoa só lê e grava o que é dela.
 */
export async function obterRepositorioDoUsuario(): Promise<{ repo: Repositorio; userId: string }> {
  const sb = await obterSupabaseServidor();
  const {
    data: { user: usuario },
  } = await sb.auth.getUser();
  if (!usuario) throw new ErroNaoAutenticado();
  return { repo: criarRepositorioSupabase(sb), userId: usuario.id };
}
