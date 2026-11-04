"use client";

import { FolderKanban, Megaphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckList } from "@/components/ui/check-list";
import { ChipInput } from "@/components/ui/chip-input";
import { ColorPicker } from "@/components/ui/color-picker";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Segmented } from "@/components/ui/segmented";
import { STATUS_LABEL, emptyCampaign, emptyProjectInput, validateProjectInput } from "@/domain/project";
import type { ProjectInput, ProjectKind, ProjectStatus } from "@/domain/types";
import { cn } from "@/lib/cn";

const CHANNEL_SUGGESTIONS = ["Instagram", "WhatsApp", "E-mail", "TikTok", "YouTube", "LinkedIn", "Site"];

export function ProjectFormDialog({
  open,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial?: ProjectInput;
  onClose: () => void;
  onSubmit: (input: ProjectInput) => Promise<boolean>;
}) {
  const editing = Boolean(initial);
  const [form, setForm] = useState<ProjectInput>(initial ?? emptyProjectInput());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reinicia o formulário só ao abrir, para não perder o que está sendo digitado.
  useEffect(() => {
    if (open) {
      setForm(initial ?? emptyProjectInput());
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const campaign = form.campaign ?? emptyCampaign();
  const setCampaign = (patch: Partial<typeof campaign>) => set("campaign", { ...campaign, ...patch });

  const setKind = (kind: ProjectKind) =>
    setForm((f) => ({ ...f, kind, campaign: kind === "campaign" ? f.campaign ?? emptyCampaign() : f.campaign }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = validateProjectInput(form);
    if (!result.ok) return setError(result.error);
    setSaving(true);
    const ok = await onSubmit(result.value);
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar projeto" : "Novo projeto"}
      footer={
        <>
          {error && <p className="mr-auto text-sm text-danger">{error}</p>}
          <Button variant="ghost" onClick={onClose} className="ml-auto">
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="project-form" disabled={saving}>
            {editing ? "Salvar alterações" : "Criar projeto"}
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={submit} className="flex flex-col gap-5">
        <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-2 gap-2">
          {(
            [
              { value: "project", label: "Projeto", hint: "Tarefas em um quadro", icon: FolderKanban },
              { value: "campaign", label: "Campanha", hint: "Com objetivo, período e canais", icon: Megaphone },
            ] as const
          ).map(({ value, label, hint, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={form.kind === value}
              onClick={() => setKind(value)}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                form.kind === value ? "border-accent bg-accent/5" : "border-line hover:border-line-strong",
              )}
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", form.kind === value ? "text-accent" : "text-ink-3")} />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-ink-3">{hint}</span>
              </span>
            </button>
          ))}
        </div>

        <Field label="Nome">
          <Input
            autoFocus
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={form.kind === "campaign" ? "Ex.: Lançamento de março" : "Ex.: Estudos do semestre"}
            maxLength={120}
          />
        </Field>

        <Field label="Descrição curta">
          <Textarea
            rows={2}
            className="min-h-0"
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Uma frase sobre o que é este projeto"
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-2">Cor</span>
            <ColorPicker value={form.color} onChange={(c) => set("color", c)} />
          </div>
          {editing && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-2">Status</span>
              <Segmented<ProjectStatus>
                label="Status"
                value={form.status}
                onChange={(s) => set("status", s)}
                options={(Object.keys(STATUS_LABEL) as ProjectStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
              />
            </div>
          )}
        </div>

        {form.kind === "campaign" && (
          <fieldset className="flex flex-col gap-5 rounded-xl bg-surface-2/60 p-4">
            <legend className="sr-only">Detalhes da campanha</legend>
            <p className="-mb-1 text-xs text-ink-3">Tudo aqui é opcional. Preencha o que ajudar.</p>
            <Field label="Objetivo">
              <Textarea
                rows={2}
                className="min-h-0"
                value={campaign.objective ?? ""}
                onChange={(e) => setCampaign({ objective: e.target.value })}
                placeholder="O que esta campanha precisa alcançar?"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Início">
                <Input type="date" value={campaign.startsOn ?? ""} onChange={(e) => setCampaign({ startsOn: e.target.value || null })} />
              </Field>
              <Field label="Término">
                <Input type="date" value={campaign.endsOn ?? ""} onChange={(e) => setCampaign({ endsOn: e.target.value || null })} />
              </Field>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-2">Canais de divulgação</span>
              <ChipInput
                value={campaign.channels}
                onChange={(channels) => setCampaign({ channels })}
                placeholder="Digite e aperte Enter"
                suggestions={CHANNEL_SUGGESTIONS}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink-2">Entregas</span>
              <CheckList
                items={campaign.deliverables.map((d) => ({ id: d.id, text: d.title, done: d.done }))}
                onChange={(items) => setCampaign({ deliverables: items.map((i) => ({ id: i.id, title: i.text, done: i.done })) })}
                placeholder="Adicionar entrega"
                addLabel="Nova entrega"
              />
            </div>
          </fieldset>
        )}
      </form>
    </Modal>
  );
}
