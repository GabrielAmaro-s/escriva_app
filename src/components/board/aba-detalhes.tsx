"use client";

import { ArrowSquareOutIcon, PlusIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { BarraProgresso, Marcador } from "@/components/ui/pecas";
import { ROTULO_AREA, ROTULO_FASE, ROTULO_POLO, formatarNumeroCnj, formatarValor } from "@/domain/processo";
import { formatarData, novoId } from "@/domain/quadro";
import { ROTULO_STATUS, calcularProgresso, paraDadosProjeto } from "@/domain/projeto";
import type { Projeto } from "@/domain/tipos";
import { useClientes } from "@/hooks/use-clientes";
import { useProjetos } from "@/hooks/use-projetos";
import { classes } from "@/lib/classes";

function Titulo({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-xs font-semibold text-ink3">{children}</p>;
}

export function AbaDetalhes({ projeto }: { projeto: Projeto }) {
  const estado = useProjetos();
  const { nomeDoCliente } = useClientes();
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

  const d = projeto.processo;
  // Só aparecem os dados preenchidos, menos os que sempre ajudam (status, tipo, cliente, prazo).
  const fatos = [
    { k: "Status", v: projeto.archivedAt ? "Arquivado" : ROTULO_STATUS[projeto.status] },
    { k: "Tipo", v: ehCampanha ? "Consultivo" : "Processo" },
    { k: "Cliente", v: nomeDoCliente(projeto.clienteId) ?? "Sem cliente" },
    ...(ehCampanha
      ? [
          { k: "Tipo de serviço", v: c?.tipoServico || null },
          { k: "Recebido em", v: c?.startsOn ? formatarData(c.startsOn) : null },
          { k: "Prazo de entrega", v: c?.endsOn ? formatarData(c.endsOn) : "Sem prazo" },
        ]
      : [
          { k: "Prazo", v: projeto.dueOn ? formatarData(projeto.dueOn) : "Sem prazo" },
          { k: "Número", v: d?.numeroCnj ? formatarNumeroCnj(d.numeroCnj) : null },
          { k: "Área", v: d?.area ? ROTULO_AREA[d.area] : null },
          { k: "Fase", v: d?.fase ? ROTULO_FASE[d.fase] : null },
          { k: "Tribunal", v: d?.tribunal || null },
          { k: "Vara ou turma", v: d?.orgao || null },
          { k: "Polo do cliente", v: d?.polo ? ROTULO_POLO[d.polo] : null },
          { k: "Parte contrária", v: d?.parteContraria || null },
          { k: "Valor da causa", v: d?.valorCausa != null ? formatarValor(d.valorCausa) : null },
          { k: "Segredo de justiça", v: d?.segredoJustica ? "Sim" : null },
        ]),
    { k: "Tarefas", v: `${projeto.doneCount} de ${projeto.taskCount} · ${pct}%` },
  ].filter((f): f is { k: string; v: string } => f.v !== null);

  return (
    <div className="flex animate-in flex-wrap items-start gap-x-10 gap-y-7">
      <div className="flex min-w-0 max-w-[640px] flex-[1_1_360px] flex-col gap-[22px]">
        {ehCampanha ? (
          <>
            <div>
              <Titulo>Pedido do cliente</Titulo>
              <p className="text-sm leading-normal">{c?.objective || "Ainda sem pedido do cliente. Defina em Editar."}</p>
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
            <Titulo>Sobre o processo</Titulo>
            <p className="text-sm leading-relaxed text-ink2">{projeto.description || "Sem descrição. Adicione uma em Editar."}</p>
            {d?.linkAutos && (
              <a href={d.linkAutos} target="_blank" rel="noreferrer noopener" className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary">
                <ArrowSquareOutIcon size={14} />
                Abrir os autos
              </a>
            )}
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
