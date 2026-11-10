"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { obterRepositorio } from "@/data";
import { fusoDoAparelho } from "@/domain/datas";
import { ajustarAlteracaoAoTipo } from "@/domain/prazos";
import { alteracaoAoAlternarConclusao, alteracaoAoMudarColuna, posicaoNoTopo, proximaPosicaoNaColuna } from "@/domain/quadro";
import { TONS_PROJETO } from "@/domain/projeto";
import type { AlteracaoTarefa, Coluna, Etiqueta, Tarefa } from "@/domain/tipos";
import { alterarTarefa as alterarTarefaServico, mexeNosLembretes, sincronizarLembretesAutomaticos } from "@/services/prazos";
import { adicionarTarefa as adicionarTarefaServico } from "@/services/tarefas";
import { useAviso } from "@/components/ui/aviso";
import { useLembretes } from "./use-lembretes";
import { useProjetos } from "./use-projetos";

const mensagem = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado. Tente de novo.");
const TEMPO_DESFAZER_MS = 5000;

type Pendente = { alteracao: AlteracaoTarefa; reverter: Tarefa | undefined; temporizador: ReturnType<typeof setTimeout> };

/**
 * Estado das tarefas com atualização otimista.
 * Com `projetoId` carrega um quadro; sem ele, as tarefas de todos os projetos.
 */
export function useTarefas(projetoId?: string) {
  const repo = obterRepositorio();
  const avisar = useAviso();
  const { sincronizarContagens } = useProjetos();
  const { recarregar: recarregarLembretes } = useLembretes();
  const [status, setStatus] = useState<"carregando" | "pronto" | "ausente" | "erro">("carregando");
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [colunas, setColunas] = useState<Coluna[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const fila = useRef(new Map<string, Promise<unknown>>());
  const pendentes = useRef(new Map<string, Pendente>());
  const exclusoesPendentes = useRef(new Map<string, { temporizador: ReturnType<typeof setTimeout>; executar: () => void }>());

  useEffect(() => {
    let ativo = true;
    setStatus("carregando");
    const carregar = projetoId
      ? repo.obterQuadro(projetoId).then((q) => (q ? { colunas: q.colunas, tarefas: q.tarefas, etiquetas: q.etiquetas } : null))
      : repo.obterEspacoDeTrabalho();
    carregar
      .then((e) => {
        if (!ativo) return;
        if (!e) return setStatus("ausente");
        setColunas(e.colunas);
        setTarefas(e.tarefas);
        setEtiquetas(e.etiquetas);
        setStatus("pronto");
      })
      .catch(() => ativo && setStatus("erro"));
    return () => {
      ativo = false;
    };
  }, [projetoId, repo]);

  // O progresso dos projetos acompanha as tarefas.
  useEffect(() => {
    if (status !== "pronto") return;
    const contagens = new Map<string, { taskCount: number; doneCount: number }>();
    if (projetoId) contagens.set(projetoId, { taskCount: 0, doneCount: 0 });
    for (const t of tarefas) {
      const c = contagens.get(t.projectId) ?? { taskCount: 0, doneCount: 0 };
      c.taskCount += 1;
      if (t.completed) c.doneCount += 1;
      contagens.set(t.projectId, c);
    }
    sincronizarContagens(contagens);
  }, [tarefas, status, projetoId, sincronizarContagens]);

  const enviar = useCallback(
    (id: string) => {
      const item = pendentes.current.get(id);
      if (!item) return;
      clearTimeout(item.temporizador);
      pendentes.current.delete(id);
      const anterior = fila.current.get(id) ?? Promise.resolve();
      // O service limpa os campos que não valem para o tipo e acerta os lembretes automáticos.
      const proxima = anterior
        .then(() =>
          item.reverter ? alterarTarefaServico(repo, item.reverter, item.alteracao, { fuso: fusoDoAparelho() }) : repo.atualizarTarefa(id, item.alteracao),
        )
        .then(() => {
          if (mexeNosLembretes(item.alteracao)) recarregarLembretes();
        })
        .catch((e) => {
          if (item.reverter) setTarefas((lista) => lista.map((t) => (t.id === id ? item.reverter! : t)));
          avisar({ texto: mensagem(e), tom: "erro" });
        });
      fila.current.set(id, proxima);
    },
    [repo, avisar, recarregarLembretes],
  );

  /** Junta edições em sequência (digitação, por exemplo) numa única gravação. */
  const persistir = useCallback(
    (id: string, alteracao: AlteracaoTarefa, reverter: Tarefa | undefined) => {
      const item = pendentes.current.get(id);
      if (item) clearTimeout(item.temporizador);
      pendentes.current.set(id, {
        alteracao: { ...item?.alteracao, ...alteracao },
        reverter: item?.reverter ?? reverter,
        temporizador: setTimeout(() => enviar(id), 350),
      });
    },
    [enviar],
  );

  useEffect(() => {
    const enviarTudo = () => {
      [...pendentes.current.keys()].forEach(enviar);
      exclusoesPendentes.current.forEach(({ temporizador, executar }) => (clearTimeout(temporizador), executar()));
    };
    window.addEventListener("pagehide", enviarTudo);
    return () => {
      window.removeEventListener("pagehide", enviarTudo);
      enviarTudo();
    };
  }, [enviar]);

  const colunasDe = useCallback(
    (pid: string) => colunas.filter((c) => c.projectId === pid).sort((a, b) => a.position - b.position),
    [colunas],
  );
  const etiquetasDe = useCallback((pid: string) => etiquetas.filter((l) => l.projectId === pid), [etiquetas]);
  const etiquetasPorId = useMemo(() => new Map(etiquetas.map((l) => [l.id, l])), [etiquetas]);

  const atualizarTarefa = useCallback(
    (id: string, alteracao: AlteracaoTarefa) => {
      let antes: Tarefa | undefined;
      setTarefas((lista) =>
        lista.map((t) => {
          if (t.id !== id) return t;
          antes = t;
          // Trocar o tipo limpa na tela os campos que não valem mais (o service faz o mesmo ao gravar).
          return { ...t, ...ajustarAlteracaoAoTipo(t, alteracao) };
        }),
      );
      persistir(id, alteracao, antes);
    },
    [persistir],
  );

  const moverTarefa = useCallback(
    (id: string, coluna: Coluna, posicao?: number) => {
      const tarefa = tarefas.find((t) => t.id === id);
      if (!tarefa) return;
      const mudouColuna = tarefa.columnId !== coluna.id;
      atualizarTarefa(id, {
        ...alteracaoAoMudarColuna(tarefa, coluna),
        position:
          posicao ??
          proximaPosicaoNaColuna(
            tarefas.filter((t) => t.id !== id),
            coluna.id,
          ),
      });
      if (mudouColuna) avisar({ texto: `Movida para “${coluna.title}”`, tom: "info" });
    },
    [tarefas, atualizarTarefa, avisar],
  );

  /** Alterna entre concluída e aberta, movendo para a coluna correspondente. */
  const alternarConclusao = useCallback(
    (id: string) => {
      const tarefa = tarefas.find((t) => t.id === id);
      if (tarefa) atualizarTarefa(id, alteracaoAoAlternarConclusao(tarefa, colunasDe(tarefa.projectId), tarefas));
    },
    [tarefas, colunasDe, atualizarTarefa],
  );

  const adicionarTarefa = useCallback(
    async (coluna: Coluna, titulo: string) => {
      try {
        const tarefa = await adicionarTarefaServico(repo, coluna, titulo, posicaoNoTopo(tarefas, coluna.id));
        setTarefas((lista) => [...lista, tarefa]);
        return tarefa;
      } catch (e) {
        avisar({ texto: mensagem(e), tom: "erro" });
        return null;
      }
    },
    [repo, tarefas, avisar],
  );

  const duplicarTarefa = useCallback(
    async (id: string) => {
      const tarefa = tarefas.find((t) => t.id === id);
      if (!tarefa) return;
      try {
        const copia = await repo.criarTarefa({
          projectId: tarefa.projectId,
          columnId: tarefa.columnId,
          title: `${tarefa.title} (cópia)`.slice(0, 200),
          description: tarefa.description,
          dueOn: tarefa.dueOn,
          tipo: tarefa.tipo,
          prazoFatal: tarefa.prazoFatal,
          contagem: tarefa.contagem,
          localAudiencia: tarefa.localAudiencia,
          horarioAudiencia: tarefa.horarioAudiencia,
          priority: tarefa.priority,
          labelIds: tarefa.labelIds,
          position: tarefa.position + 0.5,
        });
        const completa = await repo.atualizarTarefa(copia.id, {
          checklist: tarefa.checklist,
          links: tarefa.links,
          completed: tarefa.completed,
          completedAt: tarefa.completedAt,
        });
        setTarefas((lista) => [...lista, completa]);
        await sincronizarLembretesAutomaticos(repo, completa, { fuso: fusoDoAparelho() });
        recarregarLembretes();
        avisar({ texto: "Tarefa duplicada", tom: "info" });
      } catch (e) {
        avisar({ texto: mensagem(e), tom: "erro" });
      }
    },
    [repo, tarefas, avisar, recarregarLembretes],
  );

  /** Some da tela na hora; só apaga de vez se o aviso não for desfeito. */
  const excluirTarefa = useCallback(
    (id: string) => {
      const tarefa = tarefas.find((t) => t.id === id);
      if (!tarefa) return;
      const item = pendentes.current.get(id);
      if (item) clearTimeout(item.temporizador);
      pendentes.current.delete(id);
      setTarefas((lista) => lista.filter((t) => t.id !== id));
      const executar = () => {
        exclusoesPendentes.current.delete(id);
        repo.excluirTarefa(id).catch((e) => {
          setTarefas((lista) => [...lista, tarefa]);
          avisar({ texto: mensagem(e), tom: "erro" });
        });
      };
      const temporizador = setTimeout(executar, TEMPO_DESFAZER_MS);
      exclusoesPendentes.current.set(id, { temporizador, executar });
      avisar({
        texto: "Tarefa excluída",
        tom: "info",
        acao: {
          rotulo: "Desfazer",
          executar: () => {
            clearTimeout(temporizador);
            exclusoesPendentes.current.delete(id);
            setTarefas((lista) => [...lista, tarefa]);
          },
        },
      });
    },
    [repo, tarefas, avisar],
  );

  const criarEtiqueta = useCallback(
    async (pid: string, nome: string) => {
      const limpo = nome.trim().slice(0, 40);
      if (!limpo) return null;
      const existente = etiquetas.find((l) => l.projectId === pid && l.name.toLowerCase() === limpo.toLowerCase());
      if (existente) return existente;
      try {
        const quantidade = etiquetas.filter((l) => l.projectId === pid).length;
        const etiqueta = await repo.criarEtiqueta(pid, limpo, [...TONS_PROJETO, "gray" as const][quantidade % 7]);
        setEtiquetas((l) => [...l, etiqueta]);
        return etiqueta;
      } catch (e) {
        avisar({ texto: mensagem(e), tom: "erro" });
        return null;
      }
    },
    [repo, etiquetas, avisar],
  );

  return {
    status,
    tarefas,
    colunas,
    etiquetas,
    etiquetasPorId,
    colunasDe,
    etiquetasDe,
    atualizarTarefa,
    moverTarefa,
    alternarConclusao,
    adicionarTarefa,
    duplicarTarefa,
    excluirTarefa,
    criarEtiqueta,
  };
}

export type ApiTarefas = ReturnType<typeof useTarefas>;
