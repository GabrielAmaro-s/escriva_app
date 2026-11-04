import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/data/supabase/server";

/** Recebe o link mágico do e-mail, troca o código por sessão e volta para o app. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }
  return NextResponse.redirect(`${origin}/login`);
}
