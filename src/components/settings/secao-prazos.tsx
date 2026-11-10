"use client";

import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Botao, BotaoIcone } from "@/components/ui/botao";
import { Selecao, classeControle } from "@/components/ui/campo";
import { MARGEM_MAXIMA, formatarData } from "@/domain/prazos";
import type { TipoFeriado } from "@/domain/tipos";
import { usePrazos } from "@/hooks/use-prazos";
import { classes } from "@/lib/classes";
import { LinhaConfiguracao } from "./linha-configuracao";

const ROTULO_TIPO_FERIADO: Record<TipoFeriado, string> = {
  feriado: "Feriado",
  suspensao: "Suspensão de prazos",
  expediente_reduzido: "Expediente reduzido ou sistema fora do ar",
};

const classeCampo = classes(classeControle, "h-9 rounded-[9px] px-2.5 text-[13px]");

/** Margem padrão do prazo interno e feriados locais do advogado. */
export function SecaoPrazos() {
  const prazos = usePrazos();
  const [margem, setMargem] = useState(String(prazos.margemPadrao));
  const [data, setData] = useState("");
  const [ate, setAte] = useState("");
  const [tipo, setTipo] = useState<TipoFeriado>("feriado");
  const [tribunal, setTribunal] = useState("");
  const [descricao, setDescricao] = useState("");

  useEffect(() => setMargem(String(prazos.margemPadrao)), [prazos.margemPadrao]);

  const confirmarMargem = () => {
    const n = Number(margem);
    if (!Number.isInteger(n) || n < 0 || n > MARGEM_MAXIMA) return setMargem(String(prazos.margemPadrao));
    if (n !== prazos.margemPadrao) prazos.salvarMargem(n);
  };

  const adicionar = async () => {
    const ok = await prazos.criarFeriado({ data, ate: ate || null, tipo, tribunal: tribunal || null, descricao });
    if (!ok) return;
    setData("");
    setAte("");
    setDescricao("");
  };

  const locais = prazos.feriados.filter((f) => f.userId !== null);
  const tribunaisDaCarga = [...new Set(prazos.feriados.filter((f) => f.userId === null).map((f) => f.tribunal))].join(", ");

  return (
    <>
      <p className="mb-2.5 mt-7 text-xs font-semibold text-ink-muted">Prazos</p>
      <div className="rounded-[14px] border border-line bg-surface-raised px-[18px]">
        <LinhaConfiguracao titulo="Margem do prazo interno" dica="Dias úteis antes do prazo fatal. Dá para mudar em cada prazo.">
          <input
            type="number"
            min={0}
            max={MARGEM_MAXIMA}
            aria-label="Margem do prazo interno em dias úteis"
            value={margem}
            onChange={(e) => setMargem(e.target.value)}
            onBlur={confirmarMargem}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className={classes(classeCampo, "w-20 text-center")}
          />
        </LinhaConfiguracao>

        <div className="border-b border-line py-4 last:border-b-0">
          <p className="text-sm font-semibold">Feriados locais</p>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            Feriados nacionais já entram na conta{tribunaisDaCarga ? `, e também os do ${tribunaisDaCarga}` : ""}. Cadastre aqui os municipais, as suspensões e os
            dias em que o sistema do tribunal ficou fora do ar. Na dúvida, não cadastre: um feriado a mais empurra o vencimento para depois.
          </p>

          {locais.length > 0 && (
            <ul className="mt-3 flex flex-col overflow-hidden rounded-[10px] border border-line">
              {locais.map((f) => (
                <li key={f.id} className="flex items-center gap-2.5 border-b border-line py-2 pl-3 pr-1.5 text-[13px] last:border-b-0">
                  <span className="whitespace-nowrap tabular-nums text-ink-muted">
                    {formatarData(f.data)}
                    {f.ate ? ` a ${formatarData(f.ate)}` : ""}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {f.descricao}
                    <span className="text-ink-muted">
                      {" "}
                      · {ROTULO_TIPO_FERIADO[f.tipo]}
                      {f.tribunal ? ` · só ${f.tribunal}` : ""}
                    </span>
                  </span>
                  <BotaoIcone rotulo={`Excluir ${f.descricao}`} className="size-7 rounded-md text-ink-muted" onClick={() => prazos.excluirFeriado(f.id)}>
                    <TrashIcon size={14} />
                  </BotaoIcone>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2.5 max-[560px]:grid-cols-1">
            <input type="date" aria-label="Data do feriado" value={data} onChange={(e) => setData(e.target.value)} className={classeCampo} />
            <input type="date" aria-label="Até (opcional, para períodos)" title="Até (opcional)" value={ate} min={data || undefined} onChange={(e) => setAte(e.target.value)} className={classeCampo} />
            <Selecao aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoFeriado)}>
              {(Object.keys(ROTULO_TIPO_FERIADO) as TipoFeriado[]).map((t) => (
                <option key={t} value={t}>
                  {ROTULO_TIPO_FERIADO[t]}
                </option>
              ))}
            </Selecao>
            <input
              value={tribunal}
              onChange={(e) => setTribunal(e.target.value.toUpperCase())}
              maxLength={10}
              placeholder="Tribunal (vazio: todos)"
              aria-label="Tribunal (vazio vale para todos)"
              className={classeCampo}
            />
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adicionar()}
              maxLength={120}
              placeholder="Descrição (ex.: Navegantes, Porto Alegre)"
              aria-label="Descrição do feriado"
              className={classes(classeCampo, "col-span-2 max-[560px]:col-span-1")}
            />
          </div>
          <Botao tamanho="sm" className="mt-2.5" onClick={adicionar} disabled={!data || !descricao.trim()}>
            <PlusIcon size={14} weight="bold" />
            Adicionar
          </Botao>
        </div>
      </div>
    </>
  );
}
