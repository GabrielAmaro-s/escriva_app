import { describe, expect, it } from "vitest";
import { armazenamentoVazio, criarRepositorioLocal } from "@/data/local/repositorio-local";
import { calcularHashDoToken, gerarToken, revogarToken, validarToken, type TokenGuardado } from "./tokens";
import { cancelarLembrete, criarLembrete, lembretesProximos, marcarLembrete, remarcarLembrete } from "./lembretes";

const CONFIG = { segredo: "s".repeat(48), validadeDias: 90 };

function cenario() {
  const dados = armazenamentoVazio();
  const repo = criarRepositorioLocal({ dados, persistir: false });
  // No Supabase a busca é na tabela inteira; aqui, no repositório em memória.
  const buscarPorHash = async (hash: string): Promise<TokenGuardado | null> => {
    const tokens = (await repo.listarTokensAgente()) as TokenGuardado[];
    const comHash = await Promise.all(tokens.map(async (t) => ({ ...t, userId: "usuario-a", hash: await hashDe(t.id) })));
    return comHash.find((t) => t.hash === hash) ?? null;
  };
  const hashes = new Map<string, string>();
  const hashDe = async (id: string) => hashes.get(id)!;
  return { repo, buscarPorHash, hashes };
}

describe("tokens do agente", () => {
  it("o token em texto puro aparece só na criação; no repositório fica o hash", async () => {
    const { repo, hashes } = cenario();
    const { token, registro } = await gerarToken(repo, { nome: " nanobot ", escopo: "escrita" }, CONFIG, new Date("2026-11-04T00:00:00Z"));
    hashes.set(registro.id, calcularHashDoToken(token, CONFIG.segredo));
    expect(token).toMatch(/^tempestivo_[A-Za-z0-9_-]{43}$/);
    expect(registro).toMatchObject({ nome: "nanobot", escopo: "escrita", expiraEm: "2027-02-02T00:00:00.000Z", revogadoEm: null });
    expect(JSON.stringify(await repo.listarTokensAgente())).not.toContain(token);
  });

  it("gerado funciona; revogado deixa de funcionar", async () => {
    const { repo, buscarPorHash, hashes } = cenario();
    const { token, registro } = await gerarToken(repo, { nome: "vps", escopo: "leitura" }, CONFIG);
    hashes.set(registro.id, calcularHashDoToken(token, CONFIG.segredo));

    const antes = await validarToken(token, { segredo: CONFIG.segredo, buscarPorHash });
    expect(antes.ok && antes.token.escopo).toBe("leitura");

    await revogarToken(repo, registro.id);
    expect(await validarToken(token, { segredo: CONFIG.segredo, buscarPorHash })).toEqual({ ok: false, motivo: "revogado" });
  });

  it("recusa expirado, desconhecido, malformado e segredo diferente", async () => {
    const { repo, buscarPorHash, hashes } = cenario();
    const { token, registro } = await gerarToken(repo, { nome: "vps", escopo: "escrita" }, { ...CONFIG, validadeDias: 1 }, new Date("2026-11-04T00:00:00Z"));
    hashes.set(registro.id, calcularHashDoToken(token, CONFIG.segredo));

    expect(await validarToken(token, { segredo: CONFIG.segredo, buscarPorHash, agora: new Date("2026-11-06T00:00:00Z") })).toEqual({ ok: false, motivo: "expirado" });
    expect(await validarToken(`myplan_${"x".repeat(43)}`, { segredo: CONFIG.segredo, buscarPorHash })).toEqual({ ok: false, motivo: "desconhecido" });
    expect(await validarToken("Bearer abc", { segredo: CONFIG.segredo, buscarPorHash })).toEqual({ ok: false, motivo: "formato" });
    expect(await validarToken(token, { segredo: "o".repeat(48), buscarPorHash, agora: new Date("2026-11-04T01:00:00Z") })).toEqual({ ok: false, motivo: "desconhecido" });
  });

  it("token antigo com prefixo myplan_ continua valendo; o novo usa tempestivo_", async () => {
    const { repo, buscarPorHash, hashes } = cenario();
    const antigo = `myplan_${"A".repeat(43)}`;
    const registro = await repo.criarTokenAgente({ nome: "token de antes da marca", escopo: "escrita", hash: calcularHashDoToken(antigo, CONFIG.segredo), expiraEm: "2027-12-31T00:00:00.000Z" });
    hashes.set(registro.id, calcularHashDoToken(antigo, CONFIG.segredo));
    const r = await validarToken(antigo, { segredo: CONFIG.segredo, buscarPorHash, agora: new Date("2026-11-10T00:00:00Z") });
    expect(r.ok && r.token.nome).toBe("token de antes da marca");

    const { token: novo, registro: reg2 } = await gerarToken(repo, { nome: "novo", escopo: "leitura" }, CONFIG);
    hashes.set(reg2.id, calcularHashDoToken(novo, CONFIG.segredo));
    expect(novo.startsWith("tempestivo_")).toBe(true);
    expect((await validarToken(novo, { segredo: CONFIG.segredo, buscarPorHash })).ok).toBe(true);
    // Prefixo desconhecido ou curto demais continua recusado.
    expect(await validarToken(`outro_${"A".repeat(43)}`, { segredo: CONFIG.segredo, buscarPorHash })).toEqual({ ok: false, motivo: "formato" });
    expect(await validarToken("tempestivo_curto", { segredo: CONFIG.segredo, buscarPorHash })).toEqual({ ok: false, motivo: "formato" });
  });

  it("exige nome", async () => {
    const { repo } = cenario();
    await expect(gerarToken(repo, { nome: "  ", escopo: "escrita" }, CONFIG)).rejects.toThrow(/nome/);
  });
});

describe("serviço de lembretes", () => {
  const agora = new Date("2026-11-04T12:00:00.000Z");

  it("próximos: pendentes até N horas, incluindo atrasados", async () => {
    const repo = criarRepositorioLocal({ dados: armazenamentoVazio() });
    await criarLembrete(repo, { texto: "atrasado", quando: "2026-11-04T11:00:00.000Z" });
    await criarLembrete(repo, { texto: "daqui 30 min", quando: "2026-11-04T12:30:00.000Z" });
    await criarLembrete(repo, { texto: "daqui 3 h", quando: "2026-11-04T15:00:00.000Z" });
    const agendado = await criarLembrete(repo, { texto: "já agendado", quando: "2026-11-04T12:10:00.000Z" });
    await marcarLembrete(repo, agendado.id, "agendado", { agora });

    expect((await lembretesProximos(repo, 1, agora)).map((l) => l.texto)).toEqual(["atrasado", "daqui 30 min"]);
    expect((await lembretesProximos(repo, 4, agora)).map((l) => l.texto)).toEqual(["atrasado", "daqui 30 min", "daqui 3 h"]);
  });

  it("marcar enviado recusa lembrete remarcado ou cancelado", async () => {
    const repo = criarRepositorioLocal({ dados: armazenamentoVazio() });
    const l = await criarLembrete(repo, { texto: "Ligar", quando: "2026-11-04T15:00:00.000Z" });
    await marcarLembrete(repo, l.id, "agendado", { quandoEsperado: l.quando });
    const remarcado = await remarcarLembrete(repo, l.id, "2026-11-04T16:00:00.000Z");
    expect(remarcado).toMatchObject({ status: "pendente", agendadoEm: null });
    await expect(marcarLembrete(repo, l.id, "enviado", { quandoEsperado: l.quando })).rejects.toThrow(/remarcado/);

    await cancelarLembrete(repo, l.id);
    await expect(marcarLembrete(repo, l.id, "enviado")).rejects.toThrow(/cancelado/);
  });

  it("valida o texto ao criar", async () => {
    const repo = criarRepositorioLocal({ dados: armazenamentoVazio() });
    await expect(criarLembrete(repo, { texto: "", quando: agora.toISOString() })).rejects.toThrow(/texto/);
  });
});
