import { classes } from "@/lib/classes";

// Logotipo do Tempestivo: o símbolo e o nome "tempestivo" em Bricolage Grotesque 600.
// O desenho é o de docs/marca/logos/: não troque cores, não gire e não estique (manual da marca).

/** Símbolo oficial. "claro" para fundos claros, "escuro" para fundos escuros. */
export function SimboloTempestivo({ tamanho = 28, variante = "claro", className }: { tamanho?: number; variante?: "claro" | "escuro"; className?: string }) {
  const escuro = variante === "escuro";
  return (
    <svg viewBox="0 0 64 64" width={tamanho} height={tamanho} className={className} aria-hidden focusable="false">
      <rect width="64" height="64" rx="14" fill={escuro ? "#5FB3B3" : "#0E4A4F"} />
      <path d="M26 14h8v28a4 4 0 0 0 4 4h6v8h-8a10 10 0 0 1-10-10Z" fill={escuro ? "#0E1514" : "#FFFFFF"} />
      <rect x="16" y="22" width="26" height="8" rx="2" fill={escuro ? "#0E1514" : "#FFFFFF"} />
      <circle cx="49" cy="26" r="5" fill="#F2C94C" />
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
    <span className="flex items-center gap-[7px]" aria-label="Tempestivo">
      <SimboloTempestivo tamanho={tamanho} className="block dark:hidden" />
      <SimboloTempestivo tamanho={tamanho} variante="escuro" className="hidden dark:block" />
      <span aria-hidden className={classes("font-display font-semibold leading-none tracking-[-0.02em] text-ink", compacto ? "text-[17px]" : "text-[20px]")}>
        tempestivo
      </span>
    </span>
  );
}
