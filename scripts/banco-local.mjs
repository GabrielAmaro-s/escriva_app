// npm run test:banco-local: roda supabase/testes contra o Supabase local.
// Lê a URL e as chaves de `supabase status` (nunca do .env.local) e só segue se a URL for local,
// porque o teste cria usuários e grava e apaga dados.
//
// Antes: npx supabase start (e, para começar limpo, npx supabase db reset).

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const cli = join(dirname(require.resolve("supabase/package.json")), "dist", "supabase.js");
const vitest = join(dirname(require.resolve("vitest/package.json")), "vitest.mjs");

const status = spawnSync(process.execPath, [cli, "status", "-o", "env"], { cwd: raiz, encoding: "utf8" });
const variaveis = Object.fromEntries(
  (status.stdout ?? "")
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

if (status.status !== 0 || !variaveis.API_URL) {
  console.error("O Supabase local não está rodando. Rode antes: npx supabase start");
  process.exit(1);
}

const host = new URL(variaveis.API_URL).hostname;
if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
  console.error(`Recusado: ${variaveis.API_URL} não é o Supabase local.`);
  process.exit(1);
}

const r = spawnSync(process.execPath, [vitest, "run", "--config", "vitest.banco-local.config.mts", ...process.argv.slice(2)], {
  cwd: raiz,
  stdio: "inherit",
  env: { ...process.env, SB_URL: variaveis.API_URL, SB_ANON: variaveis.ANON_KEY, SB_SERVICE: variaveis.SERVICE_ROLE_KEY },
});
process.exit(r.status ?? 1);
