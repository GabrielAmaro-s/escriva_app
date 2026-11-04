"use client";

import { Archive, LayoutGrid, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { getBrowserSupabase, isSupabaseConfigured } from "@/data/supabase/client";
import { useProjects } from "@/hooks/use-projects";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "./theme-toggle";

export function Logo() {
  return (
    <span className="flex items-center gap-2 text-[1.0625rem] font-semibold tracking-tight text-ink">
      <svg viewBox="0 0 20 20" className="size-5 text-accent" aria-hidden>
        <rect x="2" y="3.5" width="16" height="2.5" rx="1.25" fill="currentColor" />
        <rect x="2" y="8.75" width="11" height="2.5" rx="1.25" fill="currentColor" opacity="0.7" />
        <rect x="2" y="14" width="6" height="2.5" rx="1.25" fill="currentColor" opacity="0.45" />
      </svg>
      myPlan
    </span>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const { projects } = useProjects();
  const visible = projects.filter((p) => !p.archivedAt && p.status !== "done");
  const archivedCount = projects.filter((p) => p.archivedAt).length;
  const onArchive = pathname === "/" && params.get("filtro") === "arquivados";

  const link = (active: boolean) =>
    cn(
      "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors [&_svg]:size-4",
      active ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:bg-surface-2/60 hover:text-ink",
    );

  return (
    <nav aria-label="Navegação" className="flex h-full flex-col gap-6 px-3 py-4">
      <div className="px-2.5">
        <Link href="/" onClick={onNavigate}>
          <Logo />
        </Link>
      </div>

      <div className="flex flex-col gap-0.5">
        <Link href="/" onClick={onNavigate} className={link(pathname === "/" && !onArchive)}>
          <LayoutGrid className="text-ink-3" />
          Meus projetos
        </Link>
        <Link href="/?filtro=arquivados" onClick={onNavigate} className={link(onArchive)}>
          <Archive className="text-ink-3" />
          Arquivados
          {archivedCount > 0 && <span className="ml-auto text-xs tabular-nums text-ink-3">{archivedCount}</span>}
        </Link>
      </div>

      {visible.length > 0 && (
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <p className="px-2.5 text-xs font-medium text-ink-3">Em aberto</p>
          <ul className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
            {visible.map((p) => {
              const href = `/projetos/${p.id}`;
              return (
                <li key={p.id}>
                  <Link href={href} onClick={onNavigate} data-color={p.color} className={link(pathname === href)}>
                    <span className="size-2 shrink-0 rounded-[3px] bg-tone" aria-hidden />
                    <span className="truncate">{p.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 px-1">
        <ThemeToggle />
        {isSupabaseConfigured ? (
          <button
            type="button"
            onClick={async () => {
              await getBrowserSupabase().auth.signOut();
              window.location.href = "/login";
            }}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink-3 hover:text-ink"
          >
            <LogOut className="size-3.5" />
            Sair
          </button>
        ) : (
          <span className="px-2 text-xs text-ink-3" title="Os dados ficam salvos só neste navegador. Configure o Supabase para sincronizar.">
            Modo local
          </span>
        )}
      </div>
    </nav>
  );
}
