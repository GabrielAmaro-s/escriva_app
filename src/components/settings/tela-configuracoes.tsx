"use client";

import { SignOutIcon } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { CabecalhoPagina, Pagina } from "@/components/ui/pecas";
import { Botao } from "@/components/ui/botao";
import { obterSupabaseNavegador, supabaseConfigurado } from "@/data/supabase/cliente";
import { CORES_DESTAQUE, aplicarCorDestaque, lerCorDestaque } from "@/lib/aparencia";
import { classes } from "@/lib/classes";
import { LinhaConfiguracao } from "./linha-configuracao";
import { SecaoDados } from "./secao-dados";

export function TelaConfiguracoes() {
  const { resolvedTheme, setTheme } = useTheme();
  const [destaque, setDestaque] = useState<string | null>(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
    setDestaque(lerCorDestaque().toLowerCase());
  }, []);

  const escuro = montado && resolvedTheme === "dark";

  return (
    <Pagina largura={680}>
      <CabecalhoPagina titulo="Configurações" descricao="Ajuste a aparência do myPlan." />
      <div className="mt-6 rounded-[14px] border border-line bg-surface px-[18px]">
        <LinhaConfiguracao titulo="Modo escuro" dica="Reduz o brilho da interface.">
          <button
            type="button"
            role="switch"
            aria-checked={escuro}
            aria-label="Modo escuro"
            onClick={() => setTheme(escuro ? "light" : "dark")}
            className={classes(
              "flex h-[23px] w-10 shrink-0 rounded-full border-0 p-0.5 transition-colors duration-200",
              escuro ? "justify-end bg-primary" : "justify-start bg-line2",
            )}
          >
            <span className="size-[19px] rounded-full bg-on-primary shadow-[0_1px_2px_var(--shadow-lg)]" />
          </button>
        </LinhaConfiguracao>
        <LinhaConfiguracao titulo="Cor de destaque" dica="Botões, seleções e progresso.">
          <div role="radiogroup" aria-label="Cor de destaque" className="flex gap-2.5">
            {CORES_DESTAQUE.map((c) => {
              const ativa = destaque === c.valor.toLowerCase();
              return (
                <button
                  key={c.valor}
                  type="button"
                  role="radio"
                  aria-checked={ativa}
                  aria-label={c.nome}
                  title={c.nome}
                  onClick={() => {
                    aplicarCorDestaque(c.valor);
                    setDestaque(c.valor.toLowerCase());
                  }}
                  style={{ background: c.valor }}
                  className={classes("size-6 rounded-full border-2 border-surface p-0", ativa ? "shadow-[0_0_0_2px_var(--ink)]" : "shadow-none")}
                />
              );
            })}
          </div>
        </LinhaConfiguracao>
        {supabaseConfigurado && (
          <LinhaConfiguracao titulo="Conta" dica="Sair deste navegador.">
            <Botao
              tamanho="sm"
              onClick={async () => {
                await obterSupabaseNavegador().auth.signOut();
                window.location.href = "/login";
              }}
            >
              <SignOutIcon size={15} />
              Sair
            </Botao>
          </LinhaConfiguracao>
        )}
      </div>
      <SecaoDados />
      {!supabaseConfigurado && (
        <p className="mt-4 text-[12.5px] text-ink3">
          Modo local: seus dados ficam salvos só neste navegador. Conecte o Supabase para sincronizar entre dispositivos.
        </p>
      )}
    </Pagina>
  );
}
