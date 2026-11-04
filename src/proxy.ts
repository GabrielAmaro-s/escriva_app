import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Renova a sessão do Supabase a cada requisição e exige login nas páginas do app.
 * No modo local (sem variáveis do Supabase) não faz nada.
 */
export async function proxy(requisicao: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) return NextResponse.next();

  let resposta = NextResponse.next({ request: requisicao });
  const supabase = createServerClient(url, chave, {
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

  const caminho = requisicao.nextUrl.pathname;
  const publico = caminho.startsWith("/login") || caminho.startsWith("/auth");
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
