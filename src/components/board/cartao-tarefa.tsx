"use client";

import { BellIcon, CalendarBlankIcon, CheckIcon, CheckSquareIcon, DotsThreeIcon, FlagIcon, GavelIcon, WarningOctagonIcon } from "@phosphor-icons/react";
import { forwardRef, type HTMLAttributes } from "react";
import { Pilula } from "@/components/ui/pecas";
import { formatarDataHora } from "@/domain/datas";
import { COR_PRIORIDADE, ROTULO_PRIORIDADE, corDoPrazo, formatarData, progressoDoChecklist } from "@/domain/quadro";
import type { Etiqueta, Tarefa } from "@/domain/tipos";
import { classes } from "@/lib/classes";

interface PropsCartaoTarefa extends HTMLAttributes<HTMLDivElement> {
  tarefa: Tarefa;
  etiquetasPorId: Map<string, Etiqueta>;
  arrastando?: boolean;
  sobreposto?: boolean;
  /** Mostra o sino quando a tarefa tem um lembrete que ainda vai tocar. */
  temLembrete?: boolean;
  aoAbrirMenu?: (e: React.MouseEvent) => void;
}

export const CartaoTarefa = forwardRef<HTMLDivElement, PropsCartaoTarefa>(function CartaoTarefa(
  { tarefa, etiquetasPorId, arrastando, sobreposto, temLembrete, aoAbrirMenu, className, ...props },
  ref,
) {
  const concluida = tarefa.completed;
  const etiquetas = concluida ? [] : tarefa.labelIds.map((id) => etiquetasPorId.get(id)).filter((l): l is Etiqueta => Boolean(l));
  const checklist = progressoDoChecklist(tarefa);
  const sinalizada = tarefa.priority !== "low";
  const fatal = tarefa.tipo === "prazo" ? tarefa.prazoFatal : null;
  const audiencia = tarefa.tipo === "audiencia" ? tarefa.horarioAudiencia : null;
  const temMetadados = !concluida && (tarefa.dueOn || fatal || audiencia || checklist.total > 0 || sinalizada || temLembrete);

  return (
    <div
      ref={ref}
      className={classes(
        "flex cursor-grab touch-manipulation flex-col gap-[9px] rounded-[11px] border border-line bg-surface-raised px-3 py-[11px] text-left transition-[border-color,box-shadow,opacity] duration-150 hover:border-line-forte active:cursor-grabbing",
        arrastando && "opacity-40",
        sobreposto && "rotate-[1.5deg] cursor-grabbing border-line-forte shadow-flutuante",
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
          <span className="mt-px grid size-4 shrink-0 place-items-center rounded-full bg-no-prazo text-on-primary" aria-label="Concluída">
            <CheckIcon size={10} weight="bold" />
          </span>
        )}
        <span className={classes("min-w-0 flex-1 break-words text-[13.5px] font-medium leading-[1.4] tracking-[-0.005em]", concluida && "text-ink-muted line-through")}>
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
            className="-mr-[5px] -mt-[3px] grid size-6 shrink-0 place-items-center rounded-md border-0 bg-transparent text-ink-muted nav:hidden"
          >
            <DotsThreeIcon size={16} />
          </button>
        )}
      </div>

      {temMetadados && (
        <div className="flex items-center gap-3 text-[11.5px] text-ink-muted">
          {tarefa.dueOn && (
            <span
              className="inline-flex items-center gap-[5px]"
              style={{ color: corDoPrazo(tarefa.dueOn, concluida) }}
              title={fatal ? "Prazo interno" : undefined}
            >
              <CalendarBlankIcon size={13} />
              {formatarData(tarefa.dueOn)}
            </span>
          )}
          {fatal && (
            <span className="inline-flex items-center gap-[5px] font-semibold text-fatal" title="Prazo fatal">
              <WarningOctagonIcon size={13} weight="fill" />
              Fatal {formatarData(fatal)}
            </span>
          )}
          {audiencia && (
            <span className="inline-flex items-center gap-[5px]" title="Audiência">
              <GavelIcon size={13} />
              {formatarDataHora(audiencia)}
            </span>
          )}
          {checklist.total > 0 && (
            <span className="inline-flex items-center gap-[5px] tabular-nums">
              <CheckSquareIcon size={13} />
              {checklist.feitos}/{checklist.total}
            </span>
          )}
          {temLembrete && (
            <span className="inline-flex items-center" title="Tem lembrete" aria-label="Tem lembrete">
              <BellIcon size={13} />
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
