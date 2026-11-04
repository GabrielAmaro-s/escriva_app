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
import { useContextMenu, type MenuItem } from "@/components/ui/context-menu";
import { positionBetween, tasksInColumn } from "@/domain/board";
import type { BoardColumn, Task } from "@/domain/types";
import type { TasksApi } from "@/hooks/use-tasks";
import { BoardColumnView } from "./board-column";
import { TaskCard } from "./task-card";

type Items = Record<string, string[]>;

export function Board({
  api,
  columns,
  adding,
  setAdding,
  onOpenTask,
}: {
  api: TasksApi;
  columns: BoardColumn[];
  adding: string | null;
  setAdding: (columnId: string | null) => void;
  onOpenTask: (id: string) => void;
}) {
  const { tasks, labelsById } = api;
  const openMenu = useContextMenu();
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

  const containerOf = (id: string, source: Items) => (id in source ? id : Object.keys(source).find((k) => source[k].includes(id)));

  const taskMenu = (task: Task, e: React.MouseEvent) => {
    const menu: MenuItem[] = [{ label: "Abrir", icon: ArrowRightIcon, onSelect: () => onOpenTask(task.id) }];
    columns
      .filter((c) => c.id !== task.columnId)
      .forEach((c) => menu.push({ label: `Mover: ${c.title}`, icon: KanbanIcon, onSelect: () => api.moveTask(task.id, c) }));
    menu.push({ label: "Excluir", icon: TrashIcon, danger: true, onSelect: () => api.deleteTask(task.id) });
    openMenu(e, menu);
  };

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    setDragItems(baseItems);
  }

  // Durante o arraste o cartão muda de coluna só na tela; a gravação acontece ao soltar.
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
        index = overIndex + (activeTop > over.rect.top + over.rect.height / 2 ? 1 : 0);
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
    if (overId !== columnId && list.includes(overId)) list = arrayMove(list, list.indexOf(id), list.indexOf(overId));

    const index = list.indexOf(id);
    const task = taskById.get(id);
    const column = columns.find((c) => c.id === columnId);
    if (!task || !column) return;
    if (task.columnId === columnId && baseItems[columnId].indexOf(id) === index) return;

    const before = list[index - 1];
    const after = list[index + 1];
    api.moveTask(
      id,
      column,
      positionBetween(before ? taskById.get(before)?.position ?? null : null, after ? taskById.get(after)?.position ?? null : null),
    );
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
      <div className="flex min-h-[420px] flex-1 snap-x snap-proximity items-stretch gap-3.5 overflow-x-auto pb-3">
        {columns.map((column) => (
          <BoardColumnView
            key={column.id}
            column={column}
            tasks={(items[column.id] ?? []).map((tid) => taskById.get(tid)!).filter(Boolean)}
            labelsById={labelsById}
            dragging={Boolean(activeId)}
            adding={adding === column.id}
            onStartAdding={() => setAdding(column.id)}
            onStopAdding={() => setAdding(null)}
            onOpenTask={onOpenTask}
            onTaskMenu={taskMenu}
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
