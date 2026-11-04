import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const CHAVE_ANON_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigurado = Boolean(URL_SUPABASE && CHAVE_ANON_SUPABASE);

let cliente: SupabaseClient | null = null;

export function obterSupabaseNavegador(): SupabaseClient {
  if (!supabaseConfigurado) throw new Error("Supabase não configurado.");
  cliente ??= createBrowserClient(URL_SUPABASE!, CHAVE_ANON_SUPABASE!);
  return cliente;
}
