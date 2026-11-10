import { NextResponse, type NextRequest } from "next/server";
import { obterSupabaseServidor } from "@/data/supabase/servidor";

// server-only (sessão do Supabase) precisa do runtime Node.js.
export const runtime = "nodejs";

/** Tipos de link aceitos com token_hash: só os de entrar na conta. */
const TIPOS_DE_LOGIN = new Set(["magiclink", "email"]);

/**
 * Recebe o link mágico e volta para o app com a sessão nos cookies. Aceita dois formatos:
 * - ?code=...: o fluxo PKCE do login pela tela, que só funciona no mesmo navegador que pediu o link;
 * - ?token_hash=...&type=magiclink: o formato recomendado para SSR. Funciona em qualquer navegador
 *   e serve para links gerados pelo admin (generateLink, campo properties.hashed_token).
 */
export async function GET(requisicao: NextRequest) {
  const { searchParams, origin } = new URL(requisicao.url);
  const codigo = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type");

  if (codigo) {
    const supabase = await obterSupabaseServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(`${origin}/`);
  } else if (tokenHash && tipo && TIPOS_DE_LOGIN.has(tipo)) {
    const supabase = await obterSupabaseServidor();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo as "magiclink" | "email" });
    if (!error) return NextResponse.redirect(`${origin}/`);
  }
  return NextResponse.redirect(`${origin}/login`);
}
