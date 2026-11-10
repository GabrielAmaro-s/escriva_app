import { execFile } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { enderecoDoApp } from "../../scripts/captura-djen";

// O script da VPS roda pelo Node direto, sem bundler e sem npm install (Node 22.18 ou mais novo).
// Aqui ele roda de verdade, contra um app falso em 127.0.0.1: nenhuma chamada sai para o DJEN.

const SCRIPT = fileURLToPath(new URL("../../scripts/captura-djen.ts", import.meta.url));
const [maior, menor] = process.versions.node.split(".").map(Number);
const nodeRodaTypeScript = maior > 22 || (maior === 22 && menor >= 18);

function rodar(env: Record<string, string>): Promise<{ codigo: number; saida: string }> {
  return new Promise((resolver) => {
    execFile(
      process.execPath,
      ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", SCRIPT],
      { env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "", ...env }, timeout: 20_000, encoding: "utf8" },
      (erro, stdout, stderr) => resolver({ codigo: erro ? Number((erro as { code?: number }).code ?? 1) : 0, saida: stdout + stderr }),
    );
  });
}

describe("script da captura na VPS", () => {
  it("acha o endereço do app pelo TEMPESTIVO_URL ou pelo TEMPESTIVO_MCP_URL", () => {
    expect(enderecoDoApp({ TEMPESTIVO_URL: "https://app.exemplo.invalid/" })).toBe("https://app.exemplo.invalid");
    expect(enderecoDoApp({ TEMPESTIVO_MCP_URL: "https://app.exemplo.invalid/api/mcp" })).toBe("https://app.exemplo.invalid");
    expect(enderecoDoApp({})).toBeNull();
  });

  it.runIf(nodeRodaTypeScript)("sem token, para com uma mensagem clara", async () => {
    const r = await rodar({});
    expect(r.codigo).toBe(2);
    expect(r.saida).toMatch(/Defina TEMPESTIVO_MCP_TOKEN/);
  });

  it.runIf(nodeRodaTypeScript)("carrega sem bundler, fala com o app pelo token e não chama o DJEN quando o app diz que não é hora", async () => {
    const pedidos: { url?: string; autorizacao?: string; agente?: string }[] = [];
    const servidor = createServer((req, res) => {
      pedidos.push({ url: req.url, autorizacao: req.headers.authorization, agente: req.headers["user-agent"] });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ consultar: false, motivo: "desligada" }));
    });
    await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
    const { port } = servidor.address() as AddressInfo;
    try {
      const r = await rodar({ TEMPESTIVO_URL: `http://127.0.0.1:${port}`, TEMPESTIVO_MCP_TOKEN: "tempestivo_teste" });
      expect(r.codigo).toBe(0);
      expect(r.saida).toContain("sem consulta: desligada");
      expect(pedidos).toEqual([{ url: "/api/djen/consulta/iniciar", autorizacao: "Bearer tempestivo_teste", agente: expect.stringMatching(/^Tempestivo\/\d/) }]);
    } finally {
      servidor.close();
    }
  });
});
