// Cor de destaque escolhida em Configurações. Fica salva neste navegador.

export const CORES_DESTAQUE = [
  { valor: "#6C47E8", nome: "Violeta" },
  { valor: "#2F6FEB", nome: "Azul" },
  { valor: "#0E9F8E", nome: "Verde-água" },
  { valor: "#D6479A", nome: "Rosa" },
] as const;

const CHAVE = "myplan-accent";

export function lerCorDestaque(): string {
  try {
    return window.localStorage.getItem(CHAVE) ?? CORES_DESTAQUE[0].valor;
  } catch {
    return CORES_DESTAQUE[0].valor;
  }
}

export function aplicarCorDestaque(cor: string) {
  document.documentElement.style.setProperty("--primary", cor);
  try {
    window.localStorage.setItem(CHAVE, cor);
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
}

/** Roda antes da página aparecer, para não piscar na cor padrão. */
export const scriptInicialCorDestaque = `try{var a=localStorage.getItem("${CHAVE}");if(a)document.documentElement.style.setProperty("--primary",a)}catch(e){}`;
