"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAviso } from "@/components/ui/aviso";
import { obterRepositorio } from "@/data";
import { STATUS_ATIVOS, ordenarPorQuando } from "@/domain/lembrete";
import type { Lembrete, Tarefa } from "@/domain/tipos";
import * as servico from "@/services/lembretes";

interface EstadoLembretes {
  /** Lembretes que ainda vão tocar (pendentes ou agendados), em ordem de horário. */
  ativos: Lembrete[];
  carregando: boolean;
  tarefasComLembrete: Set<string>;
  /** Lembrete feito à mão da tarefa (os automáticos ficam de fora). */
  lembreteDaTarefa(tarefaId: string): Lembrete | undefined;
  /** Cria, remarca ou cancela (quando = null) o lembrete feito à mão de uma tarefa. */
  definirLembreteDaTarefa(tarefa: Tarefa, quando: string | null): Promise<void>;
  recarregar(): void;
}

const Contexto = createContext<EstadoLembretes | null>(null);

export function useLembretes(): EstadoLembretes {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useLembretes precisa estar dentro de ProvedorLembretes");
  return ctx;
}

const mensagem = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado. Tente de novo.");

export function ProvedorLembretes({ children }: { children: ReactNode }) {
  const repo = obterRepositorio();
  const avisar = useAviso();
  const [ativos, setAtivos] = useState<Lembrete[]>([]);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(() => {
    repo
      .listarLembretes({ status: STATUS_ATIVOS })
      .then((lista) => setAtivos(ordenarPorQuando(lista)))
      .catch(() => setAtivos([]))
      .finally(() => setCarregando(false));
  }, [repo]);

  useEffect(recarregar, [recarregar]);

  const substituir = useCallback((l: Lembrete) => {
    setAtivos((lista) => ordenarPorQuando([...lista.filter((x) => x.id !== l.id), ...(STATUS_ATIVOS.includes(l.status) ? [l] : [])]));
  }, []);

  // O campo "Lembrete" da tarefa é o feito à mão; os automáticos (D-3, D-1, no dia) seguem o prazo.
  const lembreteDaTarefa = useCallback((tarefaId: string) => ativos.find((l) => l.tarefaId === tarefaId && !l.automatico), [ativos]);

  const definirLembreteDaTarefa = useCallback(
    async (tarefa: Tarefa, quando: string | null) => {
      const atual = ativos.find((l) => l.tarefaId === tarefa.id && !l.automatico);
      try {
        if (!quando) {
          if (atual) substituir(await servico.cancelarLembrete(repo, atual.id));
          if (atual) avisar({ texto: "Lembrete removido", tom: "info" });
          return;
        }
        if (atual) {
          if (new Date(atual.quando).getTime() === new Date(quando).getTime()) return;
          substituir(await servico.remarcarLembrete(repo, atual.id, quando));
          avisar({ texto: "Lembrete remarcado", tom: "info" });
        } else {
          substituir(await servico.criarLembrete(repo, { texto: tarefa.title, quando, tarefaId: tarefa.id, projetoId: tarefa.projectId, origem: "app" }));
          avisar({ texto: "Lembrete criado", tom: "info" });
        }
      } catch (e) {
        avisar({ texto: mensagem(e), tom: "erro" });
      }
    },
    [ativos, repo, avisar, substituir],
  );

  const valor = useMemo<EstadoLembretes>(
    () => ({
      ativos,
      carregando,
      tarefasComLembrete: new Set(ativos.flatMap((l) => (l.tarefaId ? [l.tarefaId] : []))),
      lembreteDaTarefa,
      definirLembreteDaTarefa,
      recarregar,
    }),
    [ativos, carregando, lembreteDaTarefa, definirLembreteDaTarefa, recarregar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
