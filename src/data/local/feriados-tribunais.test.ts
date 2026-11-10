import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FERIADOS_DOS_TRIBUNAIS } from "./feriados-tribunais";

describe("carga de feriados dos tribunais", () => {
  it("o modo local tem exatamente a carga da migração 0005", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/0005_prazos_e_feriados.sql"), "utf8");
    const linhas = [...sql.matchAll(/\(null, '([A-Z0-9]+)', '([\d-]+)', (null|'[\d-]+'),\s*'(\w+)', '([^']+)',\s*'([^']+)'\)/g)].map((m) => ({
      tribunal: m[1],
      data: m[2],
      ate: m[3] === "null" ? null : m[3].slice(1, -1),
      tipo: m[4],
      descricao: m[5],
      fonte: m[6],
    }));
    expect(linhas.length).toBeGreaterThan(20);
    expect(FERIADOS_DOS_TRIBUNAIS.map(({ tribunal, data, ate, tipo, descricao, fonte }) => ({ tribunal, data, ate, tipo, descricao, fonte }))).toEqual(linhas);
  });

  it("a Data Magna fica fora do TRF4, que cobre RS, SC e PR", () => {
    expect(FERIADOS_DOS_TRIBUNAIS.filter((f) => f.tribunal === "TRF4" && f.data.endsWith("-09-20"))).toEqual([]);
  });
});
