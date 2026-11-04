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
import { useMemo, useState } from "react";
import { positionBetween, tasksInColumn } from "@/domain/board";
import type { BoardApi } from "@/hooks/use-board";
import { BoardColumnView } from "./board-column";
import { TaskCard } from "./task-card";

type Items = Record<string, string[]>;

export function Board({ api, onOpenTask }: { api: BoardApi; onOpenTask: (id: string) => void }) {
  const { columns, tasks, labelsById } = api;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragItems, setDragItems] = useState<Items | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const baseItems = useMemo<Items>(
    () => Object.fromEntries(columns.map((c) => [c.id, tasksInColumn(tasks, c.id).map((t) => t.id)])),
    [columns, tasks],
  );
  const items = dragItems ?? baseItems;
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const containerOf = (id: string, source: Items) =>
    id in source ? id : Object.keys(source).find((k) => source[k].includes(id));

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    setDragItems(baseItems);
  }

  // Durante o arraste, o cartão muda de coluna só na tela; a gravação acontece ao soltar.
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    setDragItems((prev) => {
      const source = prev ?? baseItems;
      const id = String(active.id);
      const overId = String(over.id);
      const from = containerOf(id, source);
      const to = containerOf(overId, source);
      if (!from || !to || from === to) return prev;

      const target = [...source[to]];
      let index = target.length;
      if (overId !== to) {
        const overIndex = target.indexOf(overId);
        const activeTop = active.rect.current.translated?.top ?? 0;
        const below = activeTop > over.rect.top + over.rect.height / 2;
        index = overIndex + (below ? 1 : 0);
      }
      target.splice(index, 0, id);
      return { ...source, [from]: source[from].filter((x) => x !== id), [to]: target };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const id = String(active.id);
    const current = dragItems ?? baseItems;
    setActiveId(null);
    setDragItems(null);
    if (!over) return;

    const columnId = containerOf(id, current);
    if (!columnId) return;
    let list = current[columnId];
    const overId = String(over.id);
    if (overId !== columnId && list.includes(overId)) {
      list = arrayMove(list, list.indexOf(id), list.indexOf(overId));
    }

    const index = list.indexOf(id);
    const task = taskById.get(id);
    const column = columns.find((c) => c.id === columnId);
    if (!task || !column) return;

    const beforeId = list[index - 1];
    const afterId = list[index + 1];
    const position = positionBetween(
      beforeId ? taskById.get(beforeId)?.position ?? null : null,
      afterId ? taskById.get(afterId)?.position ?? null : null,
    );

    const sameSpot =
      task.columnId === columnId && baseItems[columnId].indexOf(id) === index;
    if (!sameSpot) api.moveTask(id, column, position);
  }

  const active = activeId ? taskById.get(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setDragItems(null);
      }}
      accessibility={{
        screenReaderInstructions: {
          draggable: "Aperte Espaço para pegar a tarefa, use as setas para mover e Espaço de novo para soltar. Esc cancela.",
        },
      }}
    >
      <div className="board-scroll flex min-h-0 flex-1 snap-x snap-mandatory items-start gap-3 overflow-x-auto px-4 pb-6 sm:snap-none sm:px-6 lg:px-8">
        {columns.map((column) => (
          <BoardColumnView
            key={column.id}
            column={column}
            tasks={(items[column.id] ?? []).map((tid) => taskById.get(tid)!).filter(Boolean)}
            labelsById={labelsById}
            onOpenTask={onOpenTask}
            onToggleComplete={api.toggleComplete}
            onAddTask={(title) => api.addTask(column, title)}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0.9, 0.3, 1)" }}>
        {active ? <TaskCard task={active} labelsById={labelsById} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
