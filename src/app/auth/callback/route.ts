import { NextResponse, type NextRequest } from "next/server";
import { obterSupabaseServidor } from "@/data/supabase/servidor";

// server-only (sessão do Supabase) precisa do runtime Node.js.
export const runtime = "nodejs";

/** Recebe o link mágico do e-mail, troca o código por sessão e volta para o app. */
export async function GET(requisicao: NextRequest) {
  const { searchParams, origin } = new URL(requisicao.url);
  const codigo = searchParams.get("code");
  if (codigo) {
    const supabase = await obterSupabaseServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }
  return NextResponse.redirect(`${origin}/login`);
}
