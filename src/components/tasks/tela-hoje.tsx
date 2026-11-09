"use client";

import { useMemo, useState } from "react";
import { CabecalhoPagina, Pagina } from "@/components/ui/pecas";
import { hojeIso } from "@/domain/quadro";
import { useLembretes } from "@/hooks/use-lembretes";
import { useProjetos } from "@/hooks/use-projetos";
import { useTarefas } from "@/hooks/use-tarefas";
import { classes } from "@/lib/classes";
import { ListaLembretes } from "./lista-lembretes";
import { ListaTarefas } from "./lista-tarefas";
import { JanelaTarefa } from "./janela-tarefa";
import { tarefasAbertas } from "./tela-prazos";

export function TelaHoje() {
  const estado = useProjetos();
  const api = useTarefas();
  const lembretes = useLembretes();
  const [tarefaAberta, setTarefaAberta] = useState<string | null>(null);
  const projetosPorId = useMemo(() => new Map(estado.projetos.map((p) => [p.id, p])), [estado.projetos]);

  const abertas = tarefasAbertas(api.tarefas, projetosPorId);
  const proximas = abertas.filter((t) => t.dueOn).slice(0, 8);
  const daquiUmaSemana = new Date();
  daquiUmaSemana.setDate(daquiUmaSemana.getDate() + 7);
  const limiteDaSemana = hojeIso(daquiUmaSemana);
  const vencemLogo = abertas.filter((t) => t.dueOn && t.dueOn <= limiteDaSemana).length;

  const numeros = [
    { v: estado.projetos.filter((p) => p.status === "active" && !p.archivedAt).length, l: "Processos ativos", alerta: false },
    { v: abertas.length, l: "Tarefas abertas", alerta: false },
    { v: vencemLogo, l: "Vencem em 7 dias", alerta: vencemLogo > 0 },
  ].filter((n) => n.v > 0);
  const carregando = api.status === "carregando" || estado.carregando;

  return (
    <Pagina largura={880}>
      <CabecalhoPagina titulo="Hoje" descricao="O que pede atenção nos seus processos e casos consultivos." />
      {!carregando && numeros.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3">
          {numeros.map((n) => (
            <div key={n.l} className="flex-[1_1_150px] rounded-xl border border-line bg-surface px-4 py-3.5">
              <p className={classes("text-2xl font-bold tracking-[-0.02em]", n.alerta ? "text-s-amber" : "text-ink")}>{n.v}</p>
              <p className="mt-0.5 text-[12.5px] text-ink2">{n.l}</p>
            </div>
          ))}
        </div>
      )}
      <p className="mb-2.5 mt-7 text-xs font-semibold text-ink3">Próximos lembretes</p>
      <ListaLembretes lembretes={lembretes.ativos.slice(0, 5)} projetos={projetosPorId} aoAbrirTarefa={setTarefaAberta} carregando={lembretes.carregando} />
      <p className="mb-2.5 mt-7 text-xs font-semibold text-ink3">Próximos prazos</p>
      <ListaTarefas tarefas={proximas} projetos={projetosPorId} aoAbrir={setTarefaAberta} aoAlternar={api.alternarConclusao} carregando={carregando} />
      <JanelaTarefa api={api} tarefaId={tarefaAberta} projetos={estado.projetos} aoFechar={() => setTarefaAberta(null)} />
    </Pagina>
  );
}
