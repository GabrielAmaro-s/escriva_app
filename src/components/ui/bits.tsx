"use client";

import {
  CalendarBlankIcon,
  ChartBarIcon,
  CheckCircleIcon,
  CheckIcon,
  FolderIcon,
  GiftIcon,
  MagnifyingGlassIcon,
  MegaphoneIcon,
  MonitorIcon,
  PackageIcon,
  StarIcon,
  TargetIcon,
  type Icon,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { STATUS_LABEL, STATUS_TONE } from "@/domain/project";
import type { ProjectIcon, ProjectStatus, Tone } from "@/domain/types";
import { cn } from "@/lib/cn";

// Peças pequenas reaproveitadas em várias telas.

export const PROJECT_ICON: Record<ProjectIcon, Icon> = {
  folder: FolderIcon,
  monitor: MonitorIcon,
  box: PackageIcon,
  calendar: CalendarBlankIcon,
  chart: ChartBarIcon,
  check: CheckCircleIcon,
  gift: GiftIcon,
  megaphone: MegaphoneIcon,
  star: StarIcon,
  target: TargetIcon,
};

/** Quadradinho colorido com o ícone do projeto. */
export function ToneTile({ tone, icon, size = 36 }: { tone: Tone; icon: ProjectIcon; size?: 36 | 40 }) {
  const Glyph = PROJECT_ICON[icon];
  return (
    <span
      data-tone={tone}
      style={{ width: size, height: size }}
      className={cn("grid shrink-0 place-items-center bg-tone-bg text-tone-fg", size === 40 ? "rounded-[11px]" : "rounded-[10px]")}
      aria-hidden
    >
      <Glyph size={size === 40 ? 20 : 18} />
    </span>
  );
}

export function StatusBadge({ status, archived, className }: { status: ProjectStatus; archived?: boolean; className?: string }) {
  return (
    <span
      data-tone={archived ? "gray" : STATUS_TONE[status]}
      className={cn("whitespace-nowrap rounded-full bg-tone-bg px-[9px] py-[3px] text-[11.5px] font-semibold leading-none text-tone-fg", className)}
    >
      {archived ? "Arquivado" : STATUS_LABEL[status]}
    </span>
  );
}

export function Pill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span data-tone={tone} className={cn("whitespace-nowrap rounded-full bg-tone-bg px-2 py-0.5 text-[11px] font-medium text-tone-fg", className)}>
      {children}
    </span>
  );
}

export function ProgressBar({ value, tone, done, height = 4 }: { value: number; tone?: Tone; done?: boolean; height?: 4 | 5 }) {
  return (
    <div
      className="overflow-hidden rounded bg-line"
      style={{ height }}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Progresso"
    >
      <div
        data-tone={tone}
        className={cn("h-full rounded transition-[width] duration-400 ease-out", done ? "bg-s-green" : tone ? "bg-tone" : "bg-primary")}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function FilterChips<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-[30px] rounded-full border px-[13px] text-[12.5px] font-medium transition-[background,border-color,color] duration-150",
              on ? "border-primary-line bg-primary-soft text-primary" : "border-line bg-surface text-ink2 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block min-w-[200px] flex-[0_1_280px]">
      <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-ink3">
        <MagnifyingGlassIcon size={16} />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder.replace("…", "")}
        className="h-[38px] w-full rounded-[10px] border border-line2 bg-surface pl-9 pr-3 text-[13.5px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink3 focus:border-primary focus:shadow-focus"
      />
    </label>
  );
}

/** Caixinha de marcar (quadrada) ou bolinha (redonda), preenchida quando marcada. */
export function CheckMark({
  checked,
  shape = "square",
  color = "primary",
  size = 17,
}: {
  checked: boolean;
  shape?: "square" | "round";
  color?: "primary" | "green";
  size?: 16 | 17 | 18;
}) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cn(
        "grid shrink-0 place-items-center border-[1.5px] text-on-primary transition-colors",
        shape === "round" ? "rounded-full" : "rounded-[5px]",
        checked ? (color === "green" ? "border-s-green bg-s-green" : "border-primary bg-primary") : "border-line2 bg-transparent",
      )}
    >
      <CheckIcon size={size === 18 ? 10 : 11} weight="bold" className={checked ? "opacity-100" : "opacity-0"} />
    </span>
  );
}

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="m-0 text-[28px] font-bold leading-[1.15] tracking-[-0.025em]">{title}</h1>
        <p className="mt-1.5 text-sm text-ink2">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Glyph, title, body, children }: { icon: Icon; title: string; body: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-line2 px-5 py-[72px] text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-hover text-ink3">
        <Glyph size={20} />
      </span>
      <p className="mt-2 text-[15px] font-semibold">{title}</p>
      <p className="max-w-[320px] text-[13px] text-ink2">{body}</p>
      {children && <div className="mt-3 flex gap-2">{children}</div>}
    </div>
  );
}

/** Largura e respiro de cada página, como no design. */
export function Page({ width, children, className }: { width: 680 | 880 | 1040 | 1240 | 1400; children: ReactNode; className?: string }) {
  const max = { 680: "max-w-[680px]", 880: "max-w-[880px]", 1040: "max-w-[1040px]", 1240: "max-w-[1240px]", 1400: "max-w-[1400px]" }[width];
  return <div className={cn("mx-auto w-full animate-in px-4 pb-10 pt-5 nav:px-10 nav:pb-12 nav:pt-8", max, className)}>{children}</div>;
}
