// Como a VPS fala com o Tempestivo durante a captura: o mesmo token do MCP da
// instância (Authorization: Bearer). Roda pelo Node direto, como cliente-djen.ts.

import type { ComunicacaoRecebida, JanelaConsulta, MotivoSemConsulta, ResultadoConsulta } from "../../domain/djen.ts";

export type PlanoRecebido =
  | { consultar: true; janela: JanelaConsulta; tentativa: number; numeroOab: string; ufOab: string }
  | { consultar: false; motivo: MotivoSemConsulta };

export interface ResumoDoEnvio {
  recebidas: number;
  novas: number;
  repetidas: number;
  canceladas: number;
  invalidas: number;
}

export interface ClienteTempestivo {
  iniciarConsulta(): Promise<PlanoRecebido>;
  enviarComunicacoes(itens: ComunicacaoRecebida[]): Promise<ResumoDoEnvio>;
  concluirConsulta(dados: { resultado: Exclude<ResultadoConsulta, "em_andamento">; janela: JanelaConsulta }): Promise<void>;
}

export class ErroDoTempestivo extends Error {
  readonly status: number;
  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.status = status;
  }
}

/** `url` é o endereço do app (ex.: https://tempestivo.vercel.app), sem /api/mcp. */
export function criarClienteTempestivo(opcoes: { url: string; token: string; userAgent: string; fetch?: typeof fetch }): ClienteTempestivo {
  const buscar = opcoes.fetch ?? fetch;
  const base = opcoes.url.replace(/\/+$/, "");

  async function chamar<T>(caminho: string, corpo: unknown): Promise<T> {
    const resposta = await buscar(`${base}${caminho}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${opcoes.token}`, "Content-Type": "application/json", Accept: "application/json", "User-Agent": opcoes.userAgent },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(60_000),
    });
    const texto = await resposta.text();
    if (!resposta.ok) {
      let erro = `HTTP ${resposta.status}`;
      try {
        erro = (JSON.parse(texto) as { erro?: string }).erro ?? erro;
      } catch {
        // corpo sem JSON: fica o código
      }
      throw new ErroDoTempestivo(resposta.status, erro);
    }
    return (texto ? JSON.parse(texto) : undefined) as T;
  }

  return {
    iniciarConsulta: () => chamar<PlanoRecebido>("/api/djen/consulta/iniciar", {}),
    enviarComunicacoes: (itens) => chamar<ResumoDoEnvio>("/api/djen/comunicacoes", { itens }),
    concluirConsulta: async (dados) => {
      await chamar<unknown>("/api/djen/consulta/concluir", dados);
    },
  };
}
