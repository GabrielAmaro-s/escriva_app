// Cor de destaque escolhida em Configurações. Fica salva neste navegador.

export const ACCENTS = [
  { value: "#6C47E8", name: "Violeta" },
  { value: "#2F6FEB", name: "Azul" },
  { value: "#0E9F8E", name: "Verde-água" },
  { value: "#D6479A", name: "Rosa" },
] as const;

const KEY = "myplan-accent";

export function readAccent(): string {
  try {
    return window.localStorage.getItem(KEY) ?? ACCENTS[0].value;
  } catch {
    return ACCENTS[0].value;
  }
}

export function applyAccent(color: string) {
  document.documentElement.style.setProperty("--primary", color);
  try {
    window.localStorage.setItem(KEY, color);
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
}

/** Roda antes da página aparecer, para não piscar na cor padrão. */
export const accentBootScript = `try{var a=localStorage.getItem("${KEY}");if(a)document.documentElement.style.setProperty("--primary",a)}catch(e){}`;
