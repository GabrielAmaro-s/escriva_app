"use client";

import { MagnifyingGlassIcon, PlusIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CabecalhoPagina, CampoBusca, EstadoVazio, OpcoesFiltro, Pagina } from "@/components/ui/pecas";
import { Botao } from "@/components/ui/botao";
import { type FiltroProjetos, filtrarProjetos } from "@/domain/projeto";
import { useProjetos } from "@/hooks/use-projetos";
import { CartaoProjeto } from "./cartao-projeto";
import { useInterfaceProjeto } from "./interface-projeto";

export function TelaProjetos() {
  const parametros = useSearchParams();
  const router = useRouter();
  const estado = useProjetos();
  const { abrirNovo } = useInterfaceProjeto();
  const [busca, setBusca] = useState("");
  const filtro = (parametros.get("filtro") as FiltroProjetos | null) ?? "all";
  const definirFiltro = (f: FiltroProjetos) => router.replace(f === "all" ? "/" : `/?filtro=${f}`, { scroll: false });

  const contagens = useMemo(() => {
    const visiveis = estado.projetos.filter((p) => !p.archivedAt);
    return {
      all: visiveis.length,
      active: visiveis.filter((p) => p.status === "active").length,
      paused: visiveis.filter((p) => p.status === "paused").length,
      done: visiveis.filter((p) => p.status === "done").length,
      archived: estado.projetos.length - visiveis.length,
    };
  }, [estado.projetos]);

  const lista = filtrarProjetos(estado.projetos, filtro, busca);
  const opcoes: { valor: FiltroProjetos; rotulo: string }[] = [
    { valor: "all", rotulo: `Todos (${contagens.all})` },
    { valor: "active", rotulo: `Ativos (${contagens.active})` },
    { valor: "paused", rotulo: `Pausados (${contagens.paused})` },
    { valor: "done", rotulo: `Concluídos (${contagens.done})` },
  ];
  // "Arquivados" só aparece quando há algo arquivado.
  if (contagens.archived > 0 || filtro === "archived") opcoes.push({ valor: "archived", rotulo: `Arquivados (${contagens.archived})` });

  const botaoNovo = (
    <Botao variante="primaria" onClick={() => abrirNovo("project")}>
      <PlusIcon size={15} weight="bold" />
      Novo projeto
    </Botao>
  );

  return (
    <Pagina largura={1240}>
      <CabecalhoPagina titulo="Meus projetos" descricao="Acompanhe e gerencie todos os seus projetos e campanhas." acao={botaoNovo} />

      <div className="mb-5 mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <CampoBusca valor={busca} aoMudar={setBusca} placeholder="Buscar projetos…" />
        <OpcoesFiltro rotulo="Filtrar por status" valor={filtro} aoMudar={definirFiltro} opcoes={opcoes} />
      </div>

      {estado.carregando ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-[214px] animate-pulse rounded-[14px] border border-line bg-surface" />
          ))}
        </div>
      ) : estado.erro ? (
        <EstadoVazio icone={WarningCircleIcon} titulo="Não foi possível carregar seus projetos" texto={estado.erro}>
          <Botao tamanho="sm" onClick={estado.recarregar}>
            Tentar de novo
          </Botao>
        </EstadoVazio>
      ) : lista.length === 0 ? (
        contagens.all === 0 && contagens.archived === 0 ? (
          <EstadoVazio icone={PlusIcon} titulo="Comece seu primeiro projeto" texto="Cada projeto ganha um quadro para você mover as tarefas conforme avançam.">
            <Botao variante="primaria" tamanho="sm" onClick={() => abrirNovo("project")}>
              + Novo projeto
            </Botao>
          </EstadoVazio>
        ) : (
          <EstadoVazio icone={MagnifyingGlassIcon} titulo="Nenhum projeto encontrado" texto="Ajuste a busca ou o filtro, ou comece algo novo.">
            <Botao
              tamanho="sm"
              onClick={() => {
                setBusca("");
                definirFiltro("all");
              }}
            >
              Limpar filtros
            </Botao>
            <Botao variante="primaria" tamanho="sm" onClick={() => abrirNovo("project")}>
              + Novo projeto
            </Botao>
          </EstadoVazio>
        )
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-4">
          {lista.map((p) => (
            <CartaoProjeto key={p.id} projeto={p} />
          ))}
        </div>
      )}
    </Pagina>
  );
}
