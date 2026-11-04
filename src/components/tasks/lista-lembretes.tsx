"use client";

import { BellIcon } from "@phosphor-icons/react";
import { formatarDataHora } from "@/domain/datas";
import type { Lembrete, Projeto } from "@/domain/tipos";
import { classes } from "@/lib/classes";

/** Próximos lembretes (Visão geral). Clicar abre a tarefa ligada, quando houver. */
export function ListaLembretes({
  lembretes,
  projetos,
  aoAbrirTarefa,
  carregando,
}: {
  lembretes: Lembrete[];
  projetos: Map<string, Projeto>;
  aoAbrirTarefa: (id: string) => void;
  carregando?: boolean;
}) {
  const agora = new Date();
  return (
    <ul className="flex flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
      {carregando
        ? Array.from({ length: 2 }, (_, i) => (
            <li key={i} className="flex h-14 items-center border-b border-line px-4 last:border-b-0">
              <span className="h-3 w-1/3 animate-pulse rounded bg-hover" />
            </li>
          ))
        : lembretes.map((l) => {
            const projeto = l.projetoId ? projetos.get(l.projetoId) : undefined;
            const abrir = l.tarefaId ? () => aoAbrirTarefa(l.tarefaId!) : undefined;
            const atrasado = new Date(l.quando) < agora;
            return (
              <li
                key={l.id}
                tabIndex={abrir ? 0 : undefined}
                onClick={abrir}
                onKeyDown={(e) => abrir && e.key === "Enter" && e.target === e.currentTarget && abrir()}
                className={classes("flex items-center gap-3 border-b border-line px-4 py-[11px] last:border-b-0", abrir && "cursor-pointer hover:bg-hover")}
              >
                <span className="grid size-[18px] shrink-0 place-items-center text-ink3" aria-hidden>
                  <BellIcon size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">{l.texto}</p>
                  {projeto && (
                    <p data-tone={projeto.color} className="mt-0.5 flex items-center gap-1.5 text-xs text-ink3">
                      <span className="size-[7px] rounded-full bg-tone" aria-hidden />
                      {projeto.name}
                    </p>
                  )}
                </div>
                <span className="whitespace-nowrap text-xs" style={{ color: atrasado ? "var(--s-amber)" : "var(--ink3)" }}>
                  {formatarDataHora(l.quando, undefined, agora)}
                </span>
              </li>
            );
          })}
      {!carregando && lembretes.length === 0 && <li className="px-5 py-6 text-center text-[13px] text-ink2">Nenhum lembrete marcado.</li>}
    </ul>
  );
}
