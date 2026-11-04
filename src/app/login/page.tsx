"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
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
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Logo />
        </div>
        {!isSupabaseConfigured ? (
          <div className="flex flex-col gap-3">
            <h1 className="text-xl font-semibold tracking-tight">Login desativado no modo local</h1>
            <p className="text-sm text-ink-2">
              Configure as variáveis do Supabase no arquivo .env.local para entrar com seu e-mail e sincronizar entre dispositivos.
            </p>
            <Link href="/" className="text-sm font-medium text-accent hover:underline">
              Continuar no modo local
            </Link>
          </div>
        ) : state === "sent" ? (
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-semibold tracking-tight">Confira seu e-mail</h1>
            <p className="text-sm text-ink-2">
              Enviamos um link de acesso para <strong className="font-medium text-ink">{email}</strong>. Abra no mesmo navegador.
            </p>
            <button type="button" onClick={() => setState("idle")} className="mt-2 w-fit text-sm text-accent hover:underline">
              Usar outro e-mail
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Entrar</h1>
              <p className="mt-1 text-sm text-ink-2">Você recebe um link por e-mail, sem senha.</p>
            </div>
            <Field label="E-mail">
              <Input type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            {state === "error" && <p className="text-sm text-danger">{error}</p>}
            <Button variant="primary" type="submit" disabled={state === "sending"}>
              {state === "sending" ? "Enviando link" : "Enviar link de acesso"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
