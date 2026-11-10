import { describe, expect, it } from "vitest";
import pagina from "./exemplos/pagina-1.json";
import { criarClienteDjen, interpretarCorpo, MAXIMO_TEXTO, oabEstaNosDestinatarios, paraComunicacaoRecebida, type ItemDjen } from "./cliente-djen";

// Respostas gravadas em exemplos/, todas fictícias. Nenhuma chamada sai para a rede.

const PARAMETROS = { numeroOab: "9999991", ufOab: "RS", inicio: "2099-03-05", fim: "2099-03-20", pagina: 2 };

function fetchFalso(resposta: () => Response | Promise<Response>) {
  const chamadas: { url: URL; init?: RequestInit }[] = [];
  const f = (async (url: URL, init?: RequestInit) => {
    chamadas.push({ url, init });
    return resposta();
  }) as unknown as typeof fetch;
  return { f, chamadas };
}

const json = (corpo: unknown, status = 200, cabecalhos: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json", ...cabecalhos } });

describe("cliente do DJEN", () => {
  it("manda a OAB, a UF, a janela, a página e o User-Agent do Tempestivo", async () => {
    const { f, chamadas } = fetchFalso(() => json(pagina, 200, { "x-ratelimit-remaining": "17" }));
    const r = await criarClienteDjen({ userAgent: "Tempestivo/0.1.0 (+https://exemplo.invalid)", fetch: f }).buscarPagina(PARAMETROS);
    expect(r).toMatchObject({ tipo: "ok", restante: 17, total: 6 });
    const url = chamadas[0].url;
    expect(url.origin + url.pathname).toBe("https://comunicaapi.pje.jus.br/api/v1/comunicacao");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      numeroOab: "9999991",
      ufOab: "RS",
      dataDisponibilizacaoInicio: "2099-03-05",
      dataDisponibilizacaoFim: "2099-03-20",
      itensPorPagina: "100",
      pagina: "2",
    });
    expect((chamadas[0].init?.headers as Record<string, string>)["User-Agent"]).toBe("Tempestivo/0.1.0 (+https://exemplo.invalid)");
  });

  it("classifica 429, 5xx, outros erros, falha de rede e corpo que não é JSON", async () => {
    const com = (resposta: () => Response) => criarClienteDjen({ userAgent: "t", fetch: fetchFalso(resposta).f }).buscarPagina(PARAMETROS);
    expect(await com(() => json({}, 429))).toEqual({ tipo: "limite", status: 429 });
    expect(await com(() => json({}, 500))).toEqual({ tipo: "erro_servidor", status: 500 });
    expect(await com(() => json({}, 503))).toEqual({ tipo: "erro_servidor", status: 503 });
    expect(await com(() => json({}, 400))).toEqual({ tipo: "erro_cliente", status: 400 });
    expect(await com(() => new Response("<html>", { status: 200 }))).toMatchObject({ tipo: "formato" });
    const rede = criarClienteDjen({ userAgent: "t", fetch: (async () => Promise.reject(new TypeError("fetch failed"))) as unknown as typeof fetch });
    expect(await rede.buscarPagina(PARAMETROS)).toEqual({ tipo: "erro_rede", mensagem: "TypeError" });
  });

  it("restante ausente ou estranho vira null", async () => {
    const r = await criarClienteDjen({ userAgent: "t", fetch: fetchFalso(() => json(pagina, 200, { "x-ratelimit-remaining": "abc" })).f }).buscarPagina(PARAMETROS);
    expect(r).toMatchObject({ tipo: "ok", restante: null });
  });

  it("formato inesperado não passa", () => {
    expect(interpretarCorpo(null, 200, null)).toMatchObject({ tipo: "formato" });
    expect(interpretarCorpo({ status: "error", items: [] }, 200, null)).toMatchObject({ tipo: "formato" });
    expect(interpretarCorpo({ status: "success" }, 200, null)).toMatchObject({ tipo: "formato" });
    expect(interpretarCorpo({ status: "success", items: [{ id: "1" }] }, 200, null)).toMatchObject({ tipo: "formato" });
    expect(interpretarCorpo({ status: "success", items: [] }, 200, 5)).toEqual({ tipo: "ok", status: 200, restante: 5, total: 0, itens: [] });
  });
});

describe("o que sai da VPS", () => {
  const itens = pagina.items as ItemDjen[];

  it("confere a OAB entre os advogados, com ou sem zeros, e exige a mesma UF", () => {
    expect(oabEstaNosDestinatarios(itens[0], "9999991", "RS")).toBe(true);
    expect(oabEstaNosDestinatarios(itens[1], "9999991", "rs")).toBe(true); // "09999991" no DJEN
    expect(oabEstaNosDestinatarios(itens[4], "9999991", "RS")).toBe(false); // mesmo número, outra UF
    expect(oabEstaNosDestinatarios({ ...itens[0], destinatarioadvogados: null }, "9999991", "RS")).toBe(false);
  });

  it("descarta partes e advogados; só leva o sinal de sigilo e o cancelamento", () => {
    const c = paraComunicacaoRecebida(itens[0], "9999991", "RS")!;
    expect(Object.keys(c).sort()).toEqual(
      ["ativa", "classe", "dataDisponibilizacao", "destinatarioSigilo", "djenId", "hash", "link", "numeroProcesso", "orgao", "texto", "textoTruncado", "tipoComunicacao", "tipoDocumento", "tribunal"].sort(),
    );
    expect(c).toMatchObject({ djenId: 990000001, destinatarioSigilo: false, ativa: true, textoTruncado: false });
    expect(paraComunicacaoRecebida(itens[3], "9999991", "RS")).toMatchObject({ destinatarioSigilo: true, link: null });
    expect(paraComunicacaoRecebida(itens[5], "9999991", "RS")).toMatchObject({ ativa: false });
    expect(paraComunicacaoRecebida(itens[4], "9999991", "RS")).toBeNull();
  });

  it("teor longo demais vai cortado e marcado", () => {
    const c = paraComunicacaoRecebida({ ...itens[0], texto: "x".repeat(MAXIMO_TEXTO + 10) }, "9999991", "RS")!;
    expect(c.texto).toHaveLength(MAXIMO_TEXTO);
    expect(c.textoTruncado).toBe(true);
  });
});
