"use client";

import { useMemo, useState } from "react";
import { CabecalhoPagina, OpcoesFiltro, Pagina } from "@/components/ui/pecas";
import type { Projeto, Tarefa } from "@/domain/tipos";
import { useProjetos } from "@/hooks/use-projetos";
import { useTarefas } from "@/hooks/use-tarefas";
import { ListaTarefas } from "./lista-tarefas";
import { JanelaTarefa } from "./janela-tarefa";

const porPrazo = (a: Tarefa, b: Tarefa) =>
  (a.dueOn ?? "9999") < (b.dueOn ?? "9999") ? -1 : (a.dueOn ?? "9999") > (b.dueOn ?? "9999") ? 1 : 0;

/** Tarefas abertas de projetos que ainda estão em andamento, ordenadas por prazo. */
export function tarefasAbertas(tarefas: Tarefa[], projetos: Map<string, Projeto>): Tarefa[] {
  return tarefas
    .filter((t) => {
      const p = projetos.get(t.projectId);
      return !t.completed && p && p.status !== "done" && !p.archivedAt;
    })
    .sort(porPrazo);
}

export function TelaPrazos() {
  const estado = useProjetos();
  const api = useTarefas();
  const [filtro, setFiltro] = useState<"abertas" | "concluidas">("abertas");
  const [tarefaAberta, setTarefaAberta] = useState<string | null>(null);
  const projetosPorId = useMemo(() => new Map(estado.projetos.map((p) => [p.id, p])), [estado.projetos]);

  const linhas =
    filtro === "abertas"
      ? tarefasAbertas(api.tarefas, projetosPorId)
      : api.tarefas
          .filter((t) => {
            const p = projetosPorId.get(t.projectId);
            return t.completed && p && p.status !== "done" && !p.archivedAt;
          })
          .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const carregando = api.status === "carregando" || estado.carregando;

  return (
    <Pagina largura={880}>
      <CabecalhoPagina titulo="Prazos e tarefas" descricao="Todos os prazos e tarefas em um só lugar, ordenados pelo vencimento." />
      <div className="mt-[22px]">
        <OpcoesFiltro
          rotulo="Filtrar prazos e tarefas"
          valor={filtro}
          aoMudar={setFiltro}
          opcoes={[
            { valor: "abertas", rotulo: "Abertas" },
            { valor: "concluidas", rotulo: "Concluídas" },
          ]}
        />
      </div>
      <p className="mb-2.5 mt-[18px] text-xs font-semibold text-ink3">
        {filtro === "abertas" ? `Abertas · ${linhas.length} · ordenadas por prazo` : `Concluídas · ${linhas.length}`}
      </p>
      <ListaTarefas tarefas={linhas} projetos={projetosPorId} aoAbrir={setTarefaAberta} aoAlternar={api.alternarConclusao} carregando={carregando} />
      <JanelaTarefa api={api} tarefaId={tarefaAberta} projetos={estado.projetos} aoFechar={() => setTarefaAberta(null)} />
    </Pagina>
  );
}
