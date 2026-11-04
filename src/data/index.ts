import type { Repositorio } from "./repositorio";
import { criarRepositorioHttp } from "./http/repositorio-http";
import { criarRepositorioLocal } from "./local/repositorio-local";
import { supabaseConfigurado } from "./supabase/cliente";

let repositorio: Repositorio | null = null;

/**
 * Repositório ativo no navegador.
 * Com Supabase, grava pelas rotas /api do servidor (que usam a sessão e o RLS);
 * sem Supabase, fica tudo no próprio navegador.
 */
export function obterRepositorio(): Repositorio {
  repositorio ??= supabaseConfigurado ? criarRepositorioHttp() : criarRepositorioLocal();
  return repositorio;
}

export type { Repositorio };
