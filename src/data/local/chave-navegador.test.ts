import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAVE, CHAVE_ANTIGA, armazenamentoVazio, criarRepositorioLocal, lerDadosDoNavegador } from "./repositorio-local";

// Dados salvos no navegador antes da marca Tempestivo (chave myplan:v2) continuam sendo lidos.

function armazenamentoFalso() {
  const itens = new Map<string, string>();
  return {
    itens,
    getItem: (k: string) => itens.get(k) ?? null,
    setItem: (k: string, v: string) => void itens.set(k, v),
    removeItem: (k: string) => void itens.delete(k),
  };
}

let ls: ReturnType<typeof armazenamentoFalso>;
beforeEach(() => {
  ls = armazenamentoFalso();
  vi.stubGlobal("window", { localStorage: ls });
});
afterEach(() => vi.unstubAllGlobals());

const dadosAntigos = () => {
  const d = armazenamentoVazio();
  d.projects.push({ id: "p1", name: "Processo de antes da marca", description: null, kind: "project", status: "active", color: "violet", icon: "scales", dueOn: null, position: 1024, archivedAt: null, createdAt: "", updatedAt: "" });
  return JSON.stringify(d);
};

describe("chave do modo local", () => {
  it("a chave nova é tempestivo:v2", () => {
    expect(CHAVE).toBe("tempestivo:v2");
    expect(CHAVE_ANTIGA).toBe("myplan:v2");
  });

  it("dados só na chave antiga são lidos e passam para a nova, sem perder nada", async () => {
    const bruto = dadosAntigos();
    ls.setItem(CHAVE_ANTIGA, bruto);
    const repo = criarRepositorioLocal();
    expect((await repo.listarProjetos()).map((p) => p.name)).toEqual(["Processo de antes da marca"]);
    expect(ls.getItem(CHAVE)).toBe(bruto);
    expect(ls.getItem(CHAVE_ANTIGA)).toBeNull();
  });

  it("se a cópia falhar, continua lendo da chave antiga, que fica intacta", () => {
    const bruto = dadosAntigos();
    ls.setItem(CHAVE_ANTIGA, bruto);
    ls.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    expect(lerDadosDoNavegador()?.projects[0].name).toBe("Processo de antes da marca");
    expect(ls.getItem(CHAVE_ANTIGA)).toBe(bruto);
  });

  it("com as duas chaves, vale a nova", () => {
    ls.setItem(CHAVE_ANTIGA, dadosAntigos());
    ls.setItem(CHAVE, JSON.stringify(armazenamentoVazio()));
    expect(lerDadosDoNavegador()?.projects).toEqual([]);
  });
});
