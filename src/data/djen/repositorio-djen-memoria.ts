import { CAPTURA_DESLIGADA, type CapturaDjen, type SugestaoDjen } from "@/domain/djen";
import type { RepositorioDjen } from "../repositorio-djen";

/**
 * Repositório da captura em memória, para os testes dos serviços e das rotas.
 * Reproduz as garantias da 0006 que os serviços usam: um djen_id por conta e a
 * última consulta boa zerada quando a OAB muda.
 */
export function criarRepositorioDjenEmMemoria(inicial?: { captura?: CapturaDjen | null; sugestoes?: SugestaoDjen[] }) {
  let captura: CapturaDjen | null = inicial?.captura ?? null;
  const sugestoes: SugestaoDjen[] = [...(inicial?.sugestoes ?? [])];
  let sequencia = 0;

  const repo: RepositorioDjen & { sugestoes: SugestaoDjen[]; captura: () => CapturaDjen | null } = {
    sugestoes,
    captura: () => captura,

    async obterCaptura() {
      return captura ? { ...captura } : null;
    },

    async salvarCaptura(dados) {
      const antes = captura ?? CAPTURA_DESLIGADA;
      const trocouOab = antes.numeroOab !== dados.numeroOab || antes.ufOab !== dados.ufOab;
      captura = { ...antes, ...dados, ultimaConsultaOk: trocouOab ? null : antes.ultimaConsultaOk };
      return { ...captura };
    },

    async registrarEstadoDaConsulta(estado) {
      if (!captura) return;
      captura = { ...captura, ...estado };
    },

    async inserirSugestoes(linhas) {
      let novas = 0;
      for (const l of linhas) {
        if (sugestoes.some((s) => s.djenId === l.djenId)) continue;
        sugestoes.push({ ...l, id: `s${++sequencia}`, status: "pendente", canceladaNoDjenEm: null, criadoEm: new Date(0).toISOString() });
        novas++;
      }
      return novas;
    },

    async marcarCanceladas(djenIds, quando) {
      let mudadas = 0;
      for (const s of sugestoes) {
        if (!djenIds.includes(s.djenId)) continue;
        s.canceladaNoDjenEm ??= quando;
        if (s.status === "pendente") {
          s.status = "cancelada";
          mudadas++;
        }
      }
      return mudadas;
    },

    async listarSugestoes(filtro) {
      return sugestoes.filter((s) => !filtro?.status?.length || filtro.status.includes(s.status)).map((s) => ({ ...s }));
    },

    async apagarSugestoesPendentes() {
      const antes = sugestoes.length;
      for (let i = sugestoes.length - 1; i >= 0; i--) if (sugestoes[i].status === "pendente") sugestoes.splice(i, 1);
      return antes - sugestoes.length;
    },
  };
  return repo;
}
