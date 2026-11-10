import { describe, expect, it } from "vitest";
import pagina from "@/data/djen/exemplos/pagina-1.json";
import { paraComunicacaoRecebida, type ItemDjen } from "@/data/djen/cliente-djen";
import type { ClienteTempestivo } from "@/data/djen/cliente-tempestivo";
import { criarRepositorioDjenEmMemoria } from "@/data/djen/repositorio-djen-memoria";
import { CAPTURA_DESLIGADA, type CapturaDjen, type ComunicacaoRecebida } from "@/domain/djen";
import { ErroDeValidacao } from "@/domain/erros";
import { concluirConsulta, desligarCaptura, iniciarConsulta, ligarCaptura, obterCaptura, receberComunicacoes, resumoDoTeor } from "./captura-djen";
import { executarConsultaDoDia } from "./consulta-djen";

// Tudo fictício: OAB 9999991/RS, processos de 2099.

const FUSO = "America/Sao_Paulo";
const as = (dia: string, hora: string) => new Date(`${dia}T${hora}:00-03:00`);
const ctx = (agora: Date) => ({ fuso: FUSO, agora });
const itens = pagina.items as ItemDjen[];
const recebidas = (): ComunicacaoRecebida[] => itens.map((i) => paraComunicacaoRecebida(i, "9999991", "RS")).filter((c): c is ComunicacaoRecebida => c !== null);
const ligada: CapturaDjen = { ...CAPTURA_DESLIGADA, ligada: true, numeroOab: "9999991", ufOab: "RS", avisoAceitoEm: "2099-03-01T10:00:00.000Z" };

describe("configuração da captura", () => {
  it("vem desligada", async () => {
    expect(await obterCaptura(criarRepositorioDjenEmMemoria())).toEqual(CAPTURA_DESLIGADA);
  });

  it("liga só com OAB válida e o aviso de cobertura aceito", async () => {
    const repo = criarRepositorioDjenEmMemoria();
    await expect(ligarCaptura(repo, { numeroOab: "abc", ufOab: "RS", avisoAceito: true }, ctx(as("2099-03-01", "10:00")))).rejects.toThrow(ErroDeValidacao);
    await expect(ligarCaptura(repo, { numeroOab: "9999991", ufOab: "RS", avisoAceito: false }, ctx(as("2099-03-01", "10:00")))).rejects.toThrow(/aviso de cobertura/);
    expect(await obterCaptura(repo)).toEqual(CAPTURA_DESLIGADA);
    const c = await ligarCaptura(repo, { numeroOab: "09999991", ufOab: "rs", avisoAceito: true }, ctx(as("2099-03-01", "10:00")));
    expect(c).toMatchObject({ ligada: true, numeroOab: "9999991", ufOab: "RS", avisoAceitoEm: "2099-03-01T13:00:00.000Z" });
  });

  it("trocar a OAB apaga as pendentes da anterior e recomeça a janela", async () => {
    const repo = criarRepositorioDjenEmMemoria({ captura: { ...ligada, ultimaConsultaOk: "2099-03-19" } });
    await receberComunicacoes(repo, recebidas(), ctx(as("2099-03-20", "07:00")));
    await ligarCaptura(repo, { numeroOab: "9999992", ufOab: "RS", avisoAceito: true }, ctx(as("2099-03-20", "09:00")));
    expect(repo.sugestoes).toHaveLength(0);
    expect((await obterCaptura(repo)).ultimaConsultaOk).toBeNull();
  });

  it("desligar apaga as pendentes, mantém as registradas e guarda a OAB", async () => {
    const repo = criarRepositorioDjenEmMemoria({ captura: ligada });
    await receberComunicacoes(repo, recebidas(), ctx(as("2099-03-20", "07:00")));
    repo.sugestoes[0].status = "registrada";
    const { captura, apagadas } = await desligarCaptura(repo);
    expect(captura).toMatchObject({ ligada: false, numeroOab: "9999991" });
    expect(apagadas).toBe(3);
    expect(repo.sugestoes.map((s) => s.status)).toEqual(["registrada"]);
  });
});

describe("tentativas do dia", () => {
  it("registra a tentativa ao iniciar e só avança a última consulta com ok", async () => {
    const repo = criarRepositorioDjenEmMemoria({ captura: { ...ligada, ultimaConsultaOk: "2099-03-19" } });
    const plano = await iniciarConsulta(repo, ctx(as("2099-03-20", "07:00")));
    expect(plano).toEqual({ consultar: true, janela: { inicio: "2099-03-17", fim: "2099-03-20" }, tentativa: 1, numeroOab: "9999991", ufOab: "RS" });
    expect(repo.captura()).toMatchObject({ tentativasNoDia: 1, ultimoResultado: "em_andamento", ultimaTentativaEm: "2099-03-20T10:00:00.000Z" });

    await concluirConsulta(repo, { resultado: "falhou", janela: { inicio: "2099-03-17", fim: "2099-03-20" } }, ctx(as("2099-03-20", "07:20")));
    expect(repo.captura()).toMatchObject({ ultimaConsultaOk: "2099-03-19", ultimoResultado: "falhou" });

    expect(await iniciarConsulta(repo, ctx(as("2099-03-20", "09:00")))).toEqual({ consultar: false, motivo: "cedo_demais" });
    expect(await iniciarConsulta(repo, ctx(as("2099-03-20", "12:00")))).toMatchObject({ consultar: true, tentativa: 2 });
    await concluirConsulta(repo, { resultado: "ok", janela: { inicio: "2099-03-17", fim: "2099-03-20" } }, ctx(as("2099-03-20", "12:05")));
    expect(repo.captura()).toMatchObject({ ultimaConsultaOk: "2099-03-20", ultimoResultado: "ok" });
    expect(await iniciarConsulta(repo, ctx(as("2099-03-20", "17:00")))).toEqual({ consultar: false, motivo: "feita_hoje" });
  });

  it("uma queda no meio (em_andamento) também conta no limite de 3 por dia", async () => {
    const repo = criarRepositorioDjenEmMemoria({ captura: ligada });
    for (const hora of ["07:00", "12:00", "17:00"]) expect(await iniciarConsulta(repo, ctx(as("2099-03-20", hora)))).toMatchObject({ consultar: true });
    expect(await iniciarConsulta(repo, ctx(as("2099-03-20", "22:00")))).toEqual({ consultar: false, motivo: "tentativas_esgotadas" });
    expect(await iniciarConsulta(repo, ctx(as("2099-03-21", "07:00")))).toMatchObject({ consultar: true, tentativa: 1 });
  });

  it("recusa janela que não termina hoje e conclusão com a captura desligada", async () => {
    const repo = criarRepositorioDjenEmMemoria({ captura: ligada });
    await expect(concluirConsulta(repo, { resultado: "ok", janela: { inicio: "2099-03-01", fim: "2099-03-25" } }, ctx(as("2099-03-20", "07:00")))).rejects.toThrow(/não termina hoje/);
    await expect(concluirConsulta(repo, { resultado: "ok", janela: { inicio: "2099-03-10", fim: "2099-03-05" } }, ctx(as("2099-03-20", "07:00")))).rejects.toThrow(/inválida/);
    const desligada = criarRepositorioDjenEmMemoria();
    await expect(concluirConsulta(desligada, { resultado: "ok", janela: { inicio: "2099-03-17", fim: "2099-03-20" } }, ctx(as("2099-03-20", "07:00")))).rejects.toThrow(/desligada/);
  });
});

describe("sugestões", () => {
  it("cada comunicação nova vira uma sugestão pendente; a cancelada não cria outra", async () => {
    const repo = criarRepositorioDjenEmMemoria({ captura: ligada });
    const resumo = await receberComunicacoes(repo, recebidas(), ctx(as("2099-03-20", "07:00")));
    expect(resumo).toEqual({ recebidas: 5, novas: 4, repetidas: 0, canceladas: 0, invalidas: 0 });
    expect(repo.sugestoes.map((s) => [s.djenId, s.status, s.sigiloso, s.diasSituacao, s.dias])).toEqual([
      [990000001, "pendente", false, "identificados", 15],
      [990000002, "pendente", false, "nao_identificados", null],
      [990000003, "pendente", false, "nao_identificados", null],
      [990000004, "pendente", true, null, null],
    ]);
  });

  it("o id do DJEN é a chave: a sobreposição de datas e as novas tentativas não duplicam", async () => {
    const repo = criarRepositorioDjenEmMemoria({ captura: ligada });
    await receberComunicacoes(repo, recebidas(), ctx(as("2099-03-20", "07:00")));
    const lote = recebidas();
    const segunda = await receberComunicacoes(repo, [...lote, lote[0]], ctx(as("2099-03-21", "07:00")));
    expect(segunda).toMatchObject({ novas: 0, repetidas: 5 });
    expect(repo.sugestoes).toHaveLength(4);
  });

  it("cancelada pelo tribunal: a pendente vira cancelada; a registrada só ganha a marca", async () => {
    const repo = criarRepositorioDjenEmMemoria({ captura: ligada });
    const [a, b] = recebidas();
    await receberComunicacoes(repo, [a, b], ctx(as("2099-03-20", "07:00")));
    repo.sugestoes[1].status = "registrada";
    const r = await receberComunicacoes(repo, [{ ...a, ativa: false }, { ...b, ativa: false }], ctx(as("2099-03-21", "07:00")));
    expect(r).toMatchObject({ canceladas: 1, novas: 0 });
    expect(repo.sugestoes.map((s) => [s.status, s.canceladaNoDjenEm])).toEqual([
      ["cancelada", "2099-03-21T10:00:00.000Z"],
      ["registrada", "2099-03-21T10:00:00.000Z"],
    ]);
  });

  it("sigiloso: só o aviso, sem cálculo, sem partes e sem teor", async () => {
    const repo = criarRepositorioDjenEmMemoria({ captura: ligada });
    await receberComunicacoes(repo, recebidas(), ctx(as("2099-03-20", "07:00")));
    const s = repo.sugestoes.find((x) => x.sigiloso)!;
    expect(s).toMatchObject({ orgao: null, classe: null, link: null, trecho: null, dias: null, diasSituacao: null, resumoTeor: null, hash: null });
  });

  it("guarda o resumo do teor, não o teor", async () => {
    const repo = criarRepositorioDjenEmMemoria({ captura: ligada });
    await receberComunicacoes(repo, recebidas(), ctx(as("2099-03-20", "07:00")));
    expect(repo.sugestoes[0].resumoTeor).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(repo.sugestoes)).not.toMatch(/<p>|FULAN|BELTRANO|EMPRESA FICT|ADVOGAD/);
    expect(resumoDoTeor("A  b\nC")).toBe(resumoDoTeor("a b c"));
  });

  it("item inválido é contado e não entra; captura desligada recusa tudo", async () => {
    const repo = criarRepositorioDjenEmMemoria({ captura: ligada });
    const [a] = recebidas();
    expect(await receberComunicacoes(repo, [{ ...a, numeroProcesso: "1" }], ctx(as("2099-03-20", "07:00")))).toMatchObject({ invalidas: 1, novas: 0 });
    await expect(receberComunicacoes(criarRepositorioDjenEmMemoria(), [a], ctx(as("2099-03-20", "07:00")))).rejects.toThrow(/desligada/);
    await expect(receberComunicacoes(repo, Array(21).fill(a), ctx(as("2099-03-20", "07:00")))).rejects.toThrow(/até 20/);
  });
});

describe("de ponta a ponta: VPS, app e repositório", () => {
  it("a consulta das 7h com a página de exemplo vira 4 sugestões, e a das 12h nem chama o DJEN", async () => {
    const repo = criarRepositorioDjenEmMemoria({ captura: ligada });
    let agora = as("2099-03-20", "07:00");
    const app: ClienteTempestivo = {
      iniciarConsulta: async () => iniciarConsulta(repo, ctx(agora)),
      enviarComunicacoes: (lote) => receberComunicacoes(repo, lote, ctx(agora)),
      concluirConsulta: async (d) => {
        await concluirConsulta(repo, d, ctx(agora));
      },
    };
    let requisicoes = 0;
    const dep = {
      djen: { buscarPagina: async () => (requisicoes++, { tipo: "ok" as const, status: 200, restante: 19, total: itens.length, itens }) },
      app,
      esperar: async () => {},
      agora: () => agora.getTime(),
      registrar: () => {},
    };
    expect(await executarConsultaDoDia(dep)).toMatchObject({ situacao: "ok", envio: { novas: 4 } });
    expect(repo.captura()).toMatchObject({ ultimaConsultaOk: "2099-03-20", ultimoResultado: "ok" });
    agora = as("2099-03-20", "12:00");
    expect(await executarConsultaDoDia(dep)).toEqual({ situacao: "sem_consulta", motivo: "feita_hoje" });
    expect(requisicoes).toBe(1);
  });
});
