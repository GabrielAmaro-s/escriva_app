"use client";

import { ArrowLeftIcon, DotsThreeIcon, InfoIcon, KanbanIcon, PlusIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useInterfaceProjeto } from "@/components/projects/interface-projeto";
import { JanelaTarefa } from "@/components/tasks/janela-tarefa";
import { SeloStatus } from "@/components/ui/pecas";
import { Botao, BotaoIcone } from "@/components/ui/botao";
import { useMenuDeContexto } from "@/components/ui/menu-contexto";
import { useProjetos } from "@/hooks/use-projetos";
import { useTarefas } from "@/hooks/use-tarefas";
import { classes } from "@/lib/classes";
import { QuadroKanban } from "./quadro-kanban";
import { AbaDetalhes } from "./aba-detalhes";

export function TelaQuadro({ projetoId }: { projetoId: string }) {
  const parametros = useSearchParams();
  const router = useRouter();
  const estado = useProjetos();
  const api = useTarefas(projetoId);
  const abrirMenu = useMenuDeContexto();
  const { acoesDe } = useInterfaceProjeto();
  const [tarefaAberta, setTarefaAberta] = useState<string | null>(parametros.get("tarefa"));
  const [adicionando, setAdicionando] = useState<string | null>(null);
  const aba = parametros.get("aba") === "detalhes" ? "detalhes" : "quadro";
  const projeto = estado.projetos.find((p) => p.id === projetoId) ?? null;
  const colunas = api.colunasDe(projetoId);

  useEffect(() => {
    if (projeto) document.title = `${projeto.name} | myPlan`;
  }, [projeto]);

  const definirAba = (a: "quadro" | "detalhes") => router.replace(`/projetos/${projetoId}${a === "detalhes" ? "?aba=detalhes" : ""}`, { scroll: false });

  if (api.status === "carregando" || (estado.carregando && !projeto)) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 px-4 pt-5 nav:px-10 nav:pt-8">
        <div className="h-9 w-72 animate-pulse rounded-lg bg-hover" />
        <div className="flex gap-3.5">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-96 min-w-[262px] flex-1 animate-pulse rounded-[14px] bg-hover" />
          ))}
        </div>
      </div>
    );
  }

  if (api.status !== "pronto" || !projeto) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col items-start gap-2 px-4 py-10 nav:px-10">
        <h1 className="text-xl font-bold">{api.status === "erro" ? "Não foi possível abrir o quadro" : "Este processo não existe mais"}</h1>
        <p className="text-sm text-ink2">{api.status === "erro" ? "Verifique sua conexão e recarregue a página." : "Ele pode ter sido excluído."}</p>
        <Link href="/" className="mt-2 text-sm font-medium text-primary">
          Voltar para Processos
        </Link>
      </div>
    );
  }

  const voltar = projeto.kind === "campaign" ? "/consultivo" : "/";
  const adicionarNoTopo = () => {
    definirAba("quadro");
    setAdicionando(colunas.find((c) => c.kind === "todo")?.id ?? colunas[0]?.id ?? null);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 animate-in flex-col px-4 pb-10 pt-5 nav:px-10 nav:pb-12 nav:pt-8">
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div className="flex min-w-0 flex-[1_1_320px] items-start gap-3">
          <BotaoIcone rotulo="Voltar" tamanho="icone-sm" className="mt-0.5 size-8" onClick={() => router.push(voltar)}>
            <ArrowLeftIcon size={18} />
          </BotaoIcone>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="m-0 text-[26px] font-bold leading-[1.2] tracking-[-0.025em]">{projeto.name}</h1>
              <SeloStatus status={projeto.status} arquivado={Boolean(projeto.archivedAt)} className="px-2.5" />
            </div>
            {projeto.description && <p className="mt-[5px] text-[13.5px] text-ink2">{projeto.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BotaoIcone
            rotulo="Mais opções"
            variante="secundaria"
            tamanho="icone"
            className="text-ink2"
            onClick={(e) => abrirMenu(e, acoesDe(projeto, { noQuadro: true }))}
          >
            <DotsThreeIcon size={16} weight="bold" />
          </BotaoIcone>
          <Botao variante="primaria" onClick={adicionarNoTopo}>
            <PlusIcon size={15} weight="bold" />
            Adicionar tarefa
          </Botao>
        </div>
      </div>

      <div role="tablist" aria-label="Visualização" className="mb-4 mt-5 flex gap-1.5 border-b border-line pb-3">
        {(
          [
            { id: "quadro", rotulo: "Quadro", icone: KanbanIcon },
            { id: "detalhes", rotulo: "Detalhes", icone: InfoIcon },
          ] as const
        ).map(({ id, rotulo, icone: Glifo }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            onClick={() => definirAba(id)}
            className={classes(
              "inline-flex h-8 items-center gap-[7px] rounded-lg border-0 px-3 text-[13px] font-medium transition-[background] duration-150",
              aba === id ? "bg-primary-soft text-primary" : "bg-transparent text-ink2 hover:bg-hover",
            )}
          >
            <Glifo size={15} />
            {rotulo}
          </button>
        ))}
      </div>

      {aba === "quadro" ? (
        <QuadroKanban api={api} colunas={colunas} adicionando={adicionando} definirAdicionando={setAdicionando} aoAbrirTarefa={setTarefaAberta} />
      ) : (
        <AbaDetalhes projeto={projeto} />
      )}

      <JanelaTarefa api={api} tarefaId={tarefaAberta} projetos={estado.projetos} aoFechar={() => setTarefaAberta(null)} />
    </div>
  );
}
