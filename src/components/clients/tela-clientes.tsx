"use client";

import { MagnifyingGlassIcon, PlusIcon, UsersIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Botao } from "@/components/ui/botao";
import { CabecalhoPagina, CampoBusca, EstadoVazio, Pagina } from "@/components/ui/pecas";
import { ROTULO_TIPO_CLIENTE, filtrarClientes, formatarDocumento } from "@/domain/cliente";
import type { Cliente } from "@/domain/tipos";
import { useClientes } from "@/hooks/use-clientes";
import { useProjetos } from "@/hooks/use-projetos";
import { FormularioCliente } from "./formulario-cliente";

export function TelaClientes() {
  const estado = useClientes();
  const { projetos } = useProjetos();
  const [busca, setBusca] = useState("");
  const [janela, setJanela] = useState<{ aberta: boolean; cliente: Cliente | null }>({ aberta: false, cliente: null });

  // Quantos processos e casos consultivos ativos cada cliente tem.
  const casosPorCliente = useMemo(() => {
    const contagem = new Map<string, { processos: number; consultivos: number }>();
    for (const p of projetos) {
      if (!p.clienteId || p.archivedAt) continue;
      const c = contagem.get(p.clienteId) ?? { processos: 0, consultivos: 0 };
      if (p.kind === "campaign") c.consultivos += 1;
      else c.processos += 1;
      contagem.set(p.clienteId, c);
    }
    return contagem;
  }, [projetos]);

  const lista = filtrarClientes(estado.clientes, busca);
  const novo = () => setJanela({ aberta: true, cliente: null });

  return (
    <Pagina largura={1040}>
      <CabecalhoPagina
        titulo="Clientes"
        descricao="Quem você atende, com os processos e casos consultivos de cada um."
        acao={
          <Botao variante="primaria" onClick={novo}>
            <PlusIcon size={15} weight="bold" />
            Novo cliente
          </Botao>
        }
      />

      <div className="mb-5 mt-6">
        <CampoBusca valor={busca} aoMudar={setBusca} placeholder="Buscar por nome, CPF ou CNPJ…" />
      </div>

      {estado.carregando ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-[62px] animate-pulse rounded-xl border border-line bg-surface-raised" />
          ))}
        </div>
      ) : estado.erro ? (
        <EstadoVazio icone={WarningCircleIcon} titulo="Não foi possível carregar seus clientes" texto={estado.erro}>
          <Botao tamanho="sm" onClick={estado.recarregar}>
            Tentar de novo
          </Botao>
        </EstadoVazio>
      ) : lista.length === 0 ? (
        estado.clientes.length === 0 ? (
          <EstadoVazio icone={UsersIcon} titulo="Cadastre seu primeiro cliente" texto="Depois é só escolher o cliente ao criar um processo ou caso consultivo.">
            <Botao variante="primaria" tamanho="sm" onClick={novo}>
              + Novo cliente
            </Botao>
          </EstadoVazio>
        ) : (
          <EstadoVazio icone={MagnifyingGlassIcon} titulo="Nenhum cliente encontrado" texto="Confira o nome ou o documento digitado.">
            <Botao tamanho="sm" onClick={() => setBusca("")}>
              Limpar busca
            </Botao>
          </EstadoVazio>
        )
      ) : (
        <ul className="flex flex-col overflow-hidden rounded-[14px] border border-line bg-surface-raised">
          {lista.map((c) => {
            const casos = casosPorCliente.get(c.id);
            const resumo = [
              casos?.processos ? `${casos.processos} ${casos.processos === 1 ? "processo" : "processos"}` : null,
              casos?.consultivos ? `${casos.consultivos} ${casos.consultivos === 1 ? "caso consultivo" : "casos consultivos"}` : null,
            ].filter(Boolean);
            return (
              <li key={c.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => setJanela({ aberta: true, cliente: c })}
                  className="flex w-full flex-wrap items-center gap-x-6 gap-y-1 border-0 bg-transparent px-4 py-3 text-left hover:bg-hover"
                >
                  <span className="min-w-0 flex-[1_1_220px]">
                    <span className="block text-[14px] font-semibold">{c.nome}</span>
                    <span className="block text-xs text-ink-muted">
                      {ROTULO_TIPO_CLIENTE[c.tipo]}
                      {c.documento ? ` · ${formatarDocumento(c.documento)}` : ""}
                    </span>
                  </span>
                  <span className="flex-[0_1_200px] text-xs text-ink-muted">{c.telefone || c.email || ""}</span>
                  <span className="flex-[0_1_220px] text-xs text-ink-muted">{resumo.length ? resumo.join(", ") : "Nenhum caso ativo"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <FormularioCliente aberto={janela.aberta} cliente={janela.cliente} aoFechar={() => setJanela((j) => ({ ...j, aberta: false }))} />
    </Pagina>
  );
}
