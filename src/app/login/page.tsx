"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/field";
import { getBrowserSupabase, isSupabaseConfigured } from "@/data/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await getBrowserSupabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setState("error");
    } else setState("sent");
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 text-sm text-ink">
      <div className="w-full max-w-[380px] animate-pop rounded-[18px] border border-line bg-surface p-6 shadow-card">
        <div className="mb-6">
          <Logo />
        </div>
        {!isSupabaseConfigured ? (
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-bold tracking-[-0.02em]">Login desativado no modo local</h1>
            <p className="text-[13px] text-ink2">Configure as variáveis do Supabase no .env.local para entrar com seu e-mail e sincronizar entre dispositivos.</p>
            <Link href="/" className="mt-2 text-[13px] font-semibold text-primary">
              Continuar no modo local
            </Link>
          </div>
        ) : state === "sent" ? (
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-bold tracking-[-0.02em]">Confira seu e-mail</h1>
            <p className="text-[13px] text-ink2">
              Enviamos um link de acesso para <strong className="font-semibold text-ink">{email}</strong>. Abra no mesmo navegador.
            </p>
            <button type="button" onClick={() => setState("idle")} className="mt-2 w-fit border-0 bg-transparent p-0 text-[13px] font-semibold text-primary">
              Usar outro e-mail
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-[-0.02em]">Entrar</h1>
              <p className="mt-1 text-[13px] text-ink2">Você recebe um link por e-mail, sem senha.</p>
            </div>
            <div>
              <FieldLabel htmlFor="email">E-mail</FieldLabel>
              <Input id="email" type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {state === "error" && <p className="text-xs text-s-red">{error}</p>}
            <Button variant="primary" type="submit" disabled={state === "sending"}>
              {state === "sending" ? "Enviando link…" : "Enviar link de acesso"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
