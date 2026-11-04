import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let client: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) throw new Error("Supabase não configurado.");
  client ??= createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
  return client;
}
