// Cor de destaque escolhida em Configurações. Fica salva neste navegador.
// Cada opção tem um valor para o tema claro e outro para o escuro (como o petróleo do tokens.json),
// e o texto sobre ela. Todas passam de 4,5:1 nos dois temas (ver contraste.test.ts).

export interface CorDestaque {
  id: "petroleo" | "grafite" | "ameixa";
  nome: string;
  claro: { cor: string; texto: string };
  escuro: { cor: string; texto: string };
}

export const CORES_DESTAQUE: CorDestaque[] = [
  // Petróleo é a cor da marca (tokens.json: petroleo e on-petroleo).
  { id: "petroleo", nome: "Petróleo", claro: { cor: "#0E4A4F", texto: "#FFFFFF" }, escuro: { cor: "#5FB3B3", texto: "#0E1514" } },
  { id: "grafite", nome: "Grafite", claro: { cor: "#3B4A47", texto: "#FFFFFF" }, escuro: { cor: "#B7C3C0", texto: "#0E1514" } },
  { id: "ameixa", nome: "Ameixa", claro: { cor: "#5A3D7A", texto: "#FFFFFF" }, escuro: { cor: "#C3A6E8", texto: "#0E1514" } },
];

export const DESTAQUE_PADRAO = CORES_DESTAQUE[0].id;

const CHAVE = "tempestivo-destaque";
/** Antes da marca, a cor era um hexadecimal em "myplan-accent", de opções que não existem mais. */
const CHAVE_ANTIGA = "myplan-accent";

export function lerCorDestaque(): CorDestaque["id"] {
  try {
    const salvo = window.localStorage.getItem(CHAVE);
    return CORES_DESTAQUE.some((c) => c.id === salvo) ? (salvo as CorDestaque["id"]) : DESTAQUE_PADRAO;
  } catch {
    return DESTAQUE_PADRAO;
  }
}

/** Variáveis que o globals.css lê para --primary e --on-primary em cada tema. */
const VARIAVEIS = ["--destaque-claro", "--on-destaque-claro", "--destaque-escuro", "--on-destaque-escuro"] as const;

function valoresDe(c: CorDestaque): string[] {
  return [c.claro.cor, c.claro.texto, c.escuro.cor, c.escuro.texto];
}

export function aplicarCorDestaque(id: CorDestaque["id"]) {
  const cor = CORES_DESTAQUE.find((c) => c.id === id) ?? CORES_DESTAQUE[0];
  const raiz = document.documentElement.style;
  if (cor.id === DESTAQUE_PADRAO) VARIAVEIS.forEach((v) => raiz.removeProperty(v));
  else valoresDe(cor).forEach((valor, i) => raiz.setProperty(VARIAVEIS[i], valor));
  try {
    window.localStorage.setItem(CHAVE, cor.id);
    window.localStorage.removeItem(CHAVE_ANTIGA);
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
}

/** Roda antes da página aparecer, para não piscar na cor padrão. */
export const scriptInicialCorDestaque = `try{var o=${JSON.stringify(
  Object.fromEntries(CORES_DESTAQUE.filter((c) => c.id !== DESTAQUE_PADRAO).map((c) => [c.id, valoresDe(c)])),
)},v=${JSON.stringify(VARIAVEIS)},a=o[localStorage.getItem("${CHAVE}")];localStorage.removeItem("${CHAVE_ANTIGA}");if(a)for(var i=0;i<4;i++)document.documentElement.style.setProperty(v[i],a[i])}catch(e){}`;
