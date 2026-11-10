import { WarningIcon } from "@phosphor-icons/react";
import { dataCurtaComDia } from "@/domain/datas";
import { AVISO_CONTAGEM_EM_VALIDACAO, seloDoPrazo, type CorDoEstado } from "@/domain/prazos";
import { hojeIso } from "@/domain/quadro";
import { classes } from "@/lib/classes";

// Peças de prazo da marca Escriva (docs/marca/exemplos/SeloPrazo e MemoriaCalculo).

const COR_DO_SELO: Record<CorDoEstado, string> = {
  fatal: "bg-fatal-soft text-fatal",
  interno: "bg-interno-soft text-interno",
  "no-prazo": "bg-no-prazo-soft text-no-prazo",
};

/** Estado do prazo numa palavra e numa cor. A palavra é obrigatória: a cor sozinha nunca diz o estado. */
export function SeloPrazo({
  tarefa,
  hoje = hojeIso(),
  className,
}: {
  tarefa: { prazoFatal: string | null; dueOn: string | null; completed: boolean };
  hoje?: string;
  className?: string;
}) {
  const s = seloDoPrazo(tarefa, hoje);
  return (
    <span
      className={classes(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-2 py-1 text-[12px] font-semibold uppercase leading-4 tracking-[0.06em]",
        COR_DO_SELO[s.cor],
        className,
      )}
    >
      {s.rotulo}
      {s.dias && <b className="dado font-medium normal-case tracking-normal">{s.dias}</b>}
    </span>
  );
}

/** Aviso de que a contagem ainda está em validação (some quando a constante vira null). */
export function AvisoValidacao() {
  if (!AVISO_CONTAGEM_EM_VALIDACAO) return null;
  return (
    <p role="note" className="flex items-start gap-1.5 rounded-sm bg-interno-soft px-3 py-2 text-[13px] leading-[18px] text-interno">
      <WarningIcon size={16} weight="fill" className="mt-px shrink-0" />
      {AVISO_CONTAGEM_EM_VALIDACAO}
    </p>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <span className="text-[12px] font-semibold uppercase leading-4 tracking-[0.06em] text-ink-muted">{rotulo}</span>
      {children}
    </div>
  );
}

/** Vencimento grifado com marca-texto (uma vez por bloco), prazo interno sem grifo, memória e aviso. */
export function MemoriaCalculo({ vencimento, prazoInterno, memoria }: { vencimento: string | null; prazoInterno: string | null; memoria: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-line bg-surface-raised p-4">
      {vencimento && (
        <Linha rotulo="Prazo fatal">
          <span className="dado rounded-[2px] bg-marca-texto px-1.5 py-0.5 text-[14px] font-medium leading-5 text-on-marca-texto">{dataCurtaComDia(vencimento)}</span>
        </Linha>
      )}
      {prazoInterno && (
        <Linha rotulo="Prazo interno">
          <span className="dado text-[14px] font-medium leading-5 text-ink">{dataCurtaComDia(prazoInterno)}</span>
        </Linha>
      )}
      <p className="dado m-0 border-t border-line pt-3 text-[13px] leading-5 text-ink-muted">{memoria}</p>
      <AvisoValidacao />
    </div>
  );
}
