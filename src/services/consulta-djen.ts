// A consulta diária ao DJEN, como roda na VPS do agente (scripts/captura-djen.ts).
// Nunca roda em função da Vercel: o limite do DJEN é por IP, e o CNJ trata o uso de
// vários IPs para contornar o limite como abuso.
//
// Regras de uso (docs/relatorios/etapa-5.md):
// - quem decide se consulta e com que janela é o app (uma consulta boa por dia; se
//   falhar, mais duas tentativas no mesmo dia, com horas de intervalo);
// - a fila única é a trava do systemd (flock), fora deste arquivo;
// - pelo menos 5 s entre requisições, páginas de 100;
// - x-ratelimit-remaining em 2 ou menos: espera 60 s;
// - 429: espera 60 s e tenta mais uma vez; outro 429 encerra como "limite";
// - erro 500 ou de rede: novas tentativas depois de 30 s, 1, 2 e 4 min; depois, "falhou";
// - outro erro ou formato inesperado: "falhou" na hora.
//
// Só importações relativas com ".ts" (o Node roda este arquivo sem bundler).

import { ITENS_POR_ENVIO, type JanelaConsulta, type ComunicacaoRecebida } from "../domain/djen.ts";
import { ITENS_POR_PAGINA, paraComunicacaoRecebida, type ClienteDjen, type RespostaPagina } from "../data/djen/cliente-djen.ts";
import type { ClienteTempestivo, ResumoDoEnvio } from "../data/djen/cliente-tempestivo.ts";

export const INTERVALO_ENTRE_REQUISICOES_MS = 5_000;
export const ESPERA_DO_LIMITE_MS = 60_000;
export const RESTANTE_MINIMO = 2;
export const ESPERAS_DE_NOVA_TENTATIVA_MS = [30_000, 60_000, 120_000, 240_000];
/** 50 páginas de 100: muito acima do que uma janela de até 30 dias traz para um advogado. */
export const PAGINAS_MAXIMAS = 50;

export interface DependenciasConsulta {
  djen: ClienteDjen;
  app: ClienteTempestivo;
  esperar: (ms: number) => Promise<void>;
  agora: () => number;
  /** Só contagens e códigos HTTP: o log nunca recebe teor, nome ou número de processo. */
  registrar: (mensagem: string) => void;
}

export type FimDaConsulta =
  | { situacao: "sem_consulta"; motivo: string }
  | { situacao: "ok" | "falhou" | "limite"; janela: JanelaConsulta; paginas: number; requisicoes: number; recebidas: number; foraDaOab: number; envio: ResumoDoEnvio; motivo?: string };

type Falha = { resultado: "falhou" | "limite"; motivo: string };

export async function executarConsultaDoDia(dep: DependenciasConsulta): Promise<FimDaConsulta> {
  const plano = await dep.app.iniciarConsulta();
  if (!plano.consultar) {
    dep.registrar(`sem consulta: ${plano.motivo}`);
    return { situacao: "sem_consulta", motivo: plano.motivo };
  }
  const { janela, numeroOab, ufOab } = plano;
  dep.registrar(`consulta ${janela.inicio} a ${janela.fim}, tentativa ${plano.tentativa} do dia`);

  let ultimaRequisicao = Number.NEGATIVE_INFINITY;
  let requisicoes = 0;
  let houve429 = false;
  let esperaAntesDaProxima = 0;

  /** Uma página, com o intervalo, o limite e as novas tentativas. */
  async function requisitar(pagina: number): Promise<Extract<RespostaPagina, { tipo: "ok" }> | Falha> {
    let novasTentativas = 0;
    for (;;) {
      const falta = Math.max(esperaAntesDaProxima, ultimaRequisicao + INTERVALO_ENTRE_REQUISICOES_MS - dep.agora());
      if (falta > 0) await dep.esperar(falta);
      esperaAntesDaProxima = 0;
      ultimaRequisicao = dep.agora();
      requisicoes++;
      const r = await dep.djen.buscarPagina({ numeroOab, ufOab, inicio: janela.inicio, fim: janela.fim, pagina });
      if (r.tipo === "ok") {
        if (r.restante !== null && r.restante <= RESTANTE_MINIMO) {
          dep.registrar(`restam ${r.restante} requisições: espera 60 s`);
          esperaAntesDaProxima = ESPERA_DO_LIMITE_MS;
        }
        return r;
      }
      if (r.tipo === "limite") {
        if (houve429) return { resultado: "limite", motivo: "429 pela segunda vez" };
        houve429 = true;
        dep.registrar("429: espera 60 s e tenta mais uma vez");
        esperaAntesDaProxima = ESPERA_DO_LIMITE_MS;
        continue;
      }
      if (r.tipo === "erro_servidor" || r.tipo === "erro_rede") {
        const codigo = r.tipo === "erro_servidor" ? `HTTP ${r.status}` : `rede (${r.mensagem})`;
        if (novasTentativas >= ESPERAS_DE_NOVA_TENTATIVA_MS.length) return { resultado: "falhou", motivo: `${codigo} depois de ${novasTentativas} novas tentativas` };
        const espera = ESPERAS_DE_NOVA_TENTATIVA_MS[novasTentativas++];
        dep.registrar(`${codigo}: nova tentativa em ${espera / 1000} s`);
        esperaAntesDaProxima = espera;
        continue;
      }
      return { resultado: "falhou", motivo: r.tipo === "erro_cliente" ? `HTTP ${r.status}` : `formato inesperado (${r.mensagem})` };
    }
  }

  const envio: ResumoDoEnvio = { recebidas: 0, novas: 0, repetidas: 0, canceladas: 0, invalidas: 0 };
  let recebidas = 0;
  let foraDaOab = 0;
  let paginas = 0;
  let falha: Falha | null = null;

  for (let pagina = 1; ; pagina++) {
    if (pagina > PAGINAS_MAXIMAS) {
      falha = { resultado: "falhou", motivo: `mais de ${PAGINAS_MAXIMAS} páginas` };
      break;
    }
    const r = await requisitar(pagina);
    if ("resultado" in r) {
      falha = r;
      break;
    }
    paginas++;
    recebidas += r.itens.length;
    const itens: ComunicacaoRecebida[] = [];
    for (const item of r.itens) {
      const c = paraComunicacaoRecebida(item, numeroOab, ufOab);
      if (c) itens.push(c);
      else foraDaOab++;
    }
    for (let i = 0; i < itens.length; i += ITENS_POR_ENVIO) {
      const resumo = await dep.app.enviarComunicacoes(itens.slice(i, i + ITENS_POR_ENVIO));
      for (const chave of Object.keys(envio) as (keyof ResumoDoEnvio)[]) envio[chave] += resumo[chave];
    }
    if (r.itens.length < ITENS_POR_PAGINA || pagina * ITENS_POR_PAGINA >= r.total) break;
  }

  const resultado = falha?.resultado ?? "ok";
  await dep.app.concluirConsulta({ resultado, janela });
  dep.registrar(
    `${resultado}${falha ? ` (${falha.motivo})` : ""}: ${requisicoes} requisições, ${paginas} páginas, ${recebidas} itens, ${foraDaOab} fora da OAB, ` +
      `${envio.novas} novas, ${envio.repetidas} repetidas, ${envio.canceladas} canceladas, ${envio.invalidas} inválidas`,
  );
  return { situacao: resultado, janela, paginas, requisicoes, recebidas, foraDaOab, envio, motivo: falha?.motivo };
}
