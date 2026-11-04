import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { ambientePublico } from "@/config/ambiente";
import { obterAmbienteServidor } from "@/config/ambiente-servidor";

export const dynamic = "force-dynamic";
// server-only, cliente admin e AsyncLocalStorage precisam do runtime Node.js.
export const runtime = "nodejs";

/** Só estes três campos saem daqui: nada de valores de variáveis, chaves ou erros do banco. */
type RespostaSaude = { ok: boolean; modoLocal: boolean; banco: "ok" | "erro" };

/** Teste de saúde: o app está de pé e consegue consultar o banco? */
export async function GET() {
  if (ambientePublico.modoLocal) {
    // Sem Supabase não há banco para consultar; o app funciona com os dados no navegador.
    return NextResponse.json<RespostaSaude>({ ok: true, modoLocal: true, banco: "erro" });
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
    // O detalhe fica só no log do servidor.
    console.error("Teste de saúde: o banco não respondeu:", e);
    return NextResponse.json<RespostaSaude>({ ok: false, modoLocal: false, banco: "erro" }, { status: 503 });
  }
}
