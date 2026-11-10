import { classes } from "@/lib/classes";

// Logotipo da Escriva: o símbolo e o nome "escriva" em Bricolage Grotesque 600.
// O desenho é o de docs/marca/logos/: não troque cores, não gire e não estique (manual da marca).

/** Símbolo oficial. "claro" para fundos claros, "escuro" para fundos escuros. */
export function SimboloEscriva({ tamanho = 28, variante = "claro", className }: { tamanho?: number; variante?: "claro" | "escuro"; className?: string }) {
  const escuro = variante === "escuro";
  return (
    <svg viewBox="0 0 64 64" width={tamanho} height={tamanho} className={className} aria-hidden focusable="false">
      <rect width="64" height="64" rx="14" fill={escuro ? "#5FB3B3" : "#0E4A4F"} />
      <path d="M17.80 33H44.20A13.2 13.2 0 1 0 40.81 41.83" fill="none" stroke={escuro ? "#0E1514" : "#FFFFFF"} strokeWidth="7.4" strokeLinecap="butt" />
      <circle cx="48.4" cy="47.8" r="4.6" fill="#F2C94C" />
    </svg>
  );
}

/**
 * Símbolo e nome. No tema escuro entra o símbolo para fundo escuro.
 * O nome tem cerca de 55% da altura do símbolo, com 12px de espaço para cada 48px de símbolo.
 */
export function Logotipo({ compacto }: { compacto?: boolean }) {
  const tamanho = compacto ? 24 : 28;
  return (
    <span className="flex items-center gap-[7px]" aria-label="Escriva">
      <SimboloEscriva tamanho={tamanho} className="block dark:hidden" />
      <SimboloEscriva tamanho={tamanho} variante="escuro" className="hidden dark:block" />
      <span aria-hidden className={classes("font-display font-semibold leading-none tracking-[-0.02em] text-ink", compacto ? "text-[17px]" : "text-[20px]")}>
        escriva
      </span>
    </span>
  );
}
