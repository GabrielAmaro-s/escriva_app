/** Chama uma rota /api do próprio app e devolve o JSON, ou lança o erro em português. */
export async function chamarApi<T>(caminho: string, opcoes: { metodo?: "GET" | "POST" | "PATCH" | "DELETE"; corpo?: unknown } = {}): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(caminho, {
      method: opcoes.metodo ?? "GET",
      headers: opcoes.corpo !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new Error("Sem conexão com o servidor. Verifique a internet e tente de novo.");
  }
  if (resposta.status === 401) {
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Sua sessão expirou. Entre de novo.");
  }
  if (resposta.status === 204) return undefined as T;
  const corpo = (await resposta.json().catch(() => null)) as { erro?: string } | null;
  if (!resposta.ok) throw new Error(corpo?.erro ?? `O servidor respondeu com erro (${resposta.status}).`);
  return corpo as T;
}
