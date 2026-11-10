// Captura do DJEN de uma instância do agente, rodada pelo timer do systemd na VPS
// (agente/systemd/tempestivo-djen@.service), dentro da trava única (flock).
//
//   node scripts/captura-djen.ts
//
// Precisa do Node 22.18 ou mais novo, que roda TypeScript direto, sem npm install.
// Lê do .env da instância: TEMPESTIVO_MCP_TOKEN e TEMPESTIVO_MCP_URL (ou TEMPESTIVO_URL).
// O log tem só contagens e códigos HTTP: nada de teor, nome ou número de processo.

import { readFileSync } from "node:fs";
import { setTimeout as esperar } from "node:timers/promises";
import { criarClienteDjen } from "../src/data/djen/cliente-djen.ts";
import { criarClienteTempestivo, ErroDoTempestivo } from "../src/data/djen/cliente-tempestivo.ts";
import { executarConsultaDoDia } from "../src/services/consulta-djen.ts";

/** Endereço do app: TEMPESTIVO_URL, ou o TEMPESTIVO_MCP_URL sem o /api/mcp. */
export function enderecoDoApp(ambiente: Record<string, string | undefined>): string | null {
  const direto = ambiente.TEMPESTIVO_URL?.trim();
  if (direto) return direto.replace(/\/+$/, "");
  const mcp = ambiente.TEMPESTIVO_MCP_URL?.trim();
  if (!mcp) return null;
  return mcp.replace(/\/+$/, "").replace(/\/api\/mcp$/, "");
}

function versao(): string {
  try {
    return (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version?: string }).version ?? "0";
  } catch {
    return "0";
  }
}

async function principal(): Promise<number> {
  const url = enderecoDoApp(process.env);
  const token = process.env.TEMPESTIVO_MCP_TOKEN?.trim();
  if (!url || !token) {
    console.error("Defina TEMPESTIVO_MCP_TOKEN e TEMPESTIVO_MCP_URL (ou TEMPESTIVO_URL) no .env da instância.");
    return 2;
  }
  const userAgent = `Tempestivo/${versao()} (+${url})`;
  const registrar = (m: string) => console.log(`[captura-djen] ${m}`);
  try {
    await executarConsultaDoDia({
      djen: criarClienteDjen({ userAgent }),
      app: criarClienteTempestivo({ url, token, userAgent }),
      esperar: (ms) => esperar(ms),
      agora: () => Date.now(),
      registrar,
    });
    // "falhou" e "limite" ficam registrados no app, que libera nova tentativa às 12h e às 17h.
    // Não são erro do script: o código de saída só acusa quando o Tempestivo não respondeu.
    return 0;
  } catch (e) {
    registrar(e instanceof ErroDoTempestivo ? `o Tempestivo respondeu ${e.status}: ${e.message}` : `erro: ${e instanceof Error ? e.name : "desconhecido"}`);
    return 1;
  }
}

// Só roda quando chamado direto (os testes importam enderecoDoApp sem disparar a consulta).
if (/captura-djen\.ts$/.test(process.argv[1] ?? "")) {
  process.exitCode = await principal();
}
