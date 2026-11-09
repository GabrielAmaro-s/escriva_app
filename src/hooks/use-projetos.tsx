"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { obterRepositorio } from "@/data";
import type { ModeloQuadro } from "@/domain/quadro";
import type { DadosProjeto, Projeto, StatusProjeto } from "@/domain/tipos";
import * as servico from "@/services/projetos";
import { useAviso } from "@/components/ui/aviso";

interface EstadoProjetos {
  projetos: Projeto[];
  carregando: boolean;
  erro: string | null;
  /** Sem modelo, usa o padrão do tipo (Cível/JEC ou Consultivo). */
  criar(dados: DadosProjeto, modelo?: ModeloQuadro): Promise<Projeto | null>;
  atualizar(id: string, dados: DadosProjeto, opcoes?: { silencioso?: boolean }): Promise<Projeto | null>;
  definirStatus(id: string, status: StatusProjeto): void;
  arquivar(id: string): void;
  restaurar(id: string): void;
  /** Remove da tela na hora e só apaga de vez se o aviso não for desfeito. */
  excluir(id: string): void;
  /** Mantém o progresso dos cartões em dia quando as tarefas mudam. */
  sincronizarContagens(contagens: Map<string, { taskCount: number; doneCount: number }>): void;
  recarregar(): void;
}

const Contexto = createContext<EstadoProjetos | null>(null);

export function useProjetos(): EstadoProjetos {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useProjetos precisa estar dentro de ProvedorProjetos");
  return ctx;
}

const mensagem = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado. Tente de novo.");
const TEMPO_DESFAZER_MS = 5000;

const AVISO_STATUS: Record<StatusProjeto, string> = {
  active: "Projeto reativado",
  paused: "Projeto pausado",
  done: "Projeto concluído",
};

export function ProvedorProjetos({ children }: { children: ReactNode }) {
  const repo = obterRepositorio();
  const avisar = useAviso();
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const exclusoesPendentes = useRef(new Map<string, { temporizador: ReturnType<typeof setTimeout>; executar: () => void }>());

  // Ao fechar a página, conclui as exclusões que ainda esperavam o "Desfazer".
  useEffect(() => {
    const concluirPendentes = () => exclusoesPendentes.current.forEach(({ temporizador, executar }) => (clearTimeout(temporizador), executar()));
    window.addEventListener("pagehide", concluirPendentes);
    return () => window.removeEventListener("pagehide", concluirPendentes);
  }, []);

  const recarregar = useCallback(() => {
    setCarregando(true);
    repo
      .listarProjetos()
      .then((lista) => {
        setProjetos(lista.filter((p) => !exclusoesPendentes.current.has(p.id)));
        setErro(null);
      })
      .catch((e) => setErro(mensagem(e)))
      .finally(() => setCarregando(false));
  }, [repo]);

  useEffect(recarregar, [recarregar]);

  const substituir = (p: Projeto) =>
    setProjetos((lista) => lista.map((x) => (x.id === p.id ? { ...p, taskCount: x.taskCount, doneCount: x.doneCount } : x)));

  /** Atualização otimista: aplica na tela, grava e desfaz se falhar. */
  const otimista = useCallback(
    (id: string, mudanca: Partial<Projeto>, executar: () => Promise<Projeto>, sucesso?: string, desfazer?: () => void) => {
      let anterior: Projeto | undefined;
      setProjetos((lista) =>
        lista.map((p) => {
          if (p.id !== id) return p;
          anterior = p;
          return { ...p, ...mudanca };
        }),
      );
      if (sucesso) avisar({ texto: sucesso, tom: "info", acao: desfazer ? { rotulo: "Desfazer", executar: desfazer } : undefined });
      executar()
        .then(substituir)
        .catch((e) => {
          if (anterior) substituir(anterior);
          avisar({ texto: mensagem(e), tom: "erro" });
        });
    },
    [avisar],
  );

  const valor = useMemo<EstadoProjetos>(
    () => ({
      projetos,
      carregando,
      erro,
      recarregar,
      async criar(dados, modelo) {
        try {
          const p = await servico.criarProjeto(repo, dados, modelo);
          setProjetos((lista) => [p, ...lista]);
          avisar({ texto: dados.kind === "campaign" ? "Campanha criada" : "Projeto criado", tom: "info" });
          return p;
        } catch (e) {
          avisar({ texto: mensagem(e), tom: "erro" });
          return null;
        }
      },
      async atualizar(id, dados, opcoes) {
        try {
          const p = await servico.atualizarProjeto(repo, id, dados);
          substituir(p);
          if (!opcoes?.silencioso) avisar({ texto: "Alterações salvas", tom: "info" });
          return p;
        } catch (e) {
          avisar({ texto: mensagem(e), tom: "erro" });
          return null;
        }
      },
      definirStatus(id, status) {
        otimista(id, { status }, () => servico.definirStatusProjeto(repo, id, status), AVISO_STATUS[status]);
      },
      arquivar(id) {
        otimista(id, { archivedAt: new Date().toISOString() }, () => servico.arquivarProjeto(repo, id), "Projeto arquivado", () =>
          otimista(id, { archivedAt: null }, () => servico.restaurarProjeto(repo, id)),
        );
      },
      restaurar(id) {
        otimista(id, { archivedAt: null }, () => servico.restaurarProjeto(repo, id), "Projeto restaurado");
      },
      excluir(id) {
        const indice = projetos.findIndex((p) => p.id === id);
        const removido = projetos[indice];
        if (!removido) return;
        setProjetos((lista) => lista.filter((p) => p.id !== id));
        const executar = () => {
          exclusoesPendentes.current.delete(id);
          servico.excluirProjeto(repo, id).catch((e) => {
            setProjetos((lista) => [...lista.slice(0, indice), removido, ...lista.slice(indice)]);
            avisar({ texto: mensagem(e), tom: "erro" });
          });
        };
        const temporizador = setTimeout(executar, TEMPO_DESFAZER_MS);
        exclusoesPendentes.current.set(id, { temporizador, executar });
        avisar({
          texto: removido.kind === "campaign" ? "Campanha excluída" : "Projeto excluído",
          tom: "info",
          acao: {
            rotulo: "Desfazer",
            executar: () => {
              clearTimeout(temporizador);
              exclusoesPendentes.current.delete(id);
              setProjetos((lista) => [...lista.slice(0, indice), removido, ...lista.slice(indice)]);
            },
          },
        });
      },
      sincronizarContagens(contagens) {
        setProjetos((lista) => {
          let mudou = false;
          const proxima = lista.map((p) => {
            const c = contagens.get(p.id);
            if (!c || (c.taskCount === p.taskCount && c.doneCount === p.doneCount)) return p;
            mudou = true;
            return { ...p, ...c };
          });
          return mudou ? proxima : lista;
        });
      },
    }),
    [projetos, carregando, erro, recarregar, repo, avisar, otimista],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
