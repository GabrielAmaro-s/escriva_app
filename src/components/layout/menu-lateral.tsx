"use client";

import { CheckSquareIcon, FolderIcon, MegaphoneIcon, SlidersHorizontalIcon, SquaresFourIcon, StackIcon, type Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProjetos } from "@/hooks/use-projetos";
import { useUsuarioAtual } from "@/hooks/use-usuario-atual";
import { classes } from "@/lib/classes";

const NAVEGACAO: { href: string; rotulo: string; icone: Icon }[] = [
  { href: "/hoje", rotulo: "Hoje", icone: SquaresFourIcon },
  { href: "/", rotulo: "Processos", icone: FolderIcon },
  { href: "/consultivo", rotulo: "Consultivo", icone: MegaphoneIcon },
  { href: "/prazos", rotulo: "Prazos e tarefas", icone: CheckSquareIcon },
  { href: "/configuracoes", rotulo: "Configurações", icone: SlidersHorizontalIcon },
];

export function Logotipo({ compacto }: { compacto?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      {!compacto && (
        <span className="grid size-7 place-items-center rounded-lg bg-primary text-on-primary">
          <StackIcon size={16} />
        </span>
      )}
      <span className={classes("font-bold tracking-[-0.02em]", compacto ? "text-[15px]" : "text-base")}>myPlan</span>
    </span>
  );
}

export function MenuLateral({ aoNavegar }: { aoNavegar?: () => void }) {
  const caminho = usePathname();
  const { projetos } = useProjetos();
  const usuario = useUsuarioAtual();

  // No quadro, o item ativo segue o tipo: campanha acende "Consultivo", projeto acende "Processos".
  const quadroId = caminho.startsWith("/projetos/") ? caminho.split("/")[2] : null;
  const tipoDoQuadro = quadroId ? (projetos.find((p) => p.id === quadroId)?.kind ?? "project") : null;
  const estaAtivo = (href: string) =>
    tipoDoQuadro ? href === (tipoDoQuadro === "campaign" ? "/consultivo" : "/") : href === "/" ? caminho === "/" : caminho.startsWith(href);

  return (
    <nav aria-label="Navegação principal" className="flex h-full flex-col gap-[22px] px-3.5 pb-3.5 pt-[18px]">
      <Link href="/" onClick={aoNavegar} className="px-2 text-ink no-underline">
        <Logotipo />
      </Link>

      <div className="flex flex-col gap-0.5">
        {NAVEGACAO.map(({ href, rotulo, icone: Glifo }) => {
          const ativo = estaAtivo(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={aoNavegar}
              aria-current={ativo ? "page" : undefined}
              className={classes(
                "flex h-9 items-center gap-[11px] rounded-[9px] px-2.5 text-[13.5px] no-underline transition-[background,color] duration-150",
                ativo ? "bg-primary-soft font-semibold text-primary" : "font-medium text-ink2 hover:bg-hover",
              )}
            >
              <Glifo size={17} />
              {rotulo}
            </Link>
          );
        })}
      </div>

      <div className="mt-auto flex items-center gap-2.5 border-t border-line px-2 pt-3">
        <span className="grid size-[30px] place-items-center rounded-full bg-primary-soft text-[12.5px] font-semibold text-primary">{usuario.inicial}</span>
        <span className="flex flex-col leading-tight">
          <span className="text-[13px] font-semibold">{usuario.nome}</span>
          <span className="text-[11.5px] text-ink3">{usuario.plano}</span>
        </span>
      </div>
    </nav>
  );
}
