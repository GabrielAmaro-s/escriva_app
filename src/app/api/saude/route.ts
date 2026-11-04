import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { ambientePublico } from "@/config/ambiente";
import { obterAmbienteServidor } from "@/config/ambiente-servidor";

export const dynamic = "force-dynamic";

type RespostaSaude = { ok: boolean; modoLocal: boolean; banco: "ok" | "erro"; detalhe?: string };

/** Teste de saúde: o app está de pé e consegue consultar o banco? */
export async function GET() {
  if (ambientePublico.modoLocal) {
    return NextResponse.json<RespostaSaude>({
      ok: true,
      modoLocal: true,
      banco: "erro",
      detalhe: "Modo local: o Supabase não está configurado e os dados ficam no navegador.",
    });
  }

  try {
    // Com a chave secreta a consulta não depende de login; sem ela, a chave publicável
    // ainda prova que o banco responde (o RLS só devolve zero linhas).
    const chave = obterAmbienteServidor().chaveSecretaSupabase ?? ambientePublico.chavePublicavelSupabase!;
    const sb = createClient(ambientePublico.urlSupabase!, chave, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await sb.from("projects").select("id", { head: true, count: "exact" }).limit(1);
    if (error) throw new Error(error.message);
    return NextResponse.json<RespostaSaude>({ ok: true, modoLocal: false, banco: "ok" });
  } catch (e) {
    const detalhe = e instanceof Error ? e.message : "Erro desconhecido ao consultar o banco.";
    return NextResponse.json<RespostaSaude>({ ok: false, modoLocal: false, banco: "erro", detalhe }, { status: 503 });
  }
}
