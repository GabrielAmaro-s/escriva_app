import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Repositorio } from "../repositorio";
import type { TokenGuardado } from "@/services/tokens";
import { obterSupabaseAdmin } from "./admin";
import { paraToken, type LinhaToken } from "./conversores";
import { criarRepositorioSupabase, type ClienteDados } from "./repositorio-supabase";

/**
 * O servidor MCP usa o cliente admin (ignora o RLS), porque o agente não tem sessão
 * no navegador. Para não depender de cada consulta lembrar do filtro, o cliente é
 * embrulhado: toda leitura, alteração e exclusão recebe `user_id = userId`, e toda
 * inserção recebe `user_id: userId` (sobrescrevendo qualquer valor vindo de fora).
 */
export function criarClienteDoUsuario(admin: Pick<SupabaseClient, "from">, userId: string): ClienteDados {
  if (!userId) throw new Error("Contexto do agente sem usuário.");

  const comDono = <T>(valores: T): T => {
    if (Array.isArray(valores)) return valores.map((v) => ({ ...v, user_id: userId })) as T;
    return { ...(valores as object), user_id: userId } as T;
  };
  const semTrocarDono = (valores: Record<string, unknown>) => {
    const { user_id: _ignorado, ...resto } = valores;
    return resto;
  };

  const from = (tabela: string) => {
    const consulta = admin.from(tabela);
    return {
      select: (...args: Parameters<typeof consulta.select>) => consulta.select(...args).eq("user_id", userId),
      insert: (valores: Parameters<typeof consulta.insert>[0], opcoes?: Parameters<typeof consulta.insert>[1]) => consulta.insert(comDono(valores), opcoes),
      upsert: (valores: Parameters<typeof consulta.upsert>[0], opcoes?: Parameters<typeof consulta.upsert>[1]) => consulta.upsert(comDono(valores), opcoes),
      update: (valores: Record<string, unknown>, opcoes?: Parameters<typeof consulta.update>[1]) =>
        consulta.update(semTrocarDono(valores), opcoes).eq("user_id", userId),
      delete: (opcoes?: Parameters<typeof consulta.delete>[0]) => consulta.delete(opcoes).eq("user_id", userId),
    };
  };

  return { from } as unknown as ClienteDados;
}

/** Repositório que o agente usa: dados só da pessoa dona do token. */
export function criarRepositorioDoAgente(userId: string, admin: Pick<SupabaseClient, "from"> = obterSupabaseAdmin()): Repositorio {
  return criarRepositorioSupabase(criarClienteDoUsuario(admin, userId));
}

/**
 * Busca um token pelo hash na tabela inteira. É a única consulta sem filtro de usuário,
 * porque é ela que descobre a quem o token pertence.
 */
export async function buscarTokenPorHash(hash: string, admin: Pick<SupabaseClient, "from"> = obterSupabaseAdmin()): Promise<TokenGuardado | null> {
  const { data, error } = await admin.from("tokens_agente").select("id, user_id, hash, nome, escopo, expira_em, ultimo_uso_em, revogado_em, criado_em").eq("hash", hash).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const linha = data as LinhaToken & { user_id: string; hash: string };
  return { ...paraToken(linha), userId: linha.user_id, hash: linha.hash };
}
