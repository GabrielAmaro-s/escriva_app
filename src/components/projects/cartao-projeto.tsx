"use client";

import { CalendarBlankIcon, DotsThreeIcon, LockSimpleIcon, UserIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { BarraProgresso, BlocoTom, SeloStatus } from "@/components/ui/pecas";
import { useMenuDeContexto } from "@/components/ui/menu-contexto";
import { ROTULO_AREA, formatarNumeroCnj } from "@/domain/processo";
import { formatarData } from "@/domain/quadro";
import { calcularProgresso, prazoDoProjeto } from "@/domain/projeto";
import type { Projeto } from "@/domain/tipos";
import { useClientes } from "@/hooks/use-clientes";
import { useInterfaceProjeto } from "./interface-projeto";

export function CartaoProjeto({ projeto }: { projeto: Projeto }) {
  const router = useRouter();
  const abrirMenu = useMenuDeContexto();
  const { acoesDe } = useInterfaceProjeto();
  const { nomeDoCliente } = useClientes();
  const cliente = nomeDoCliente(projeto.clienteId);
  const d = projeto.processo;
  const pct = calcularProgresso(projeto);
  const prazo = prazoDoProjeto(projeto);
  const mostrarPrazo = prazo && projeto.status !== "done";
  const abrir = () => router.push(`/projetos/${projeto.id}`);
  const menu = (e: React.MouseEvent | React.KeyboardEvent) => abrirMenu(e, acoesDe(projeto));

  return (
    <article
      tabIndex={0}
      aria-label={projeto.name}
      onClick={abrir}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) abrir();
      }}
      onContextMenu={menu}
      className="flex cursor-pointer flex-col rounded-[14px] border border-line bg-surface-raised p-4 transition-[border-color,box-shadow] duration-150 hover:border-line-forte"
    >
      <div className="flex items-start justify-between">
        <BlocoTom tom={projeto.color} icone={projeto.icon} />
        <div className="flex items-center gap-1">
          <SeloStatus status={projeto.status} arquivado={Boolean(projeto.archivedAt)} />
          <button
            type="button"
            aria-label="Mais opções"
            onClick={menu}
            className="grid size-[26px] place-items-center rounded-[7px] border-0 bg-transparent text-ink-muted hover:bg-hover hover:text-ink"
          >
            <DotsThreeIcon size={16} weight="bold" />
          </button>
        </div>
      </div>
      <h3 className="mt-3.5 text-[15px] font-semibold tracking-[-0.01em]">{projeto.name}</h3>
      {(cliente || d?.numeroCnj || d?.area || d?.segredoJustica) && (
        <div className="mt-1 flex flex-col gap-0.5 text-xs text-ink-muted">
          {cliente && (
            <span className="flex items-center gap-1.5">
              <UserIcon size={13} className="shrink-0" />
              <span className="truncate">{cliente}</span>
            </span>
          )}
          {(d?.numeroCnj || d?.area || d?.segredoJustica) && (
            <span className="flex flex-wrap items-center gap-x-2 text-ink-muted">
              {d?.numeroCnj && <span className="dado">{formatarNumeroCnj(d.numeroCnj)}</span>}
              {d?.area && <span>{ROTULO_AREA[d.area]}</span>}
              {d?.segredoJustica && (
                <span className="inline-flex items-center gap-1" title="Segredo de justiça">
                  <LockSimpleIcon size={12} />
                  Segredo
                </span>
              )}
            </span>
          )}
        </div>
      )}
      <p className="mt-1 line-clamp-2 min-h-[38px] text-[12.5px] leading-normal text-ink-muted">{projeto.description}</p>
      <div className="mt-auto flex justify-between pt-3.5 text-xs text-ink-muted">
        <span>
          {projeto.doneCount} de {projeto.taskCount} tarefas
        </span>
        <span className="font-semibold text-ink">{pct}%</span>
      </div>
      <div className="mt-[7px]">
        <BarraProgresso valor={pct} tom={projeto.color} concluido={projeto.status === "done"} />
      </div>
      {mostrarPrazo && (
        <p className="mt-3.5 flex items-center gap-[7px] text-xs text-ink-muted">
          <CalendarBlankIcon size={14} />
          Até {formatarData(prazo)}
        </p>
      )}
    </article>
  );
}
