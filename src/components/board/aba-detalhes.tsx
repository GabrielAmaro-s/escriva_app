"use client";

import { PlusIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { BarraProgresso, Marcador } from "@/components/ui/pecas";
import { formatarData, formatarPeriodo, novoId } from "@/domain/quadro";
import { ROTULO_STATUS, calcularProgresso, paraDadosProjeto } from "@/domain/projeto";
import type { Projeto } from "@/domain/tipos";
import { useProjetos } from "@/hooks/use-projetos";
import { classes } from "@/lib/classes";

function Titulo({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-xs font-semibold text-ink3">{children}</p>;
}

export function AbaDetalhes({ projeto }: { projeto: Projeto }) {
  const estado = useProjetos();
  const [novaEntrega, setNovaEntrega] = useState("");
  const ehCampanha = projeto.kind === "campaign";
  const c = projeto.campaign;
  const entregas = c?.deliverables ?? [];
  const pct = calcularProgresso(projeto);

  const salvarEntregas = (proximas: typeof entregas) => {
    if (!c) return;
    estado.atualizar(projeto.id, { ...paraDadosProjeto(projeto), campaign: { ...c, deliverables: proximas } }, { silencioso: true });
  };

  const adicionarEntrega = () => {
    const titulo = novaEntrega.trim();
    if (!titulo) return;
    salvarEntregas([...entregas, { id: novoId(), title: titulo, done: false }]);
    setNovaEntrega("");
  };

  const fatos = [
    { k: "Status", v: projeto.archivedAt ? "Arquivado" : ROTULO_STATUS[projeto.status] },
    { k: "Tipo", v: ehCampanha ? "Campanha" : "Projeto" },
    ehCampanha
      ? { k: "Período", v: formatarPeriodo(c?.startsOn ?? null, c?.endsOn ?? null) }
      : { k: "Prazo", v: projeto.dueOn ? formatarData(projeto.dueOn) : "Sem prazo" },
    { k: "Tarefas", v: `${projeto.doneCount} de ${projeto.taskCount} · ${pct}%` },
  ];

  return (
    <div className="flex animate-in flex-wrap items-start gap-x-10 gap-y-7">
      <div className="flex min-w-0 max-w-[640px] flex-[1_1_360px] flex-col gap-[22px]">
        {ehCampanha ? (
          <>
            <div>
              <Titulo>Objetivo</Titulo>
              <p className="text-sm leading-normal">{c?.objective || "Ainda sem objetivo. Defina em Editar."}</p>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-ink3">Canais de divulgação</p>
              {c?.channels.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {c.channels.map((canal) => (
                    <span key={canal} className="rounded-full border border-line bg-hover px-[11px] py-1 text-[12.5px] text-ink2">
                      {canal}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink2">Nenhum canal escolhido.</p>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-ink3">
                Entregas planejadas · {entregas.filter((e) => e.done).length} de {entregas.length}
              </p>
              <div className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface">
                {entregas.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    aria-pressed={e.done}
                    onClick={() => salvarEntregas(entregas.map((x) => (x.id === e.id ? { ...x, done: !x.done } : x)))}
                    className="flex items-center gap-[11px] border-0 border-b border-solid border-line bg-transparent px-3.5 py-[11px] text-left text-[13.5px] hover:bg-hover"
                  >
                    <Marcador marcado={e.done} />
                    <span className={classes(e.done ? "text-ink3 line-through" : "text-ink")}>{e.title}</span>
                  </button>
                ))}
                <div className="flex items-center gap-2.5 px-3.5">
                  <PlusIcon size={14} weight="bold" className="text-ink3" />
                  <input
                    value={novaEntrega}
                    onChange={(e) => setNovaEntrega(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), adicionarEntrega())}
                    placeholder="Adicionar entrega…"
                    aria-label="Adicionar entrega"
                    className="h-10 flex-1 border-0 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink3"
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div>
            <Titulo>Sobre o projeto</Titulo>
            <p className="text-sm leading-relaxed text-ink2">{projeto.description || "Sem descrição. Adicione uma em Editar."}</p>
          </div>
        )}
      </div>

      <div className="min-w-[240px] flex-[0_1_280px] rounded-[14px] border border-line bg-surface px-4 py-1.5">
        {fatos.map((f) => (
          <div key={f.k} className="flex justify-between gap-3 border-b border-line py-3 text-[13px]">
            <span className="text-ink2">{f.k}</span>
            <span className="text-right font-semibold">{f.v}</span>
          </div>
        ))}
        <div className="pb-3 pt-3.5">
          <BarraProgresso valor={pct} tom={projeto.color} concluido={projeto.status === "done"} altura={5} />
        </div>
      </div>
    </div>
  );
}
