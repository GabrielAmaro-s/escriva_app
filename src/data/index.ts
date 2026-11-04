import type { Repository } from "./repository";
import { createLocalRepository } from "./local/local-repository";
import { getBrowserSupabase, isSupabaseConfigured } from "./supabase/client";
import { createSupabaseRepository } from "./supabase/supabase-repository";

let repo: Repository | null = null;

/** Repositório ativo no navegador: Supabase quando configurado, local caso contrário. */
export function getRepository(): Repository {
  repo ??= isSupabaseConfigured ? createSupabaseRepository(getBrowserSupabase()) : createLocalRepository();
  return repo;
}

export type { Repository };
