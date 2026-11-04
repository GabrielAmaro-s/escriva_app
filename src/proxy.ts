import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ambientePublico } from "@/config/ambiente";

/** Rotas que não usam a sessão do navegador: o agente se autentica por token. */
const SEM_SESSAO = ["/api/mcp", "/api/saude"];

/**
 * Renova a sessão do Supabase a cada requisição e exige login nas páginas do app.
 * As rotas /api/* não são redirecionadas: elas mesmas respondem 401 sem login.
 * No modo local (sem variáveis do Supabase) não faz nada.
 */
export async function proxy(requisicao: NextRequest) {
  const caminho = requisicao.nextUrl.pathname;
  if (ambientePublico.modoLocal || SEM_SESSAO.some((c) => caminho.startsWith(c))) return NextResponse.next();

  let resposta = NextResponse.next({ request: requisicao });
  const supabase = createServerClient(ambientePublico.urlSupabase!, ambientePublico.chavePublicavelSupabase!, {
    cookies: {
      getAll: () => requisicao.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => requisicao.cookies.set(name, value));
        resposta = NextResponse.next({ request: requisicao });
        lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user: usuario },
  } = await supabase.auth.getUser();

  const publico = caminho.startsWith("/login") || caminho.startsWith("/auth") || caminho.startsWith("/api/");
  if (!usuario && !publico) {
    const login = requisicao.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }
  return resposta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
