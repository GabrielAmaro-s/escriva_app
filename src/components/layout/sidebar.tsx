"use client";

import { CheckSquareIcon, FolderIcon, MegaphoneIcon, SlidersHorizontalIcon, SquaresFourIcon, StackIcon, type Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProjects } from "@/hooks/use-projects";
import { useCurrentUser } from "@/hooks/use-user";
import { cn } from "@/lib/cn";

const NAV: { href: string; label: string; icon: Icon }[] = [
  { href: "/visao-geral", label: "Visão geral", icon: SquaresFourIcon },
  { href: "/", label: "Meus projetos", icon: FolderIcon },
  { href: "/campanhas", label: "Campanhas", icon: MegaphoneIcon },
  { href: "/tarefas", label: "Tarefas", icon: CheckSquareIcon },
  { href: "/configuracoes", label: "Configurações", icon: SlidersHorizontalIcon },
];

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      {!compact && (
        <span className="grid size-7 place-items-center rounded-lg bg-primary text-on-primary">
          <StackIcon size={16} />
        </span>
      )}
      <span className={cn("font-bold tracking-[-0.02em]", compact ? "text-[15px]" : "text-base")}>myPlan</span>
    </span>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { projects } = useProjects();
  const user = useCurrentUser();

  // No quadro, o item ativo segue o tipo: campanha acende "Campanhas", projeto acende "Meus projetos".
  const boardId = pathname.startsWith("/projetos/") ? pathname.split("/")[2] : null;
  const boardKind = boardId ? projects.find((p) => p.id === boardId)?.kind ?? "project" : null;
  const isActive = (href: string) =>
    boardKind ? href === (boardKind === "campaign" ? "/campanhas" : "/") : href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav aria-label="Navegação principal" className="flex h-full flex-col gap-[22px] px-3.5 pb-3.5 pt-[18px]">
      <Link href="/" onClick={onNavigate} className="px-2 text-ink no-underline">
        <Logo />
      </Link>

      <div className="flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Glyph }) => {
          const on = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-[11px] rounded-[9px] px-2.5 text-[13.5px] no-underline transition-[background,color] duration-150",
                on ? "bg-primary-soft font-semibold text-primary" : "font-medium text-ink2 hover:bg-hover",
              )}
            >
              <Glyph size={17} />
              {label}
            </Link>
          );
        })}
      </div>

      <div className="mt-auto flex items-center gap-2.5 border-t border-line px-2 pt-3">
        <span className="grid size-[30px] place-items-center rounded-full bg-primary-soft text-[12.5px] font-semibold text-primary">
          {user.initial}
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-[13px] font-semibold">{user.name}</span>
          <span className="text-[11.5px] text-ink3">{user.plan}</span>
        </span>
      </div>
    </nav>
  );
}
