"use client";

import { CalendarBlankIcon, CheckIcon, CheckSquareIcon, DotsThreeIcon, FlagIcon } from "@phosphor-icons/react";
import { forwardRef, type HTMLAttributes } from "react";
import { Pilula } from "@/components/ui/pecas";
import { COR_PRIORIDADE, ROTULO_PRIORIDADE, corDoPrazo, formatarData, progressoDoChecklist } from "@/domain/quadro";
import type { Etiqueta, Tarefa } from "@/domain/tipos";
import { classes } from "@/lib/classes";

interface PropsCartaoTarefa extends HTMLAttributes<HTMLDivElement> {
  tarefa: Tarefa;
  etiquetasPorId: Map<string, Etiqueta>;
  arrastando?: boolean;
  sobreposto?: boolean;
  aoAbrirMenu?: (e: React.MouseEvent) => void;
}

export const CartaoTarefa = forwardRef<HTMLDivElement, PropsCartaoTarefa>(function CartaoTarefa(
  { tarefa, etiquetasPorId, arrastando, sobreposto, aoAbrirMenu, className, ...props },
  ref,
) {
  const concluida = tarefa.completed;
  const etiquetas = concluida ? [] : tarefa.labelIds.map((id) => etiquetasPorId.get(id)).filter((l): l is Etiqueta => Boolean(l));
  const checklist = progressoDoChecklist(tarefa);
  const sinalizada = tarefa.priority !== "low";
  const temMetadados = !concluida && (tarefa.dueOn || checklist.total > 0 || sinalizada);

  return (
    <div
      ref={ref}
      className={classes(
        "flex cursor-grab touch-manipulation flex-col gap-[9px] rounded-[11px] border border-line bg-surface px-3 py-[11px] text-left transition-[border-color,box-shadow,opacity] duration-150 hover:border-line2 hover:shadow-soft active:cursor-grabbing",
        arrastando && "opacity-40",
        sobreposto && "rotate-[1.5deg] cursor-grabbing border-line2 shadow-pop",
        className,
      )}
      {...props}
    >
      {etiquetas.length > 0 && (
        <div className="flex flex-wrap gap-[5px]">
          {etiquetas.map((l) => (
            <Pilula key={l.id} tom={l.color}>
              {l.name}
            </Pilula>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2">
        {concluida && (
          <span className="mt-px grid size-4 shrink-0 place-items-center rounded-full bg-s-green text-on-primary" aria-label="Concluída">
            <CheckIcon size={10} weight="bold" />
          </span>
        )}
        <span className={classes("min-w-0 flex-1 break-words text-[13.5px] font-medium leading-[1.4] tracking-[-0.005em]", concluida && "text-ink3 line-through")}>
          {tarefa.title}
        </span>
        {aoAbrirMenu && (
          <button
            type="button"
            aria-label="Mais opções"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              aoAbrirMenu(e);
            }}
            className="-mr-[5px] -mt-[3px] grid size-6 shrink-0 place-items-center rounded-md border-0 bg-transparent text-ink3 nav:hidden"
          >
            <DotsThreeIcon size={16} />
          </button>
        )}
      </div>

      {temMetadados && (
        <div className="flex items-center gap-3 text-[11.5px] text-ink3">
          {tarefa.dueOn && (
            <span className="inline-flex items-center gap-[5px]" style={{ color: corDoPrazo(tarefa.dueOn, concluida) }}>
              <CalendarBlankIcon size={13} />
              {formatarData(tarefa.dueOn)}
            </span>
          )}
          {checklist.total > 0 && (
            <span className="inline-flex items-center gap-[5px] tabular-nums">
              <CheckSquareIcon size={13} />
              {checklist.feitos}/{checklist.total}
            </span>
          )}
          {sinalizada && (
            <span
              title={`Prioridade ${ROTULO_PRIORIDADE[tarefa.priority].toLowerCase()}`}
              className="ml-auto inline-flex"
              style={{ color: COR_PRIORIDADE[tarefa.priority] }}
            >
              <FlagIcon size={13} weight="fill" />
            </span>
          )}
        </div>
      )}
    </div>
  );
});
