import type { ReactNode } from "react";

/** Uma linha das Configurações: título, dica e o controle à direita. */
export function LinhaConfiguracao({ titulo, dica, children }: { titulo: string; dica: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-4 last:border-b-0">
      <div>
        <p className="text-sm font-semibold">{titulo}</p>
        <p className="mt-0.5 text-[12.5px] text-ink-muted">{dica}</p>
      </div>
      {children}
    </div>
  );
}
