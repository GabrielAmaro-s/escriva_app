"use client";

import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  PauseIcon,
  PencilSimpleIcon,
  PlayIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ItemMenu } from "@/components/ui/menu-contexto";
import { dadosProjetoVazios, paraDadosProjeto } from "@/domain/projeto";
import type { Projeto, TipoProjeto } from "@/domain/tipos";
import { useProjetos } from "@/hooks/use-projetos";
import { FormularioProjeto } from "./formulario-projeto";

interface InterfaceProjeto {
  abrirNovo(tipo: TipoProjeto): void;
  abrirEdicao(projeto: Projeto): void;
  /** Ações do menu "..." de um projeto. `noQuadro` tira o "Abrir". */
  acoesDe(projeto: Projeto, opcoes?: { noQuadro?: boolean }): ItemMenu[];
}

const Contexto = createContext<InterfaceProjeto | null>(null);

export function useInterfaceProjeto(): InterfaceProjeto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useInterfaceProjeto precisa estar dentro de ProvedorInterfaceProjeto");
  return ctx;
}

/** Formulário de projeto e menu de ações, disponíveis em qualquer tela. */
export function ProvedorInterfaceProjeto({ children }: { children: ReactNode }) {
  const estado = useProjetos();
  const router = useRouter();
  const [formulario, setFormulario] = useState<{ aberto: boolean; tipo: TipoProjeto; projeto?: Projeto }>({ aberto: false, tipo: "project" });

  const abrirNovo = useCallback((tipo: TipoProjeto) => setFormulario({ aberto: true, tipo }), []);
  const abrirEdicao = useCallback((projeto: Projeto) => setFormulario({ aberto: true, tipo: projeto.kind, projeto }), []);

  const acoesDe = useCallback(
    (p: Projeto, opcoes?: { noQuadro?: boolean }): ItemMenu[] => {
      const itens: ItemMenu[] = [];
      if (!opcoes?.noQuadro) itens.push({ rotulo: "Abrir", icone: ArrowRightIcon, aoSelecionar: () => router.push(`/projetos/${p.id}`) });
      itens.push({ rotulo: "Editar", icone: PencilSimpleIcon, aoSelecionar: () => abrirEdicao(p) });
      if (p.archivedAt) {
        itens.push({ rotulo: "Restaurar", icone: ArrowCounterClockwiseIcon, aoSelecionar: () => estado.restaurar(p.id) });
      } else {
        itens.push(
          p.status === "paused"
            ? { rotulo: "Reativar", icone: PlayIcon, aoSelecionar: () => estado.definirStatus(p.id, "active") }
            : { rotulo: "Pausar", icone: PauseIcon, aoSelecionar: () => estado.definirStatus(p.id, "paused") },
        );
        if (p.status !== "done") itens.push({ rotulo: "Marcar como concluído", icone: CheckCircleIcon, aoSelecionar: () => estado.definirStatus(p.id, "done") });
        itens.push({ rotulo: "Arquivar", icone: ArchiveIcon, aoSelecionar: () => estado.arquivar(p.id) });
      }
      itens.push({
        rotulo: "Excluir",
        icone: TrashIcon,
        perigo: true,
        aoSelecionar: () => {
          if (opcoes?.noQuadro) router.push(p.kind === "campaign" ? "/campanhas" : "/");
          estado.excluir(p.id);
        },
      });
      return itens;
    },
    [router, estado, abrirEdicao],
  );

  const valor = useMemo(() => ({ abrirNovo, abrirEdicao, acoesDe }), [abrirNovo, abrirEdicao, acoesDe]);
  const inicial = formulario.projeto ? paraDadosProjeto(formulario.projeto) : dadosProjetoVazios(formulario.tipo);

  return (
    <Contexto.Provider value={valor}>
      {children}
      <FormularioProjeto
        aberto={formulario.aberto}
        editando={Boolean(formulario.projeto)}
        inicial={inicial}
        aoFechar={() => setFormulario((f) => ({ ...f, aberto: false }))}
        aoEnviar={async (dados, modelo) => {
          if (formulario.projeto) return Boolean(await estado.atualizar(formulario.projeto.id, dados));
          const criado = await estado.criar(dados, modelo);
          if (criado) router.push(`/projetos/${criado.id}`);
          return Boolean(criado);
        }}
      />
    </Contexto.Provider>
  );
}
