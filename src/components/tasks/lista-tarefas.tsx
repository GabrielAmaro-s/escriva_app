"use client";

import { FlagIcon, GavelIcon } from "@phosphor-icons/react";
import { Marcador } from "@/components/ui/pecas";
import { COR_PRIORIDADE, ROTULO_PRIORIDADE, corDoPrazo, formatarData } from "@/domain/quadro";
import type { Projeto, Tarefa } from "@/domain/tipos";
import { classes } from "@/lib/classes";

/** Lista de tarefas de vários projetos (Visão geral e Tarefas). */
export function ListaTarefas({
  tarefas,
  projetos,
  aoAbrir,
  aoAlternar,
  carregando,
}: {
  tarefas: Tarefa[];
  projetos: Map<string, Projeto>;
  aoAbrir: (id: string) => void;
  aoAlternar: (id: string) => void;
  carregando?: boolean;
}) {
  return (
    <ul className="flex flex-col overflow-hidden rounded-[14px] border border-line bg-surface-raised">
      {carregando
        ? Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="flex h-14 items-center border-b border-line px-4 last:border-b-0">
              <span className="h-3 w-1/2 animate-pulse rounded bg-hover" />
            </li>
          ))
        : tarefas.map((t) => {
            const projeto = projetos.get(t.projectId);
            return (
              <li
                key={t.id}
                tabIndex={0}
                onClick={() => aoAbrir(t.id)}
                onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && aoAbrir(t.id)}
                className="flex cursor-pointer items-center gap-3 border-b border-line px-4 py-[11px] last:border-b-0 hover:bg-hover"
              >
                <button
                  type="button"
                  aria-pressed={t.completed}
                  aria-label={t.completed ? `Reabrir ${t.title}` : `Concluir ${t.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    aoAlternar(t.id);
                  }}
                  className="border-0 bg-transparent p-0"
                >
                  <Marcador marcado={t.completed} formato="redondo" cor="green" tamanho={18} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className={classes("truncate text-[13.5px] font-medium", t.completed && "text-ink-muted line-through")}>{t.title}</p>
                  {projeto && (
                    <p data-tone={projeto.color} className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
                      <span className="size-[7px] rounded-full bg-tone" aria-hidden />
                      {projeto.name}
                    </p>
                  )}
                </div>
                {t.tipo === "audiencia" && <GavelIcon size={13} className="shrink-0 text-ink-muted" aria-label="Audiência" />}
                {t.dueOn && (
                  <span className="whitespace-nowrap text-xs" style={{ color: corDoPrazo(t.dueOn, t.completed) }} title={t.prazoFatal ? "Prazo interno" : undefined}>
                    {formatarData(t.dueOn)}
                  </span>
                )}
                {t.tipo === "prazo" && t.prazoFatal && (
                  <span className={classes("whitespace-nowrap text-xs font-semibold", t.completed ? "text-ink-muted" : "text-fatal")} title="Prazo fatal">
                    Fatal {formatarData(t.prazoFatal)}
                  </span>
                )}
                <span
                  className="inline-flex w-3.5"
                  style={{ color: COR_PRIORIDADE[t.priority], opacity: t.priority === "low" ? 0 : 1 }}
                  title={`Prioridade ${ROTULO_PRIORIDADE[t.priority].toLowerCase()}`}
                >
                  <FlagIcon size={13} weight="fill" />
                </span>
              </li>
            );
          })}
      {!carregando && tarefas.length === 0 && (
        <li className="px-5 py-11 text-center text-[13.5px] text-ink-muted">
          <p className="mb-1 font-semibold text-ink">Tudo em dia</p>
          Nenhuma tarefa aqui por enquanto.
        </li>
      )}
    </ul>
  );
}
