import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CORES_DESTAQUE } from "./aparencia";

// A marca Escriva exige pelo menos 4,5:1 em todo texto, nos dois temas (docs/marca/MANUAL_DA_MARCA.md).
// Este teste confere os valores do globals.css contra o tokens.json e mede as combinações de texto.

type Tema = "light" | "dark";
const raiz = process.cwd();
const tokens = JSON.parse(readFileSync(join(raiz, "docs/marca/tokens.json"), "utf8")) as {
  color: { tokens: { name: string; value: Record<Tema, string> }[] };
};
const css = readFileSync(join(raiz, "src/app/globals.css"), "utf8");

const T = Object.fromEntries(tokens.color.tokens.map((t) => [t.name, t.value])) as Record<string, Record<Tema, string>>;

/** Variáveis declaradas num bloco do CSS (":root {" ou ".dark {"). */
function bloco(seletor: string): Record<string, string> {
  const inicio = css.indexOf(`${seletor} {`);
  const fim = css.indexOf("\n}", inicio);
  const vars: Record<string, string> = {};
  for (const m of css.slice(inicio, fim).matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}

function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** color-mix(in srgb, a p%, b) */
function misturar(a: string, b: string, p: number): string {
  const canal = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  return `#${[1, 3, 5].map((i) => Math.round(canal(a, i) * p + canal(b, i) * (1 - p)).toString(16).padStart(2, "0")).join("")}`;
}

const TEMAS: Tema[] = ["light", "dark"];

describe("tokens da marca no globals.css", () => {
  it.each(TEMAS)("as cores do tema %s são as do tokens.json", (tema) => {
    const vars = { ...bloco(":root"), ...(tema === "dark" ? bloco(".dark") : {}) };
    for (const [nome, valor] of Object.entries(T)) expect({ nome, valor: vars[nome]?.toUpperCase() }).toEqual({ nome, valor: valor[tema].toUpperCase() });
  });
});

describe("contraste de texto (mínimo 4,5:1)", () => {
  // Combinações de texto descritas no tokens.json e no manual.
  const PARES: [texto: string, fundos: string[]][] = [
    ["ink", ["surface", "surface-raised", "balao-advogado"]],
    ["ink-muted", ["surface", "surface-raised"]],
    ["petroleo", ["surface", "surface-raised"]],
    ["on-petroleo", ["petroleo"]],
    ["on-marca-texto", ["marca-texto"]],
    ["fatal", ["surface", "surface-raised", "fatal-soft"]],
    ["interno", ["surface", "surface-raised", "interno-soft"]],
    ["no-prazo", ["surface", "surface-raised", "no-prazo-soft"]],
  ];

  for (const tema of TEMAS) {
    for (const [texto, fundos] of PARES) {
      for (const fundo of fundos) {
        it(`${tema}: ${texto} sobre ${fundo}`, () => {
          expect(contraste(T[texto][tema], T[fundo][tema])).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
    it(`${tema}: ink e ink-muted sobre o fundo de hover (ink 5% sobre surface-raised)`, () => {
      const hover = misturar(T.ink[tema], T["surface-raised"][tema], 0.05);
      expect(contraste(T.ink[tema], hover)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(T["ink-muted"][tema], hover)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("opções de cor de destaque", () => {
  it("petróleo é a primeira opção e usa os valores do tokens.json", () => {
    const [p] = CORES_DESTAQUE;
    expect(p.id).toBe("petroleo");
    expect(p.claro).toEqual({ cor: T.petroleo.light, texto: T["on-petroleo"].light });
    expect(p.escuro).toEqual({ cor: T.petroleo.dark, texto: T["on-petroleo"].dark });
  });

  for (const c of CORES_DESTAQUE) {
    for (const tema of TEMAS) {
      it(`${c.nome} (${tema}): texto sobre a cor, a cor como texto e sobre o fundo suave`, () => {
        const { cor, texto } = tema === "light" ? c.claro : c.escuro;
        const raised = T["surface-raised"][tema];
        expect(contraste(texto, cor)).toBeGreaterThanOrEqual(4.5);
        expect(contraste(cor, T.surface[tema])).toBeGreaterThanOrEqual(4.5);
        expect(contraste(cor, raised)).toBeGreaterThanOrEqual(4.5);
        // Item ativo do menu: texto na cor sobre --primary-soft (10% da cor sobre surface-raised).
        expect(contraste(cor, misturar(cor, raised, 0.1))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("não há vermelho, âmbar ou azul de estado entre as opções", () => {
    const estados = ["fatal", "interno", "no-prazo"].flatMap((n) => [T[n].light, T[n].dark]).map((h) => h.toUpperCase());
    for (const c of CORES_DESTAQUE) expect(estados).not.toContain(c.claro.cor.toUpperCase());
  });
});
