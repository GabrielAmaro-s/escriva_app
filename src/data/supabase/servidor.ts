import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ambientePublico } from "@/config/ambiente";

/** Cliente para Server Components e Route Handlers (lê a sessão dos cookies e respeita o RLS). */
export async function obterSupabaseServidor() {
  if (ambientePublico.modoLocal) throw new Error("Supabase não configurado.");
  const biscoitos = await cookies();
  return createServerClient(ambientePublico.urlSupabase!, ambientePublico.chavePublicavelSupabase!, {
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
