"use client";

import { SignOutIcon } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { Page, PageHeader } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { getBrowserSupabase, isSupabaseConfigured } from "@/data/supabase/client";
import { ACCENTS, applyAccent, readAccent } from "@/lib/appearance";
import { cn } from "@/lib/cn";

function Row({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-4 last:border-b-0">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-[12.5px] text-ink2">{hint}</p>
      </div>
      {children}
    </div>
  );
}

export function SettingsView() {
  const { resolvedTheme, setTheme } = useTheme();
  const [accent, setAccent] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setAccent(readAccent().toLowerCase());
  }, []);

  const dark = mounted && resolvedTheme === "dark";

  return (
    <Page width={680}>
      <PageHeader title="Configurações" description="Ajuste a aparência do myPlan." />
      <div className="mt-6 rounded-[14px] border border-line bg-surface px-[18px]">
        <Row title="Modo escuro" hint="Reduz o brilho da interface.">
          <button
            type="button"
            role="switch"
            aria-checked={dark}
            aria-label="Modo escuro"
            onClick={() => setTheme(dark ? "light" : "dark")}
            className={cn("flex h-[23px] w-10 shrink-0 rounded-full border-0 p-0.5 transition-colors duration-200", dark ? "justify-end bg-primary" : "justify-start bg-line2")}
          >
            <span className="size-[19px] rounded-full bg-on-primary shadow-[0_1px_2px_var(--shadow-lg)]" />
          </button>
        </Row>
        <Row title="Cor de destaque" hint="Botões, seleções e progresso.">
          <div role="radiogroup" aria-label="Cor de destaque" className="flex gap-2.5">
            {ACCENTS.map((a) => {
              const on = accent === a.value.toLowerCase();
              return (
                <button
                  key={a.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={a.name}
                  title={a.name}
                  onClick={() => {
                    applyAccent(a.value);
                    setAccent(a.value.toLowerCase());
                  }}
                  style={{ background: a.value }}
                  className={cn("size-6 rounded-full border-2 border-surface p-0", on ? "shadow-[0_0_0_2px_var(--ink)]" : "shadow-none")}
                />
              );
            })}
          </div>
        </Row>
        {isSupabaseConfigured && (
          <Row title="Conta" hint="Sair deste navegador.">
            <Button
              size="sm"
              onClick={async () => {
                await getBrowserSupabase().auth.signOut();
                window.location.href = "/login";
              }}
            >
              <SignOutIcon size={15} />
              Sair
            </Button>
          </Row>
        )}
      </div>
      {!isSupabaseConfigured && (
        <p className="mt-4 text-[12.5px] text-ink3">
          Modo local: seus dados ficam salvos só neste navegador. Conecte o Supabase para sincronizar entre dispositivos.
        </p>
      )}
    </Page>
  );
}
