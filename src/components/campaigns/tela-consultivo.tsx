"use client";

import { CalendarBlankIcon, CheckCircleIcon, DotsThreeIcon, MegaphoneIcon, PlusIcon, TargetIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useInterfaceProjeto } from "@/components/projects/interface-projeto";
import { BarraProgresso, BlocoTom, CabecalhoPagina, CampoBusca, EstadoVazio, OpcoesFiltro, Pagina, SeloStatus } from "@/components/ui/pecas";
import { Botao } from "@/components/ui/botao";
import { useMenuDeContexto } from "@/components/ui/menu-contexto";
import { formatarPeriodo } from "@/domain/quadro";
import { calcularProgresso, filtrarProjetos } from "@/domain/projeto";
import type { Projeto } from "@/domain/tipos";
import { useProjetos } from "@/hooks/use-projetos";

type Filtro = "all" | "active" | "done";

export function TelaConsultivo() {
  const estado = useProjetos();
  const { abrirNovo } = useInterfaceProjeto();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("all");

  const casos = estado.projetos.filter((p) => p.kind === "campaign" && !p.archivedAt);
  const contar = (f: Filtro) => casos.filter((p) => f === "all" || (f === "done") === (p.status === "done")).length;
  const linhas = filtrarProjetos(casos, "all", busca).filter((p) => filtro === "all" || (filtro === "done") === (p.status === "done"));

  return (
    <Pagina largura={1040}>
      <CabecalhoPagina
        titulo="Consultivo"
        descricao="Contratos, pareceres, notificações e outros trabalhos fora do processo."
        acao={
          <Botao variante="primaria" onClick={() => abrirNovo("campaign")}>
            <PlusIcon size={15} weight="bold" />
            Novo caso consultivo
          </Botao>
        }
      />

      <div className="mb-5 mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <CampoBusca valor={busca} aoMudar={setBusca} placeholder="Buscar casos consultivos…" />
        <OpcoesFiltro
          rotulo="Filtrar casos consultivos"
          valor={filtro}
          aoMudar={setFiltro}
          opcoes={[
            { valor: "all", rotulo: `Todos (${contar("all")})` },
            { valor: "active", rotulo: `Ativos (${contar("active")})` },
            { valor: "done", rotulo: `Concluídos (${contar("done")})` },
          ]}
        />
      </div>

      {!estado.carregando && linhas.length === 0 ? (
        <EstadoVazio icone={MegaphoneIcon} titulo="Nenhum caso consultivo por aqui" texto="Crie um caso consultivo para planejar entregas, tipo de serviço e período.">
          <Botao variante="primaria" tamanho="sm" onClick={() => abrirNovo("campaign")}>
            + Novo caso consultivo
          </Botao>
        </EstadoVazio>
      ) : (
        <div className="flex flex-col gap-3">
          {estado.carregando
            ? Array.from({ length: 3 }, (_, i) => <div key={i} className="h-[98px] animate-pulse rounded-[14px] border border-line bg-surface" />)
            : linhas.map((p) => <LinhaConsultivo key={p.id} projeto={p} />)}
        </div>
      )}
    </Pagina>
  );
}

function LinhaConsultivo({ projeto }: { projeto: Projeto }) {
  const router = useRouter();
  const abrirMenu = useMenuDeContexto();
  const { acoesDe } = useInterfaceProjeto();
  const c = projeto.campaign;
  const entregas = c?.deliverables ?? [];
  const pct = calcularProgresso(projeto);
  const abrir = () => router.push(`/projetos/${projeto.id}`);
  const menu = (e: React.MouseEvent) => abrirMenu(e, acoesDe(projeto));

  return (
    <article
      tabIndex={0}
      aria-label={projeto.name}
      onClick={abrir}
      onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && abrir()}
      onContextMenu={menu}
      className="relative flex cursor-pointer flex-wrap items-center gap-x-6 gap-y-4 rounded-[14px] border border-line bg-surface py-4 pl-[18px] pr-[52px] transition-[border-color,box-shadow] duration-150 hover:border-line2 hover:shadow-card"
    >
      <BlocoTom tom={projeto.color} icone={projeto.icon} tamanho={40} />
      <div className="min-w-0 flex-[1_1_300px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{projeto.name}</h3>
          <SeloStatus status={projeto.status} className="py-0.5" />
        </div>
        {projeto.description && <p className="mt-[3px] text-[12.5px] text-ink2">{projeto.description}</p>}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink2">
          <span className="inline-flex items-center gap-1.5">
            <TargetIcon size={14} />
            {c?.objective || "Sem objetivo"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarBlankIcon size={14} />
            {formatarPeriodo(c?.startsOn ?? null, c?.endsOn ?? null)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MegaphoneIcon size={14} />
            {c?.channels.length ? c.channels.join(", ") : "Sem tipo de serviço"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircleIcon size={14} />
            {entregas.filter((e) => e.done).length} de {entregas.length} entregas
          </span>
        </div>
      </div>
      <div className="flex flex-[0_0_150px] flex-col gap-[7px]">
        <div className="flex justify-between text-xs text-ink2">
          <span>Progresso</span>
          <span className="font-semibold text-ink">{pct}%</span>
        </div>
        <BarraProgresso valor={pct} tom={projeto.color} concluido={projeto.status === "done"} />
      </div>
      <button
        type="button"
        aria-label="Mais opções"
        onClick={menu}
        className="absolute right-3 top-3 grid size-7 place-items-center rounded-[7px] border-0 bg-transparent text-ink3 hover:bg-hover hover:text-ink"
      >
        <DotsThreeIcon size={16} weight="bold" />
      </button>
    </article>
  );
}
