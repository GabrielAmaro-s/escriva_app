import type { Cliente, EspacoDeTrabalho, Etiqueta, Lembrete, Projeto, Quadro, RegistroAgente, Tarefa, TokenAgente } from "@/domain/tipos";
import { chamarApi } from "@/lib/chamar-api";
import type { Repositorio } from "../repositorio";

/**
 * Repositório do navegador quando há Supabase: cada operação vira uma chamada às rotas
 * /api, que rodam no servidor com a sessão do usuário (e o RLS).
 */

const soNoServidor = (o: string) => () => Promise.reject(new Error(`${o} só acontece no servidor do agente.`));

export function criarRepositorioHttp(): Repositorio {
  return {
    modo: "http",

    listarProjetos: () => chamarApi<Projeto[]>("/api/projetos"),
    criarProjeto: (dados, colunas) => chamarApi<Projeto>("/api/projetos", { metodo: "POST", corpo: { dados, colunas } }),
    atualizarProjeto: (id, dados) => chamarApi<Projeto>(`/api/projetos/${id}`, { metodo: "PATCH", corpo: dados }),
    excluirProjeto: (id) => chamarApi<void>(`/api/projetos/${id}`, { metodo: "DELETE" }),

    async obterQuadro(projetoId) {
      try {
        return await chamarApi<Quadro>(`/api/projetos/${projetoId}/quadro`);
      } catch (e) {
        if (e instanceof Error && e.message === "Projeto não encontrado.") return null;
        throw e;
      }
    },
    obterEspacoDeTrabalho: () => chamarApi<EspacoDeTrabalho>("/api/espaco-de-trabalho"),

    criarTarefa: (dados) => chamarApi<Tarefa>("/api/tarefas", { metodo: "POST", corpo: dados }),
    atualizarTarefa: (id, alteracao) => chamarApi<Tarefa>(`/api/tarefas/${id}`, { metodo: "PATCH", corpo: alteracao }),
    excluirTarefa: (id) => chamarApi<void>(`/api/tarefas/${id}`, { metodo: "DELETE" }),

    criarEtiqueta: (projetoId, nome, cor) => chamarApi<Etiqueta>("/api/etiquetas", { metodo: "POST", corpo: { projetoId, nome, cor } }),
    excluirEtiqueta: (id) => chamarApi<void>(`/api/etiquetas/${id}`, { metodo: "DELETE" }),

    listarClientes: () => chamarApi<Cliente[]>("/api/clientes"),
    criarCliente: (dados) => chamarApi<Cliente>("/api/clientes", { metodo: "POST", corpo: dados }),
    atualizarCliente: (id, dados) => chamarApi<Cliente>(`/api/clientes/${id}`, { metodo: "PATCH", corpo: dados }),
    excluirCliente: (id) => chamarApi<void>(`/api/clientes/${id}`, { metodo: "DELETE" }),

    listarLembretes(filtro = {}) {
      const parametros = new URLSearchParams();
      if (filtro.status) parametros.set("status", filtro.status.join(","));
      if (filtro.tarefaId) parametros.set("tarefaId", filtro.tarefaId);
      const lista = chamarApi<Lembrete[]>(`/api/lembretes${parametros.size ? `?${parametros}` : ""}`);
      return filtro.ate ? lista.then((l) => l.filter((x) => x.quando <= filtro.ate!)) : lista;
    },
    criarLembrete: (dados) => chamarApi<Lembrete>("/api/lembretes", { metodo: "POST", corpo: dados }),
    atualizarLembrete: (id, alteracao) => chamarApi<Lembrete>(`/api/lembretes/${id}`, { metodo: "PATCH", corpo: alteracao }),
    excluirLembrete: (id) => chamarApi<void>(`/api/lembretes/${id}`, { metodo: "DELETE" }),

    listarTokensAgente: () => chamarApi<TokenAgente[]>("/api/agente/tokens"),
    // O hash depende do segredo do servidor: a tela usa POST /api/agente/tokens.
    criarTokenAgente: soNoServidor("Criar token com hash"),
    async atualizarTokenAgente(id, alteracao) {
      if (!alteracao.revogadoEm) throw new Error("Pelo app só é possível revogar um token.");
      await chamarApi<void>(`/api/agente/tokens/${id}`, { metodo: "DELETE" });
    },

    listarRegistroAgente: () => chamarApi<RegistroAgente[]>("/api/agente/registro"),
    obterRegistroAgente: async (id) => (await chamarApi<RegistroAgente[]>("/api/agente/registro")).find((r) => r.id === id) ?? null,
    registrarAtividadeAgente: soNoServidor("Registrar atividade do agente"),
    marcarRegistroDesfeito: soNoServidor("Marcar ação como desfeita"),
    obterHeartbeatAgente: async () => (await chamarApi<{ ultimoSinalEm: string | null }>("/api/agente/estado")).ultimoSinalEm,
    registrarHeartbeatAgente: soNoServidor("Registrar sinal do agente"),
  };
}
