"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ArrowRightIcon, KanbanIcon, TrashIcon } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { useMenuDeContexto, type ItemMenu } from "@/components/ui/menu-contexto";
import { posicaoEntre, tarefasDaColuna } from "@/domain/quadro";
import type { Coluna, Tarefa } from "@/domain/tipos";
import type { ApiTarefas } from "@/hooks/use-tarefas";
import { ColunaQuadro } from "./coluna-quadro";
import { CartaoTarefa } from "./cartao-tarefa";

type Itens = Record<string, string[]>;

export function QuadroKanban({
  api,
  colunas,
  adicionando,
  definirAdicionando,
  aoAbrirTarefa,
}: {
  api: ApiTarefas;
  colunas: Coluna[];
  adicionando: string | null;
  definirAdicionando: (colunaId: string | null) => void;
  aoAbrirTarefa: (id: string) => void;
}) {
  const { tarefas, etiquetasPorId } = api;
  const abrirMenu = useMenuDeContexto();
  const [ativoId, setAtivoId] = useState<string | null>(null);
  const [itensArrastando, setItensArrastando] = useState<Itens | null>(null);

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const itensBase = useMemo<Itens>(
    () => Object.fromEntries(colunas.map((c) => [c.id, tarefasDaColuna(tarefas, c.id).map((t) => t.id)])),
    [colunas, tarefas],
  );
  const itens = itensArrastando ?? itensBase;
  const tarefaPorId = useMemo(() => new Map(tarefas.map((t) => [t.id, t])), [tarefas]);

  const colunaDe = (id: string, origem: Itens) => (id in origem ? id : Object.keys(origem).find((k) => origem[k].includes(id)));

  const menuDaTarefa = (tarefa: Tarefa, e: React.MouseEvent) => {
    const menu: ItemMenu[] = [{ rotulo: "Abrir", icone: ArrowRightIcon, aoSelecionar: () => aoAbrirTarefa(tarefa.id) }];
    colunas
      .filter((c) => c.id !== tarefa.columnId)
      .forEach((c) => menu.push({ rotulo: `Mover: ${c.title}`, icone: KanbanIcon, aoSelecionar: () => api.moverTarefa(tarefa.id, c) }));
    menu.push({ rotulo: "Excluir", icone: TrashIcon, perigo: true, aoSelecionar: () => api.excluirTarefa(tarefa.id) });
    abrirMenu(e, menu);
  };

  function aoComecarArraste({ active }: DragStartEvent) {
    setAtivoId(String(active.id));
    setItensArrastando(itensBase);
  }

  // Durante o arraste o cartão muda de coluna só na tela; a gravação acontece ao soltar.
  function aoArrastarSobre({ active, over }: DragOverEvent) {
    if (!over) return;
    setItensArrastando((anterior) => {
      const origem = anterior ?? itensBase;
      const id = String(active.id);
      const sobreId = String(over.id);
      const de = colunaDe(id, origem);
      const para = colunaDe(sobreId, origem);
      if (!de || !para || de === para) return anterior;
      const destino = [...origem[para]];
      let indice = destino.length;
      if (sobreId !== para) {
        const indiceSobre = destino.indexOf(sobreId);
        const topoAtivo = active.rect.current.translated?.top ?? 0;
        indice = indiceSobre + (topoAtivo > over.rect.top + over.rect.height / 2 ? 1 : 0);
      }
      destino.splice(indice, 0, id);
      return { ...origem, [de]: origem[de].filter((x) => x !== id), [para]: destino };
    });
  }

  function aoSoltar({ active, over }: DragEndEvent) {
    const id = String(active.id);
    const atual = itensArrastando ?? itensBase;
    setAtivoId(null);
    setItensArrastando(null);
    if (!over) return;

    const colunaId = colunaDe(id, atual);
    if (!colunaId) return;
    let lista = atual[colunaId];
    const sobreId = String(over.id);
    if (sobreId !== colunaId && lista.includes(sobreId)) lista = arrayMove(lista, lista.indexOf(id), lista.indexOf(sobreId));

    const indice = lista.indexOf(id);
    const tarefa = tarefaPorId.get(id);
    const coluna = colunas.find((c) => c.id === colunaId);
    if (!tarefa || !coluna) return;
    if (tarefa.columnId === colunaId && itensBase[colunaId].indexOf(id) === indice) return;

    const anterior = lista[indice - 1];
    const seguinte = lista[indice + 1];
    api.moverTarefa(
      id,
      coluna,
      posicaoEntre(anterior ? (tarefaPorId.get(anterior)?.position ?? null) : null, seguinte ? (tarefaPorId.get(seguinte)?.position ?? null) : null),
    );
  }

  const ativa = ativoId ? tarefaPorId.get(ativoId) : null;

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={closestCorners}
      onDragStart={aoComecarArraste}
      onDragOver={aoArrastarSobre}
      onDragEnd={aoSoltar}
      onDragCancel={() => {
        setAtivoId(null);
        setItensArrastando(null);
      }}
      accessibility={{
        screenReaderInstructions: {
          draggable: "Aperte Espaço para pegar a tarefa, use as setas para mover e Espaço de novo para soltar. Esc cancela.",
        },
      }}
    >
      <div className="flex min-h-[420px] flex-1 snap-x snap-proximity items-stretch gap-3.5 overflow-x-auto pb-3">
        {colunas.map((coluna) => (
          <ColunaQuadro
            key={coluna.id}
            coluna={coluna}
            tarefas={(itens[coluna.id] ?? []).map((tid) => tarefaPorId.get(tid)!).filter(Boolean)}
            etiquetasPorId={etiquetasPorId}
            arrastando={Boolean(ativoId)}
            adicionando={adicionando === coluna.id}
            aoComecarAAdicionar={() => definirAdicionando(coluna.id)}
            aoPararDeAdicionar={() => definirAdicionando(null)}
            aoAbrirTarefa={aoAbrirTarefa}
            aoAbrirMenuTarefa={menuDaTarefa}
            aoAdicionarTarefa={(titulo) => api.adicionarTarefa(coluna, titulo)}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0.9, 0.3, 1)" }}>
        {ativa ? <CartaoTarefa tarefa={ativa} etiquetasPorId={etiquetasPorId} sobreposto /> : null}
      </DragOverlay>
    </DndContext>
  );
}
