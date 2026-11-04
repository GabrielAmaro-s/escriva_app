"use client";

import { ArrowSquareOutIcon, CopyIcon, DotsThreeIcon, FlagIcon, LinkIcon, PlusIcon, TrashIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";
import { CheckMark, Pill } from "@/components/ui/bits";
import { IconButton } from "@/components/ui/button";
import { useContextMenu } from "@/components/ui/context-menu";
import { Select, controlClass } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { COLUMN_DOT, PRIORITIES, PRIORITY_COLOR, PRIORITY_LABEL, newId, nextPositionInColumn, patchForColumnChange } from "@/domain/board";
import type { Project, TaskLink, TaskPriority } from "@/domain/types";
import type { TasksApi } from "@/hooks/use-tasks";
import { useCurrentUser } from "@/hooks/use-user";
import { cn } from "@/lib/cn";

const NEW_LABEL = "__nova__";

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div>
      <p className="mb-[7px] text-xs font-semibold">{title}</p>
      {children}
    </div>
  );
}

/** Aceita "site.com/pagina" ou "https://..."; qualquer outro texto vira só um título. */
function parseLink(raw: string): TaskLink | null {
  const v = raw.trim();
  if (!v) return null;
  const looksLikeUrl = /^https?:\/\//i.test(v) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v);
  if (looksLikeUrl) {
    try {
      const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
      return { id: newId(), url: url.toString(), title: null };
    } catch {
      // segue como título
    }
  }
  return { id: newId(), url: "", title: v };
}

const linkText = (l: TaskLink) => {
  if (l.title) return l.title;
  try {
    const u = new URL(l.url);
    return u.hostname.replace(/^www\./, "") + (u.pathname !== "/" ? u.pathname : "");
  } catch {
    return l.url;
  }
};

export function TaskModal({ api, taskId, projects, onClose }: { api: TasksApi; taskId: string | null; projects: Project[]; onClose: () => void }) {
  const task = api.tasks.find((t) => t.id === taskId) ?? null;
  const openMenu = useContextMenu();
  const user = useCurrentUser();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newItem, setNewItem] = useState("");
  const [newLink, setNewLink] = useState("");
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [labelName, setLabelName] = useState("");

  useEffect(() => {
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setNewItem("");
    setNewLink("");
    setCreatingLabel(false);
    // só ao trocar de tarefa, para não sobrescrever o que está sendo digitado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  if (!task) return null;

  const project = projects.find((p) => p.id === task.projectId);
  const columns = api.columnsOf(task.projectId);
  const column = columns.find((c) => c.id === task.columnId);
  const projectLabels = api.labelsOf(task.projectId);
  const applied = task.labelIds.map((id) => api.labelsById.get(id)).filter((l) => l !== undefined);
  const available = projectLabels.filter((l) => !task.labelIds.includes(l.id));
  const doneItems = task.checklist.filter((i) => i.done).length;

  const commitTitle = () => {
    const clean = title.trim().slice(0, 200);
    if (!clean) return setTitle(task.title);
    if (clean !== task.title) api.updateTask(task.id, { title: clean });
  };
  const commitDescription = () => {
    const clean = description.trim() || null;
    if (clean !== task.description) api.updateTask(task.id, { description: clean });
  };
  const close = () => {
    commitTitle();
    commitDescription();
    onClose();
  };

  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    api.updateTask(task.id, { checklist: [...task.checklist, { id: newId(), text, done: false }] });
    setNewItem("");
  };
  const addLink = () => {
    const link = parseLink(newLink);
    if (!link) return;
    api.updateTask(task.id, { links: [...task.links, link] });
    setNewLink("");
  };
  const createLabel = async () => {
    const label = await api.createLabel(task.projectId, labelName);
    if (label && !task.labelIds.includes(label.id)) api.updateTask(task.id, { labelIds: [...task.labelIds, label.id] });
    setLabelName("");
    setCreatingLabel(false);
  };

  const menu = (e: React.MouseEvent) =>
    openMenu(e, [
      { label: "Duplicar", icon: CopyIcon, onSelect: () => api.duplicateTask(task.id) },
      {
        label: "Excluir",
        icon: TrashIcon,
        danger: true,
        onSelect: () => {
          onClose();
          api.deleteTask(task.id);
        },
      },
    ]);

  return (
    <Modal open onClose={close} label={task.title} className="max-w-[780px]">
      <div className="flex items-center gap-2.5 pl-[22px] pr-[18px] pt-3.5">
        <button
          type="button"
          onClick={() => api.toggleComplete(task.id)}
          aria-pressed={task.completed}
          aria-label={task.completed ? "Reabrir tarefa" : "Concluir tarefa"}
          title={task.completed ? "Reabrir" : "Concluir"}
          className="border-0 bg-transparent p-0"
        >
          <CheckMark checked={task.completed} color="green" size={18} />
        </button>
        {project && (
          <span data-tone={project.color} className="flex items-center gap-[7px] text-[12.5px] text-ink2">
            <span className="size-2 rounded-full bg-tone" aria-hidden />
            {project.name}
          </span>
        )}
        <span className="ml-auto flex gap-0.5">
          <IconButton label="Mais opções" onClick={menu}>
            <DotsThreeIcon size={16} weight="bold" />
          </IconButton>
          <IconButton label="Fechar" onClick={close}>
            <XIcon size={17} weight="bold" />
          </IconButton>
        </span>
      </div>

      <div className="px-[22px] pt-1.5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          placeholder="Título da tarefa"
          aria-label="Título da tarefa"
          className={cn(
            "-mx-2 w-[calc(100%+16px)] rounded-[9px] border border-transparent bg-transparent px-2 py-1.5 text-[22px] font-bold tracking-[-0.02em] text-ink outline-none hover:bg-hover focus:border-primary focus:bg-surface",
            task.completed && "text-ink3",
          )}
        />
      </div>

      <div className="flex flex-wrap gap-x-7 gap-y-6 px-[22px] pb-[22px] pt-4">
        <div className="flex min-w-0 flex-[2_1_340px] flex-col gap-[22px]">
          <Section title="Descrição">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={commitDescription}
              rows={3}
              placeholder="Adicione detalhes, contexto ou critérios de pronto…"
              className={cn(controlClass, "resize-y py-2.5 leading-normal")}
            />
          </Section>

          <Section title={`Checklist${task.checklist.length ? ` (${doneItems}/${task.checklist.length})` : ""}`}>
            {task.checklist.length > 0 && (
              <div className="mb-2 h-1 overflow-hidden rounded bg-line">
                <div className="h-full rounded bg-primary transition-[width] duration-300" style={{ width: `${(doneItems / task.checklist.length) * 100}%` }} />
              </div>
            )}
            <ul className="flex flex-col">
              {task.checklist.map((item) => (
                <li key={item.id} className="flex min-h-[34px] items-center gap-2.5 rounded-lg px-1">
                  <button
                    type="button"
                    aria-pressed={item.done}
                    aria-label={item.done ? `Desmarcar ${item.text}` : `Marcar ${item.text}`}
                    onClick={() => api.updateTask(task.id, { checklist: task.checklist.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)) })}
                    className="border-0 bg-transparent p-0"
                  >
                    <CheckMark checked={item.done} />
                  </button>
                  <input
                    value={item.text}
                    aria-label="Item do checklist"
                    onChange={(e) => api.updateTask(task.id, { checklist: task.checklist.map((i) => (i.id === item.id ? { ...i, text: e.target.value } : i)) })}
                    onBlur={(e) => !e.target.value.trim() && api.updateTask(task.id, { checklist: task.checklist.filter((i) => i.id !== item.id) })}
                    className={cn("h-[30px] min-w-0 flex-1 border-0 bg-transparent text-[13.5px] outline-none", item.done ? "text-ink3 line-through" : "text-ink")}
                  />
                  <IconButton
                    label="Remover"
                    className="size-[22px] rounded-md text-ink3"
                    onClick={() => api.updateTask(task.id, { checklist: task.checklist.filter((i) => i.id !== item.id) })}
                  >
                    <XIcon size={13} weight="bold" />
                  </IconButton>
                </li>
              ))}
            </ul>
            <div className="mt-0.5 flex items-center gap-2.5 px-1">
              <PlusIcon size={14} weight="bold" className="shrink-0 text-ink3" />
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
                onBlur={addItem}
                placeholder="Adicionar subtarefa…"
                aria-label="Adicionar subtarefa"
                className="h-8 flex-1 border-0 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink3"
              />
            </div>
          </Section>

          <Section title="Links e referências">
            {task.links.length > 0 && (
              <ul className="flex flex-col overflow-hidden rounded-[10px] border border-line">
                {task.links.map((l) => (
                  <li key={l.id} className="flex h-[38px] items-center gap-2.5 border-b border-line pl-3 pr-1.5 text-[13px] last:border-b-0">
                    <LinkIcon size={14} className="shrink-0 text-ink3" />
                    {l.url ? (
                      <a href={l.url} target="_blank" rel="noreferrer noopener" className="min-w-0 flex-1 truncate text-ink no-underline hover:text-primary hover:underline">
                        {linkText(l)}
                      </a>
                    ) : (
                      <span className="min-w-0 flex-1 truncate">{linkText(l)}</span>
                    )}
                    {l.url && (
                      <a href={l.url} target="_blank" rel="noreferrer noopener" aria-label="Abrir link" className="flex text-ink3 hover:text-ink">
                        <ArrowSquareOutIcon size={13} />
                      </a>
                    )}
                    <IconButton
                      label="Remover link"
                      className="size-6 rounded-md text-ink3"
                      onClick={() => api.updateTask(task.id, { links: task.links.filter((x) => x.id !== l.id) })}
                    >
                      <XIcon size={13} weight="bold" />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-1 flex items-center gap-2.5 px-1">
              <PlusIcon size={14} weight="bold" className="shrink-0 text-primary" />
              <input
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLink())}
                placeholder="Adicionar link (título ou URL)…"
                aria-label="Adicionar link"
                className="h-8 flex-1 border-0 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink3"
              />
            </div>
          </Section>
        </div>

        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-4">
          <Section title="Status">
            <Select
              aria-label="Status"
              value={task.columnId}
              leading={<span className="size-2 rounded-full" style={{ background: column ? COLUMN_DOT[column.kind] : undefined }} />}
              onChange={(e) => {
                const target = columns.find((c) => c.id === e.target.value);
                if (!target) return;
                api.updateTask(task.id, {
                  ...patchForColumnChange(task, target),
                  position: nextPositionInColumn(api.tasks.filter((t) => t.id !== task.id), target.id),
                });
              }}
            >
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </Section>

          <Section title="Prioridade">
            <Select
              aria-label="Prioridade"
              value={task.priority}
              leading={<FlagIcon size={13} weight="fill" style={{ color: PRIORITY_COLOR[task.priority] }} />}
              onChange={(e) => api.updateTask(task.id, { priority: e.target.value as TaskPriority })}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
          </Section>

          <Section title="Data de entrega">
            <input
              type="date"
              aria-label="Data de entrega"
              value={task.dueOn ?? ""}
              onChange={(e) => api.updateTask(task.id, { dueOn: e.target.value || null })}
              className={cn(controlClass, "h-9 rounded-[9px] px-2.5 text-[13px]")}
            />
          </Section>

          <Section title="Etiquetas">
            <div className="flex flex-wrap items-center gap-1.5">
              {applied.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  title="Remover"
                  onClick={() => api.updateTask(task.id, { labelIds: task.labelIds.filter((x) => x !== l.id) })}
                  className="border-0 bg-transparent p-0"
                >
                  <Pill tone={l.color} className="inline-flex h-6 items-center gap-[5px] px-2 text-xs">
                    {l.name}
                    <XIcon size={10} weight="bold" />
                  </Pill>
                </button>
              ))}
              {creatingLabel ? (
                <input
                  autoFocus
                  value={labelName}
                  onChange={(e) => setLabelName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      createLabel();
                    }
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                      setCreatingLabel(false);
                    }
                  }}
                  onBlur={() => (labelName.trim() ? createLabel() : setCreatingLabel(false))}
                  maxLength={40}
                  placeholder="Nome da etiqueta"
                  aria-label="Nome da nova etiqueta"
                  className="h-6 w-32 rounded-full border border-primary bg-surface px-2.5 text-xs text-ink outline-none"
                />
              ) : (
                <select
                  value=""
                  aria-label="Adicionar etiqueta"
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === NEW_LABEL) return setCreatingLabel(true);
                    if (v) api.updateTask(task.id, { labelIds: [...task.labelIds, v] });
                  }}
                  className="h-6 w-[92px] cursor-pointer rounded-full border border-dashed border-line2 bg-transparent px-1.5 text-xs text-ink2 outline-none"
                >
                  <option value="">+ Etiqueta</option>
                  {available.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                  <option value={NEW_LABEL}>Criar etiqueta…</option>
                </select>
              )}
            </div>
          </Section>

          <Section title="Responsável">
            <div className="flex h-9 items-center gap-[9px] rounded-[9px] border border-line2 px-2.5 text-[13px]">
              <span className="grid size-[22px] place-items-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">{user.initial}</span>
              {user.name}
            </div>
          </Section>
        </div>
      </div>
    </Modal>
  );
}
