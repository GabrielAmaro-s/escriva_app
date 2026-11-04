import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ambientePublico } from "@/config/ambiente";

export const supabaseConfigurado = !ambientePublico.modoLocal;

let cliente: SupabaseClient | null = null;

export function obterSupabaseNavegador(): SupabaseClient {
  if (!supabaseConfigurado) throw new Error("Supabase não configurado.");
  cliente ??= createBrowserClient(ambientePublico.urlSupabase!, ambientePublico.chavePublicavelSupabase!);
  return cliente;
}
