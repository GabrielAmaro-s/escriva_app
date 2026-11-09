"use client";

import { useCallback, useEffect, useState } from "react";
import { useAviso } from "@/components/ui/aviso";
import { obterRepositorio } from "@/data";
import { MARGEM_PADRAO } from "@/domain/prazos";
import type { DadosNovoFeriado, Feriado } from "@/domain/tipos";
import { criarFeriadoLocal, excluirFeriadoLocal, salvarPreferencias } from "@/services/prazos";

const mensagem = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado. Tente de novo.");

/** Feriados (carga dos tribunais e locais) e margem padrão do prazo interno. */
export function usePrazos() {
  const repo = obterRepositorio();
  const avisar = useAviso();
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [margemPadrao, setMargemPadrao] = useState(MARGEM_PADRAO);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    Promise.all([repo.listarFeriados(), repo.obterPreferencias()])
      .then(([f, p]) => {
        if (!ativo) return;
        setFeriados(f);
        setMargemPadrao(p.margemPrazoInterno);
      })
      .catch((e) => ativo && avisar({ texto: mensagem(e), tom: "erro" }))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [repo, avisar]);

  const criarFeriado = useCallback(
    async (dados: DadosNovoFeriado) => {
      try {
        const f = await criarFeriadoLocal(repo, dados);
        setFeriados((lista) => [...lista, f].sort((a, b) => a.data.localeCompare(b.data)));
        avisar({ texto: "Feriado cadastrado", tom: "info" });
        return true;
      } catch (e) {
        avisar({ texto: mensagem(e), tom: "erro" });
        return false;
      }
    },
    [repo, avisar],
  );

  const excluirFeriado = useCallback(
    async (id: string) => {
      try {
        await excluirFeriadoLocal(repo, id);
        setFeriados((lista) => lista.filter((f) => f.id !== id));
      } catch (e) {
        avisar({ texto: mensagem(e), tom: "erro" });
      }
    },
    [repo, avisar],
  );

  const salvarMargem = useCallback(
    async (margem: number) => {
      const anterior = margemPadrao;
      setMargemPadrao(margem);
      try {
        await salvarPreferencias(repo, { margemPrazoInterno: margem });
      } catch (e) {
        setMargemPadrao(anterior);
        avisar({ texto: mensagem(e), tom: "erro" });
      }
    },
    [repo, avisar, margemPadrao],
  );

  const historicoDaTarefa = useCallback((tarefaId: string) => repo.listarAlteracoesDaTarefa(tarefaId), [repo]);

  return { feriados, margemPadrao, carregando, criarFeriado, excluirFeriado, salvarMargem, historicoDaTarefa };
}
