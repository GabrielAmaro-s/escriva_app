"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAviso } from "@/components/ui/aviso";
import { obterRepositorio } from "@/data";
import type { Cliente, DadosCliente } from "@/domain/tipos";
import * as servico from "@/services/clientes";
import { useProjetos } from "./use-projetos";

interface EstadoClientes {
  clientes: Cliente[];
  carregando: boolean;
  erro: string | null;
  /** Nome do cliente pelo id (cartões, busca e detalhes). */
  nomeDoCliente(id: string | null | undefined): string | undefined;
  criar(dados: DadosCliente, opcoes?: { silencioso?: boolean }): Promise<Cliente | null>;
  atualizar(id: string, dados: DadosCliente): Promise<Cliente | null>;
  /** Some da tela na hora e só apaga de vez se o aviso não for desfeito. */
  excluir(id: string): void;
  recarregar(): void;
}

const Contexto = createContext<EstadoClientes | null>(null);

export function useClientes(): EstadoClientes {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useClientes precisa estar dentro de ProvedorClientes");
  return ctx;
}

const mensagem = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado. Tente de novo.");
const TEMPO_DESFAZER_MS = 5000;
const porNome = (a: Cliente, b: Cliente) => a.nome.localeCompare(b.nome, "pt-BR");

export function ProvedorClientes({ children }: { children: ReactNode }) {
  const repo = obterRepositorio();
  const avisar = useAviso();
  const projetos = useProjetos();
  const [clientes, setClientes] = useState<Cliente[]>([]);
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
    servico
      .listarClientes(repo)
      .then((lista) => {
        setClientes(lista.filter((c) => !exclusoesPendentes.current.has(c.id)));
        setErro(null);
      })
      .catch((e) => setErro(mensagem(e)))
      .finally(() => setCarregando(false));
  }, [repo]);

  useEffect(recarregar, [recarregar]);

  const recarregarProjetos = projetos.recarregar;

  const valor = useMemo<EstadoClientes>(() => {
    const porId = new Map(clientes.map((c) => [c.id, c]));
    return {
      clientes,
      carregando,
      erro,
      recarregar,
      nomeDoCliente: (id) => (id ? porId.get(id)?.nome : undefined),
      async criar(dados, opcoes) {
        try {
          const c = await servico.criarCliente(repo, dados);
          setClientes((lista) => [...lista, c].sort(porNome));
          if (!opcoes?.silencioso) avisar({ texto: "Cliente cadastrado", tom: "info" });
          return c;
        } catch (e) {
          avisar({ texto: mensagem(e), tom: "erro" });
          return null;
        }
      },
      async atualizar(id, dados) {
        try {
          const c = await servico.atualizarCliente(repo, id, dados);
          setClientes((lista) => lista.map((x) => (x.id === id ? c : x)).sort(porNome));
          avisar({ texto: "Alterações salvas", tom: "info" });
          return c;
        } catch (e) {
          avisar({ texto: mensagem(e), tom: "erro" });
          return null;
        }
      },
      excluir(id) {
        const removido = porId.get(id);
        if (!removido) return;
        setClientes((lista) => lista.filter((c) => c.id !== id));
        const voltar = () => setClientes((lista) => [...lista, removido].sort(porNome));
        const executar = () => {
          exclusoesPendentes.current.delete(id);
          servico
            .excluirCliente(repo, id)
            // Os processos do cliente ficam sem cliente: recarrega para os cartões refletirem.
            .then(recarregarProjetos)
            .catch((e) => {
              voltar();
              avisar({ texto: mensagem(e), tom: "erro" });
            });
        };
        const temporizador = setTimeout(executar, TEMPO_DESFAZER_MS);
        exclusoesPendentes.current.set(id, { temporizador, executar });
        avisar({
          texto: "Cliente excluído",
          tom: "info",
          acao: {
            rotulo: "Desfazer",
            executar: () => {
              clearTimeout(temporizador);
              exclusoesPendentes.current.delete(id);
              voltar();
            },
          },
        });
      },
    };
  }, [clientes, carregando, erro, recarregar, repo, avisar, recarregarProjetos]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
