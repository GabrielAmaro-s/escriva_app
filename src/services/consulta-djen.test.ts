import { describe, expect, it } from "vitest";
import pagina from "@/data/djen/exemplos/pagina-1.json";
import type { ClienteDjen, ItemDjen, RespostaPagina } from "@/data/djen/cliente-djen";
import type { ClienteTempestivo, PlanoRecebido } from "@/data/djen/cliente-tempestivo";
import type { ComunicacaoRecebida } from "@/domain/djen";
import { executarConsultaDoDia, INTERVALO_ENTRE_REQUISICOES_MS } from "./consulta-djen";

// A política de uso do DJEN com relógio falso: nenhuma espera é de verdade.

const PLANO: PlanoRecebido = { consultar: true, janela: { inicio: "2099-03-05", fim: "2099-03-20" }, tentativa: 1, numeroOab: "9999991", ufOab: "RS" };
const itens = pagina.items as ItemDjen[];
const ok = (lista: ItemDjen[], total = lista.length, restante: number | null = 18): RespostaPagina => ({ tipo: "ok", status: 200, restante, total, itens: lista });

function montar(respostas: RespostaPagina[], plano: PlanoRecebido = PLANO) {
  let relogio = 0;
  const esperas: number[] = [];
  const instantes: number[] = [];
  const enviados: ComunicacaoRecebida[][] = [];
  const conclusoes: unknown[] = [];
  const log: string[] = [];
  const paginasPedidas: number[] = [];
  const djen: ClienteDjen = {
    async buscarPagina(p) {
      instantes.push(relogio);
      paginasPedidas.push(p.pagina);
      const r = respostas.shift();
      if (!r) throw new Error("requisição a mais");
      return r;
    },
  };
  const app: ClienteTempestivo = {
    iniciarConsulta: async () => plano,
    enviarComunicacoes: async (lote) => {
      enviados.push(lote);
      return { recebidas: lote.length, novas: lote.length, repetidas: 0, canceladas: 0, invalidas: 0 };
    },
    concluirConsulta: async (d) => {
      conclusoes.push(d);
    },
  };
  const dep = {
    djen,
    app,
    esperar: async (ms: number) => {
      esperas.push(ms);
      relogio += ms;
    },
    agora: () => relogio,
    registrar: (m: string) => log.push(m),
  };
  return { dep, esperas, instantes, enviados, conclusoes, log, paginasPedidas, restantes: respostas };
}

describe("consulta do dia na VPS", () => {
  it("o app diz que não é hora: nenhuma requisição ao DJEN", async () => {
    const t = montar([], { consultar: false, motivo: "feita_hoje" });
    expect(await executarConsultaDoDia(t.dep)).toEqual({ situacao: "sem_consulta", motivo: "feita_hoje" });
    expect(t.instantes).toEqual([]);
    expect(t.conclusoes).toEqual([]);
  });

  it("uma página: filtra pela OAB, envia e conclui com ok", async () => {
    const t = montar([ok(itens)]);
    const fim = await executarConsultaDoDia(t.dep);
    expect(fim).toMatchObject({ situacao: "ok", paginas: 1, requisicoes: 1, recebidas: 6, foraDaOab: 1 });
    expect(t.enviados.flat().map((c) => c.djenId)).toEqual([990000001, 990000002, 990000003, 990000004, 990000006]);
    expect(t.conclusoes).toEqual([{ resultado: "ok", janela: PLANO.janela }]);
  });

  it("várias páginas, com pelo menos 5 s entre requisições, e lotes de até 20 para o app", async () => {
    const cem = Array.from({ length: 100 }, (_, i) => ({ ...itens[0], id: 990001000 + i }));
    const t = montar([ok(cem, 130), ok(cem.slice(0, 30), 130)]);
    await executarConsultaDoDia(t.dep);
    expect(t.paginasPedidas).toEqual([1, 2]);
    expect(t.instantes[1] - t.instantes[0]).toBeGreaterThanOrEqual(INTERVALO_ENTRE_REQUISICOES_MS);
    expect(t.enviados.map((l) => l.length)).toEqual([20, 20, 20, 20, 20, 20, 10]);
  });

  it("restante em 2 ou menos: espera 60 s antes da próxima", async () => {
    const cem = Array.from({ length: 100 }, (_, i) => ({ ...itens[0], id: 990002000 + i }));
    const t = montar([ok(cem, 150, 2), ok([], 150)]);
    await executarConsultaDoDia(t.dep);
    expect(t.instantes[1] - t.instantes[0]).toBe(60_000);
  });

  it("429: espera 60 s e tenta uma vez", async () => {
    const t = montar([{ tipo: "limite", status: 429 }, ok(itens)]);
    expect(await executarConsultaDoDia(t.dep)).toMatchObject({ situacao: "ok", requisicoes: 2 });
    expect(t.instantes[1] - t.instantes[0]).toBe(60_000);
  });

  it("segundo 429: para e conclui como limite, sem mais requisições", async () => {
    const t = montar([{ tipo: "limite", status: 429 }, { tipo: "limite", status: 429 }, ok(itens)]);
    expect(await executarConsultaDoDia(t.dep)).toMatchObject({ situacao: "limite", requisicoes: 2 });
    expect(t.conclusoes).toEqual([{ resultado: "limite", janela: PLANO.janela }]);
    expect(t.restantes).toHaveLength(1);
  });

  it("erro 500: novas tentativas depois de 30 s, 1, 2 e 4 min", async () => {
    const t = montar([{ tipo: "erro_servidor", status: 500 }, { tipo: "erro_rede", mensagem: "TypeError" }, { tipo: "erro_servidor", status: 502 }, ok(itens)]);
    expect(await executarConsultaDoDia(t.dep)).toMatchObject({ situacao: "ok", requisicoes: 4 });
    expect(t.instantes.slice(1).map((x, i) => x - t.instantes[i])).toEqual([30_000, 60_000, 120_000]);
  });

  it("depois de 4 novas tentativas com erro, conclui como falhou", async () => {
    const erro: RespostaPagina = { tipo: "erro_servidor", status: 500 };
    const t = montar([erro, erro, erro, erro, erro, ok(itens)]);
    expect(await executarConsultaDoDia(t.dep)).toMatchObject({ situacao: "falhou", requisicoes: 5 });
    expect(t.instantes.slice(1).map((x, i) => x - t.instantes[i])).toEqual([30_000, 60_000, 120_000, 240_000]);
    expect(t.conclusoes).toEqual([{ resultado: "falhou", janela: PLANO.janela }]);
  });

  it("formato inesperado ou outro erro: falhou na hora", async () => {
    const t = montar([{ tipo: "formato", mensagem: "sem lista de itens" }]);
    expect(await executarConsultaDoDia(t.dep)).toMatchObject({ situacao: "falhou", requisicoes: 1 });
    const u = montar([{ tipo: "erro_cliente", status: 400 }]);
    expect(await executarConsultaDoDia(u.dep)).toMatchObject({ situacao: "falhou", requisicoes: 1 });
  });

  it("falha na segunda página: o que já veio é enviado, mas a consulta não conta como boa", async () => {
    const cem = Array.from({ length: 100 }, (_, i) => ({ ...itens[0], id: 990003000 + i }));
    const t = montar([ok(cem, 150), { tipo: "formato", mensagem: "x" }]);
    expect(await executarConsultaDoDia(t.dep)).toMatchObject({ situacao: "falhou" });
    expect(t.enviados.flat()).toHaveLength(100);
    expect(t.conclusoes).toEqual([{ resultado: "falhou", janela: PLANO.janela }]);
  });

  it("o log tem só contagens e códigos: nada de teor, nome ou número de processo", async () => {
    const t = montar([{ tipo: "erro_servidor", status: 500 }, ok(itens)]);
    await executarConsultaDoDia(t.dep);
    const log = t.log.join("\n");
    expect(log).toContain("HTTP 500");
    expect(log).not.toMatch(/FULAN|FICT|5000\d{3}|50000\d{15}|9999991|Intim/);
  });
});
