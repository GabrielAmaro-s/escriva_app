"use client";

import { Check, Trash2, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CheckList } from "@/components/ui/check-list";
import { Modal } from "@/components/ui/modal";
import { Segmented } from "@/components/ui/segmented";
import { PRIORITIES, PRIORITY_LABEL, nextPositionInColumn, patchForColumnChange } from "@/domain/board";
import type { TaskPriority } from "@/domain/types";
import type { BoardApi } from "@/hooks/use-board";
import { cn } from "@/lib/cn";
import { LabelPicker } from "./label-picker";
import { LinksEditor } from "./links-editor";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-start gap-3 py-1.5">
      <span className="pt-1.5 text-sm text-ink-3">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-line pt-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export function TaskSheet({ api, taskId, onClose }: { api: BoardApi; taskId: string | null; onClose: () => void }) {
  const task = api.tasks.find((t) => t.id === taskId) ?? null;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    // só ao trocar de tarefa, para não sobrescrever o que está sendo digitado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  const open = Boolean(task);
  const column = task ? api.columns.find((c) => c.id === task.columnId) : null;

  const commitTitle = () => {
    if (!task) return;
    const clean = title.trim().slice(0, 200);
    if (!clean) return setTitle(task.title);
    if (clean !== task.title) api.updateTask(task.id, { title: clean });
  };

  const commitDescription = () => {
    if (!task) return;
    const clean = description.trim() || null;
    if (clean !== task.description) api.updateTask(task.id, { description: clean });
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        commitTitle();
        commitDescription();
        onClose();
      }}
      variant="sheet"
      title={column ? column.title : "Tarefa"}
      footer={
        task && (
          <>
            <Button
              variant="danger-ghost"
              size="sm"
              onClick={() => {
                api.deleteTask(task.id);
                onClose();
              }}
            >
              <Trash2 />
              Excluir tarefa
            </Button>
            <span className="ml-auto text-xs text-ink-3">
              Criada em {new Date(task.createdAt).toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}
            </span>
          </>
        )
      }
    >
      {task && (
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => api.toggleComplete(task.id)}
              aria-pressed={task.completed}
              aria-label={task.completed ? "Reabrir tarefa" : "Concluir tarefa"}
              className={cn(
                "mt-1.5 grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors",
                task.completed ? "border-tone bg-tone text-surface" : "border-line-strong text-transparent hover:border-tone hover:text-tone",
              )}
            >
              <Check className="size-3" strokeWidth={3.5} />
            </button>
            <textarea
              value={title}
              rows={1}
              onChange={(e) => setTitle(e.target.value.replace(/\n/g, ""))}
              onBlur={commitTitle}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), e.currentTarget.blur())}
              aria-label="Título"
              className={cn(
                "field-sizing-content min-w-0 flex-1 resize-none rounded-md bg-transparent px-1 text-xl font-semibold leading-snug tracking-tight focus:bg-surface-2 focus:outline-none",
                task.completed && "text-ink-3",
              )}
            />
          </div>

          <div className="flex flex-col">
            <Row label="Coluna">
              <select
                value={task.columnId}
                onChange={(e) => {
                  const target = api.columns.find((c) => c.id === e.target.value);
                  if (!target) return;
                  api.updateTask(task.id, {
                    ...patchForColumnChange(task, target),
                    position: nextPositionInColumn(api.tasks.filter((t) => t.id !== task.id), target.id),
                  });
                }}
                className="h-8 rounded-md border border-line bg-surface px-2 text-sm focus:border-accent focus:outline-none"
              >
                {api.columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Entrega">
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={task.dueOn ?? ""}
                  onChange={(e) => api.updateTask(task.id, { dueOn: e.target.value || null })}
                  aria-label="Data de entrega"
                  className="h-8 rounded-md border border-line bg-surface px-2 text-sm focus:border-accent focus:outline-none"
                />
                {task.dueOn && (
                  <button
                    type="button"
                    aria-label="Remover data"
                    onClick={() => api.updateTask(task.id, { dueOn: null })}
                    className="grid size-7 place-items-center rounded-md text-ink-3 hover:text-ink"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </Row>
            <Row label="Prioridade">
              <Segmented<TaskPriority>
                label="Prioridade"
                value={task.priority}
                onChange={(priority) => api.updateTask(task.id, { priority })}
                options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
                className="max-w-full overflow-x-auto"
              />
            </Row>
            <Row label="Etiquetas">
              <LabelPicker
                labels={api.labels}
                selected={task.labelIds}
                onChange={(labelIds) => api.updateTask(task.id, { labelIds })}
                onCreate={api.createLabel}
                onDelete={api.deleteLabel}
              />
            </Row>
          </div>

          <Section title="Descrição">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={commitDescription}
              placeholder="Detalhes, contexto, anotações"
              aria-label="Descrição"
              className="field-sizing-content min-h-20 w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-base leading-relaxed placeholder:text-ink-3 focus:border-accent focus:outline-none"
            />
          </Section>

          <Section title="Checklist">
            <CheckList
              items={task.checklist}
              onChange={(checklist) => api.updateTask(task.id, { checklist })}
              placeholder="Adicionar item"
              addLabel="Novo item do checklist"
            />
          </Section>

          <Section title="Links e referências">
            <LinksEditor links={task.links} onChange={(links) => api.updateTask(task.id, { links })} />
          </Section>
        </div>
      )}
    </Modal>
  );
}
