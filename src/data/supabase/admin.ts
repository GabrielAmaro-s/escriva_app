import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ambientePublico } from "@/config/ambiente";
import { obterAmbienteServidor } from "@/config/ambiente-servidor";

let cliente: SupabaseClient | null = null;

/**
 * Cliente com a chave secreta: ignora o RLS. Só para o servidor.
 * Use através de criarRepositorioDoAgente(userId), que força o filtro por usuário,
 * ou para operações sem usuário (validar token, teste de saúde).
 */
export function obterSupabaseAdmin(): SupabaseClient {
  const { chaveSecretaSupabase } = obterAmbienteServidor();
  if (ambientePublico.modoLocal || !ambientePublico.urlSupabase) throw new Error("Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL.");
  if (!chaveSecretaSupabase) throw new Error("Defina SUPABASE_SECRET_KEY no .env.local para usar o servidor do agente.");
  cliente ??= createClient(ambientePublico.urlSupabase, chaveSecretaSupabase, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cliente;
}
