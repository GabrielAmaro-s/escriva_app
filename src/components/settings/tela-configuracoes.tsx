"use client";

import { SignOutIcon } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { CabecalhoPagina, Pagina } from "@/components/ui/pecas";
import { Botao } from "@/components/ui/botao";
import { obterSupabaseNavegador, supabaseConfigurado } from "@/data/supabase/cliente";
import { CORES_DESTAQUE, type CorDestaque, aplicarCorDestaque, lerCorDestaque } from "@/lib/aparencia";
import { classes } from "@/lib/classes";
import { LinhaConfiguracao } from "./linha-configuracao";
import { SecaoAgente } from "./secao-agente";
import { SecaoDados } from "./secao-dados";
import { SecaoPrazos } from "./secao-prazos";

export function TelaConfiguracoes() {
  const { resolvedTheme, setTheme } = useTheme();
  const [destaque, setDestaque] = useState<CorDestaque["id"] | null>(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
    setDestaque(lerCorDestaque());
  }, []);

  const escuro = montado && resolvedTheme === "dark";

  return (
    <Pagina largura={680}>
      <CabecalhoPagina titulo="Configurações" descricao="Ajuste a aparência, os prazos, seus dados e o agente do Tempestivo." />
      <div className="mt-6 rounded-[14px] border border-line bg-surface-raised px-[18px]">
        <LinhaConfiguracao titulo="Modo escuro" dica="Reduz o brilho da interface.">
          <button
            type="button"
            role="switch"
            aria-checked={escuro}
            aria-label="Modo escuro"
            onClick={() => setTheme(escuro ? "light" : "dark")}
            className={classes(
              "flex h-[23px] w-10 shrink-0 rounded-full border-0 p-0.5 transition-colors duration-200",
              escuro ? "justify-end bg-primary" : "justify-start bg-line-forte",
            )}
          >
            <span className="size-[19px] rounded-full bg-on-primary" />
          </button>
        </LinhaConfiguracao>
        <LinhaConfiguracao titulo="Cor de destaque" dica="Botões, seleções e progresso. Petróleo é a cor da marca.">
          <div role="radiogroup" aria-label="Cor de destaque" className="flex gap-2.5">
            {CORES_DESTAQUE.map((c) => {
              const ativa = destaque === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={ativa}
                  aria-label={c.nome}
                  title={c.nome}
                  onClick={() => {
                    aplicarCorDestaque(c.id);
                    setDestaque(c.id);
                  }}
                  // A amostra mostra a cor do tema em uso.
                  style={{ background: escuro ? c.escuro.cor : c.claro.cor }}
                  className={classes("size-6 rounded-full border-2 border-surface-raised p-0", ativa ? "shadow-[0_0_0_2px_var(--ink)]" : "shadow-none")}
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
      <SecaoPrazos />
      <SecaoDados />
      <SecaoAgente />
      {!supabaseConfigurado && (
        <p className="mt-4 text-[12.5px] text-ink-muted">
          Modo local: seus dados ficam salvos só neste navegador. Conecte o Supabase para sincronizar entre dispositivos.
        </p>
      )}
    </Pagina>
  );
}
