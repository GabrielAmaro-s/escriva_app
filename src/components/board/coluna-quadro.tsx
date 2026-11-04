"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PlusIcon } from "@phosphor-icons/react";
import { useState } from "react";
import type { Coluna, Etiqueta, Tarefa, TipoColuna } from "@/domain/tipos";
import { classes } from "@/lib/classes";
import { CartaoTarefa } from "./cartao-tarefa";

const FUNDO_DA_COLUNA: Record<TipoColuna, string> = {
  todo: "bg-col-todo",
  doing: "bg-col-doing",
  waiting: "bg-col-waiting",
  done: "bg-col-done",
};

function TarefaArrastavel({
  tarefa,
  etiquetasPorId,
  aoAbrir,
  aoAbrirMenu,
}: {
  tarefa: Tarefa;
  etiquetasPorId: Map<string, Etiqueta>;
  aoAbrir: () => void;
  aoAbrirMenu: (e: React.MouseEvent) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: tarefa.id });
  return (
    <li>
      <CartaoTarefa
        ref={setNodeRef}
        tarefa={tarefa}
        etiquetasPorId={etiquetasPorId}
        arrastando={isDragging}
        aoAbrirMenu={aoAbrirMenu}
        style={{ transform: CSS.Translate.toString(transform), transition }}
        {...attributes}
        {...listeners}
        aria-roledescription="tarefa arrastável"
        onClick={aoAbrir}
        onContextMenu={aoAbrirMenu}
        onKeyDown={(e) => {
          // Enter abre a tarefa; Espaço pega o cartão para mover com as setas.
          if (e.key === "Enter") return aoAbrir();
          listeners?.onKeyDown?.(e);
        }}
      />
    </li>
  );
}

export function ColunaQuadro({
  coluna,
  tarefas,
  etiquetasPorId,
  arrastando,
  adicionando,
  aoComecarAAdicionar,
  aoPararDeAdicionar,
  aoAbrirTarefa,
  aoAbrirMenuTarefa,
  aoAdicionarTarefa,
}: {
  coluna: Coluna;
  tarefas: Tarefa[];
  etiquetasPorId: Map<string, Etiqueta>;
  arrastando: boolean;
  adicionando: boolean;
  aoComecarAAdicionar: () => void;
  aoPararDeAdicionar: () => void;
  aoAbrirTarefa: (id: string) => void;
  aoAbrirMenuTarefa: (tarefa: Tarefa, e: React.MouseEvent) => void;
  aoAdicionarTarefa: (titulo: string) => Promise<unknown>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });

  return (
    <section
      ref={setNodeRef}
      aria-label={coluna.title}
      className={classes(
        "flex min-w-[262px] flex-[1_1_0] snap-start flex-col gap-2 rounded-[14px] px-2.5 py-3 outline-2 -outline-offset-2 outline-dashed transition-[outline-color] duration-150 max-nav:min-w-[82vw]",
        FUNDO_DA_COLUNA[coluna.kind],
        arrastando && isOver ? "outline-primary-line" : "outline-transparent",
      )}
    >
      <div className="flex items-center gap-2 px-1">
        <h2 className="text-[13.5px] font-semibold">{coluna.title}</h2>
        <span className="text-xs font-medium text-ink2">{tarefas.length}</span>
      </div>

      <button
        type="button"
        onClick={aoComecarAAdicionar}
        className="flex h-8 items-center gap-2 rounded-lg border-0 bg-transparent px-1.5 text-left text-[12.5px] text-ink2 hover:bg-surface hover:text-ink"
      >
        <PlusIcon size={14} weight="bold" />
        Adicionar tarefa
      </button>

      {adicionando && <CriacaoRapida aoAdicionar={aoAdicionarTarefa} aoFechar={aoPararDeAdicionar} />}

      <SortableContext items={tarefas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2">
          {tarefas.map((t) => (
            <TarefaArrastavel
              key={t.id}
              tarefa={t}
              etiquetasPorId={etiquetasPorId}
              aoAbrir={() => aoAbrirTarefa(t.id)}
              aoAbrirMenu={(e) => aoAbrirMenuTarefa(t, e)}
            />
          ))}
        </ul>
      </SortableContext>

      {tarefas.length === 0 && !adicionando && (
        <div className="mt-0.5 rounded-[10px] border border-dashed border-line2 px-3 py-[22px] text-center text-xs leading-normal text-ink3">
          {coluna.kind === "done" ? "Conclua tarefas para vê-las aqui" : "Solte uma tarefa aqui"}
        </div>
      )}
    </section>
  );
}

/** Criação rápida: Enter adiciona e o campo continua aberto para a próxima. */
function CriacaoRapida({ aoAdicionar, aoFechar }: { aoAdicionar: (titulo: string) => Promise<unknown>; aoFechar: () => void }) {
  const [valor, setValor] = useState("");

  const confirmar = async () => {
    const titulo = valor.trim();
    if (!titulo) return aoFechar();
    setValor("");
    await aoAdicionar(titulo);
  };

  return (
    <div className="animate-pop rounded-[10px] border border-primary bg-surface p-2 shadow-focus">
      <input
        autoFocus
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            confirmar();
          } else if (e.key === "Escape") {
            e.stopPropagation();
            aoFechar();
          }
        }}
        onBlur={() => !valor.trim() && aoFechar()}
        placeholder="Título da tarefa…"
        aria-label="Título da nova tarefa"
        className="h-[26px] w-full border-0 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink3"
      />
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[11px] text-ink3">Enter adiciona, Esc cancela</span>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={confirmar}
          className="h-[26px] rounded-[7px] border-0 bg-primary px-2.5 text-xs font-semibold text-on-primary"
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}
