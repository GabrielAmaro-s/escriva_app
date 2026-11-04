"use client";

import { ChevronDown, Target } from "lucide-react";
import { useState } from "react";
import { CheckList } from "@/components/ui/check-list";
import { formatDate } from "@/domain/board";
import type { CampaignDetails } from "@/domain/types";
import { cn } from "@/lib/cn";

/** Resumo da campanha no topo do quadro. As entregas podem ser marcadas ali mesmo. */
export function CampaignStrip({
  campaign,
  onChange,
}: {
  campaign: CampaignDetails;
  onChange: (c: CampaignDetails) => void;
}) {
  const [open, setOpen] = useState(false);
  const done = campaign.deliverables.filter((d) => d.done).length;
  const total = campaign.deliverables.length;

  const today = new Date().toISOString().slice(0, 10);
  let period: string | null = null;
  if (campaign.startsOn && campaign.endsOn) period = `${formatDate(campaign.startsOn)} a ${formatDate(campaign.endsOn)}`;
  else if (campaign.startsOn) period = `Desde ${formatDate(campaign.startsOn)}`;
  else if (campaign.endsOn) period = `Até ${formatDate(campaign.endsOn)}`;

  let remaining: string | null = null;
  if (campaign.endsOn && campaign.endsOn >= today) {
    const days = Math.round((new Date(campaign.endsOn).getTime() - new Date(today).getTime()) / 86_400_000);
    remaining = days === 0 ? "termina hoje" : days === 1 ? "falta 1 dia" : `faltam ${days} dias`;
  }

  const hasAnything = campaign.objective || period || campaign.channels.length || total;
  if (!hasAnything) return null;

  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
        {campaign.objective && (
          <p className="flex min-w-0 basis-full items-start gap-2 text-ink sm:basis-auto sm:flex-1">
            <Target className="mt-0.5 size-4 shrink-0 text-tone" />
            <span className="min-w-0">{campaign.objective}</span>
          </p>
        )}
        {period && (
          <p className="text-ink-2">
            {period}
            {remaining && <span className="ml-1.5 text-ink-3">({remaining})</span>}
          </p>
        )}
        {campaign.channels.length > 0 && (
          <ul className="flex flex-wrap gap-1" aria-label="Canais">
            {campaign.channels.map((ch) => (
              <li key={ch} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-ink-2">
                {ch}
              </li>
            ))}
          </ul>
        )}
        {total > 0 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex items-center gap-1.5 rounded-md text-ink-2 hover:text-ink"
          >
            Entregas
            <span className="tabular-nums text-ink-3">
              {done}/{total}
            </span>
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
        )}
      </div>
      {open && (
        <div className="border-t border-line px-4 py-2">
          <CheckList
            items={campaign.deliverables.map((d) => ({ id: d.id, text: d.title, done: d.done }))}
            onChange={(items) => onChange({ ...campaign, deliverables: items.map((i) => ({ id: i.id, title: i.text, done: i.done })) })}
            placeholder="Adicionar entrega"
            addLabel="Nova entrega"
          />
        </div>
      )}
    </div>
  );
}
