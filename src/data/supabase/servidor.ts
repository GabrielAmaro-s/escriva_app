import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { CHAVE_ANON_SUPABASE, URL_SUPABASE } from "./cliente";

/** Cliente para Server Components e Route Handlers (lê a sessão dos cookies). */
export async function obterSupabaseServidor() {
  const biscoitos = await cookies();
  return createServerClient(URL_SUPABASE!, CHAVE_ANON_SUPABASE!, {
    cookies: {
      getAll: () => biscoitos.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => biscoitos.set(name, value, options));
        } catch {
          // chamado a partir de um Server Component: o proxy renova a sessão
        }
      },
    },
  });
}
