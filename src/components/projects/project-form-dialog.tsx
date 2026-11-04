"use client";

import { MegaphoneIcon, PackageIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { FieldLabel, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { CHANNEL_SUGGESTIONS, PROJECT_TONES, TONE_NAME, emptyCampaign, emptyProjectInput, validateProjectInput } from "@/domain/project";
import type { ProjectInput, ProjectKind } from "@/domain/types";
import { cn } from "@/lib/cn";

const KINDS = [
  { kind: "project" as const, name: "Projeto", hint: "Organize tarefas, prazos e entregas.", icon: PackageIcon },
  { kind: "campaign" as const, name: "Campanha", hint: "Planeje e acompanhe uma campanha específica.", icon: MegaphoneIcon },
];

export function ProjectFormDialog({
  open,
  initial,
  editing,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial: ProjectInput;
  editing: boolean;
  onClose: () => void;
  onSubmit: (input: ProjectInput) => Promise<boolean>;
}) {
  const [form, setForm] = useState<ProjectInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [otherChannel, setOtherChannel] = useState("");

  // Reinicia só ao abrir, para não perder o que está sendo digitado.
  useEffect(() => {
    if (open) {
      setForm(initial);
      setError(null);
      setOtherChannel("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isCampaign = form.kind === "campaign";
  const campaign = form.campaign ?? emptyCampaign();
  const set = (patch: Partial<ProjectInput>) => setForm((f) => ({ ...f, ...patch }));
  const setCampaign = (patch: Partial<typeof campaign>) => set({ campaign: { ...campaign, ...patch } });

  const setKind = (kind: ProjectKind) => {
    const defaults = emptyProjectInput(kind);
    setForm((f) => ({
      ...f,
      kind,
      // troca a cor e o ícone padrão só se ainda estiverem no padrão do outro tipo
      color: f.color === emptyProjectInput(f.kind).color ? defaults.color : f.color,
      icon: f.icon === emptyProjectInput(f.kind).icon ? defaults.icon : f.icon,
      campaign: kind === "campaign" ? f.campaign ?? emptyCampaign() : f.campaign,
    }));
  };

  const channels = [...CHANNEL_SUGGESTIONS, ...campaign.channels.filter((c) => !CHANNEL_SUGGESTIONS.includes(c))];
  const toggleChannel = (c: string) =>
    setCampaign({ channels: campaign.channels.includes(c) ? campaign.channels.filter((x) => x !== c) : [...campaign.channels, c] });

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const result = validateProjectInput(form);
    if (!result.ok) {
      setError(result.error);
      document.getElementById("np-name")?.focus();
      return;
    }
    setSaving(true);
    const ok = await onSubmit(result.value);
    setSaving(false);
    if (ok) onClose();
  }

  const heading = editing ? (isCampaign ? "Editar campanha" : "Editar projeto") : isCampaign ? "Nova campanha" : "Novo projeto";
  const nameError = error === "Dê um nome para continuar.";

  return (
    <Modal open={open} onClose={onClose} label={heading} className="max-w-[560px] p-6">
      <form onSubmit={submit} noValidate>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-[-0.02em]">{heading}</h2>
            <p className="mt-1 text-[13px] text-ink2">
              {editing ? "Ajuste as informações e salve." : "Crie um novo projeto ou campanha para organizar suas tarefas."}
            </p>
          </div>
          <IconButton label="Fechar" onClick={onClose}>
            <XIcon size={17} weight="bold" />
          </IconButton>
        </div>

        <p className="mb-2 mt-5 text-[12.5px] font-semibold">Tipo</p>
        <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
          {KINDS.map(({ kind, name, hint, icon: Glyph }) => {
            const on = form.kind === kind;
            return (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setKind(kind)}
                className={cn(
                  "flex items-start gap-[11px] rounded-xl border p-3 text-left text-ink transition-[background,border-color] duration-150",
                  on ? "border-primary bg-primary-soft" : "border-line bg-surface hover:border-line2",
                )}
              >
                <Glyph size={20} className={cn("mt-px shrink-0", on ? "text-primary" : "text-ink2")} />
                <span>
                  <span className="block text-[13.5px] font-semibold">{name}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-ink2">{hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-[18px]">
          <FieldLabel htmlFor="np-name" required>
            Nome
          </FieldLabel>
          <Input
            id="np-name"
            data-autofocus
            aria-required="true"
            aria-invalid={nameError}
            value={form.name}
            onChange={(e) => {
              set({ name: e.target.value });
              if (nameError) setError(null);
            }}
            placeholder={isCampaign ? "Ex.: Campanha de Inverno" : "Ex.: Novo site, Revisão de processos…"}
            maxLength={120}
            className={nameError ? "border-s-red" : undefined}
          />
          {nameError && (
            <p role="alert" className="mt-1.5 text-xs text-s-red">
              {error}
            </p>
          )}
        </div>

        <div className="mt-4">
          <FieldLabel htmlFor="np-desc">Descrição</FieldLabel>
          <Textarea
            id="np-desc"
            rows={2}
            className="resize-none"
            value={form.description ?? ""}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="Descreva brevemente o objetivo…"
          />
        </div>

        {isCampaign && (
          <>
            <div className="mt-4">
              <FieldLabel htmlFor="np-objective">Objetivo</FieldLabel>
              <Input
                id="np-objective"
                value={campaign.objective ?? ""}
                onChange={(e) => setCampaign({ objective: e.target.value })}
                placeholder="Ex.: Geração de leads"
              />
            </div>
            <div className="mt-4">
              <p className="mb-2 text-[12.5px] font-semibold">Canais de divulgação</p>
              <div className="flex flex-wrap gap-[7px]">
                {channels.map((c) => {
                  const on = campaign.channels.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleChannel(c)}
                      className={cn(
                        "h-7 rounded-full border px-3 text-[12.5px] transition-[background,border-color,color] duration-150",
                        on ? "border-primary-line bg-primary-soft text-primary" : "border-line bg-surface text-ink2 hover:text-ink",
                      )}
                    >
                      {c}
                    </button>
                  );
                })}
                <label className="flex h-7 items-center gap-1 rounded-full border border-dashed border-line2 pl-2.5 pr-1 text-ink3 focus-within:border-primary">
                  <PlusIcon size={12} weight="bold" />
                  <input
                    value={otherChannel}
                    onChange={(e) => setOtherChannel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      const v = otherChannel.trim();
                      if (v && !campaign.channels.some((c) => c.toLowerCase() === v.toLowerCase())) setCampaign({ channels: [...campaign.channels, v] });
                      setOtherChannel("");
                    }}
                    placeholder="Outro"
                    aria-label="Adicionar outro canal"
                    className="w-16 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink3"
                  />
                </label>
              </div>
            </div>
          </>
        )}

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-4">
          <div className="flex-none">
            <p className="mb-2 text-[12.5px] font-semibold">Cor</p>
            <div role="radiogroup" aria-label="Cor" className="flex h-[38px] items-center gap-[9px]">
              {PROJECT_TONES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={form.color === t}
                  aria-label={TONE_NAME[t]}
                  title={TONE_NAME[t]}
                  data-tone={t}
                  onClick={() => set({ color: t })}
                  className={cn(
                    "size-[22px] rounded-full border-2 border-surface bg-tone p-0 transition-shadow duration-150",
                    form.color === t ? "shadow-[0_0_0_2px_var(--ink)]" : "shadow-none",
                  )}
                />
              ))}
            </div>
          </div>
          {isCampaign && (
            <div className="min-w-[130px] flex-1">
              <FieldLabel htmlFor="np-start">Início</FieldLabel>
              <Input id="np-start" type="date" className="px-2.5 text-[13px]" value={campaign.startsOn ?? ""} onChange={(e) => setCampaign({ startsOn: e.target.value || null })} />
            </div>
          )}
          <div className="min-w-[130px] flex-1">
            <FieldLabel htmlFor="np-due">{isCampaign ? "Fim" : "Prazo"}</FieldLabel>
            <Input
              id="np-due"
              type="date"
              className="px-2.5 text-[13px]"
              value={(isCampaign ? campaign.endsOn : form.dueOn) ?? ""}
              onChange={(e) => (isCampaign ? setCampaign({ endsOn: e.target.value || null }) : set({ dueOn: e.target.value || null }))}
            />
          </div>
        </div>

        {error && !nameError && (
          <p role="alert" className="mt-4 text-xs text-s-red">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2.5">
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" disabled={saving} className="px-[18px]">
            {editing ? "Salvar alterações" : isCampaign ? "Criar campanha" : "Criar projeto"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
