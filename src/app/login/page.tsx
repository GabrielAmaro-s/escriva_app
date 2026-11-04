"use client";

import Link from "next/link";
import { useState } from "react";
import { Logotipo } from "@/components/layout/menu-lateral";
import { Botao } from "@/components/ui/botao";
import { CampoTexto, RotuloCampo } from "@/components/ui/campo";
import { obterSupabaseNavegador, supabaseConfigurado } from "@/data/supabase/cliente";

export default function PaginaLogin() {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"parado" | "enviando" | "enviado" | "erro">("parado");
  const [erro, setErro] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEstado("enviando");
    const { error } = await obterSupabaseNavegador().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setErro(error.message);
      setEstado("erro");
    } else setEstado("enviado");
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 text-sm text-ink">
      <div className="w-full max-w-[380px] animate-pop rounded-[18px] border border-line bg-surface p-6 shadow-card">
        <div className="mb-6">
          <Logotipo />
        </div>
        {!supabaseConfigurado ? (
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-bold tracking-[-0.02em]">Login desativado no modo local</h1>
            <p className="text-[13px] text-ink2">Configure as variáveis do Supabase no .env.local para entrar com seu e-mail e sincronizar entre dispositivos.</p>
            <Link href="/" className="mt-2 text-[13px] font-semibold text-primary">
              Continuar no modo local
            </Link>
          </div>
        ) : estado === "enviado" ? (
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-bold tracking-[-0.02em]">Confira seu e-mail</h1>
            <p className="text-[13px] text-ink2">
              Enviamos um link de acesso para <strong className="font-semibold text-ink">{email}</strong>. Abra no mesmo navegador.
            </p>
            <button type="button" onClick={() => setEstado("parado")} className="mt-2 w-fit border-0 bg-transparent p-0 text-[13px] font-semibold text-primary">
              Usar outro e-mail
            </button>
          </div>
        ) : (
          <form onSubmit={enviar} className="flex flex-col gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-[-0.02em]">Entrar</h1>
              <p className="mt-1 text-[13px] text-ink2">Você recebe um link por e-mail, sem senha.</p>
            </div>
            <div>
              <RotuloCampo htmlFor="email">E-mail</RotuloCampo>
              <CampoTexto id="email" type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {estado === "erro" && <p className="text-xs text-s-red">{erro}</p>}
            <Botao variante="primaria" type="submit" disabled={estado === "enviando"}>
              {estado === "enviando" ? "Enviando link…" : "Enviar link de acesso"}
            </Botao>
          </form>
        )}
      </div>
    </main>
  );
}
