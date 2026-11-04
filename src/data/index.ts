import type { Repositorio } from "./repositorio";
import { criarRepositorioLocal } from "./local/repositorio-local";
import { obterSupabaseNavegador, supabaseConfigurado } from "./supabase/cliente";
import { criarRepositorioSupabase } from "./supabase/repositorio-supabase";

let repositorio: Repositorio | null = null;

/** Repositório ativo no navegador: Supabase quando configurado, local caso contrário. */
export function obterRepositorio(): Repositorio {
  repositorio ??= supabaseConfigurado ? criarRepositorioSupabase(obterSupabaseNavegador()) : criarRepositorioLocal();
  return repositorio;
}

export type { Repositorio };
