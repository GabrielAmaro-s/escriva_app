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
import { ROTULO_STATUS, TOM_STATUS } from "@/domain/projeto";
import type { IconeProjeto, StatusProjeto, Tom } from "@/domain/tipos";
import { classes } from "@/lib/classes";

// Peças pequenas reaproveitadas em várias telas.

export const ICONE_PROJETO: Record<IconeProjeto, Icon> = {
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
export function BlocoTom({ tom, icone, tamanho = 36 }: { tom: Tom; icone: IconeProjeto; tamanho?: 36 | 40 }) {
  const Glifo = ICONE_PROJETO[icone];
  return (
    <span
      data-tone={tom}
      style={{ width: tamanho, height: tamanho }}
      className={classes("grid shrink-0 place-items-center bg-tone-bg text-tone-fg", tamanho === 40 ? "rounded-[11px]" : "rounded-[10px]")}
      aria-hidden
    >
      <Glifo size={tamanho === 40 ? 20 : 18} />
    </span>
  );
}

export function SeloStatus({ status, arquivado, className }: { status: StatusProjeto; arquivado?: boolean; className?: string }) {
  return (
    <span
      data-tone={arquivado ? "gray" : TOM_STATUS[status]}
      className={classes("whitespace-nowrap rounded-full bg-tone-bg px-[9px] py-[3px] text-[11.5px] font-semibold leading-none text-tone-fg", className)}
    >
      {arquivado ? "Arquivado" : ROTULO_STATUS[status]}
    </span>
  );
}

export function Pilula({ tom, children, className }: { tom: Tom; children: ReactNode; className?: string }) {
  return (
    <span data-tone={tom} className={classes("whitespace-nowrap rounded-full bg-tone-bg px-2 py-0.5 text-[11px] font-medium text-tone-fg", className)}>
      {children}
    </span>
  );
}

export function BarraProgresso({ valor, tom, concluido, altura = 4 }: { valor: number; tom?: Tom; concluido?: boolean; altura?: 4 | 5 }) {
  return (
    <div
      className="overflow-hidden rounded bg-line"
      style={{ height: altura }}
      role="progressbar"
      aria-valuenow={valor}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Progresso"
    >
      <div
        data-tone={tom}
        className={classes("h-full rounded transition-[width] duration-400 ease-out", concluido ? "bg-s-green" : tom ? "bg-tone" : "bg-primary")}
        style={{ width: `${valor}%` }}
      />
    </div>
  );
}

export function OpcoesFiltro<T extends string>({
  valor,
  opcoes,
  aoMudar,
  rotulo,
}: {
  valor: T;
  opcoes: { valor: T; rotulo: string }[];
  aoMudar: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap gap-2">
      {opcoes.map((o) => {
        const ativa = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={ativa}
            onClick={() => aoMudar(o.valor)}
            className={classes(
              "h-[30px] rounded-full border px-[13px] text-[12.5px] font-medium transition-[background,border-color,color] duration-150",
              ativa ? "border-primary-line bg-primary-soft text-primary" : "border-line bg-surface text-ink2 hover:text-ink",
            )}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

export function CampoBusca({ valor, aoMudar, placeholder }: { valor: string; aoMudar: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block min-w-[200px] flex-[0_1_280px]">
      <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-ink3">
        <MagnifyingGlassIcon size={16} />
      </span>
      <input
        type="search"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder.replace("…", "")}
        className="h-[38px] w-full rounded-[10px] border border-line2 bg-surface pl-9 pr-3 text-[13.5px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink3 focus:border-primary focus:shadow-focus"
      />
    </label>
  );
}

/** Caixinha de marcar (quadrada) ou bolinha (redonda), preenchida quando marcada. */
export function Marcador({
  marcado,
  formato = "quadrado",
  cor = "primary",
  tamanho = 17,
}: {
  marcado: boolean;
  formato?: "quadrado" | "redondo";
  cor?: "primary" | "green";
  tamanho?: 16 | 17 | 18;
}) {
  return (
    <span
      aria-hidden
      style={{ width: tamanho, height: tamanho }}
      className={classes(
        "grid shrink-0 place-items-center border-[1.5px] text-on-primary transition-colors",
        formato === "redondo" ? "rounded-full" : "rounded-[5px]",
        marcado ? (cor === "green" ? "border-s-green bg-s-green" : "border-primary bg-primary") : "border-line2 bg-transparent",
      )}
    >
      <CheckIcon size={tamanho === 18 ? 10 : 11} weight="bold" className={marcado ? "opacity-100" : "opacity-0"} />
    </span>
  );
}

export function CabecalhoPagina({ titulo, descricao, acao }: { titulo: string; descricao: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="m-0 text-[28px] font-bold leading-[1.15] tracking-[-0.025em]">{titulo}</h1>
        <p className="mt-1.5 text-sm text-ink2">{descricao}</p>
      </div>
      {acao}
    </div>
  );
}

export function EstadoVazio({ icone: Glifo, titulo, texto, children }: { icone: Icon; titulo: string; texto: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-line2 px-5 py-[72px] text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-hover text-ink3">
        <Glifo size={20} />
      </span>
      <p className="mt-2 text-[15px] font-semibold">{titulo}</p>
      <p className="max-w-[320px] text-[13px] text-ink2">{texto}</p>
      {children && <div className="mt-3 flex gap-2">{children}</div>}
    </div>
  );
}

/** Largura e respiro de cada página, como no design. */
export function Pagina({ largura, children, className }: { largura: 680 | 880 | 1040 | 1240 | 1400; children: ReactNode; className?: string }) {
  const maxima = { 680: "max-w-[680px]", 880: "max-w-[880px]", 1040: "max-w-[1040px]", 1240: "max-w-[1240px]", 1400: "max-w-[1400px]" }[largura];
  return <div className={classes("mx-auto w-full animate-in px-4 pb-10 pt-5 nav:px-10 nav:pb-12 nav:pt-8", maxima, className)}>{children}</div>;
}
