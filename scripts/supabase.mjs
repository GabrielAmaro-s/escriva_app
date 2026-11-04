// Atalhos do Supabase CLI que leem o .env.local.
// Uso: node scripts/supabase.mjs <vincular|migrar|reparar|tipos>
//
// O npm roda scripts no cmd do Windows, que não expande $VARIAVEL. Este script
// carrega o .env.local, confere o que falta e chama o CLI sem passar por shell,
// então funciona igual no Windows, no macOS e no Linux.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

function carregarEnv(arquivo) {
  const caminho = join(raiz, arquivo);
  if (!existsSync(caminho)) return;
  for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let valor = m[2];
    if (/^(['"]).*\1$/.test(valor)) valor = valor.slice(1, -1);
    process.env[m[1]] = valor;
  }
}

function exigir(...nomes) {
  const faltando = nomes.filter((n) => !process.env[n] || process.env[n].includes("SEU-PROJETO"));
  if (faltando.length) {
    console.error(`Preencha no .env.local antes de continuar: ${faltando.join(", ")}`);
    process.exit(1);
  }
}

const require = createRequire(import.meta.url);
const cli = join(dirname(require.resolve("supabase/package.json")), "dist", "supabase.js");

function supabase(args, opcoes = {}) {
  const r = spawnSync(process.execPath, [cli, ...args], { cwd: raiz, stdio: opcoes.capturar ? ["inherit", "pipe", "inherit"] : "inherit", encoding: "utf8" });
  if (r.status !== 0) process.exit(r.status ?? 1);
  return r.stdout;
}

carregarEnv(".env.local");
const comando = process.argv[2];

if (comando === "vincular") {
  exigir("SUPABASE_PROJECT_REF");
  console.log("Vinculando ao projeto. Se pedir, rode antes: npx supabase login");
  supabase(["link", "--project-ref", process.env.SUPABASE_PROJECT_REF]);
} else if (comando === "migrar") {
  // Aplica supabase/migrations no banco remoto pela conexão de sessão (DIRECT_URL).
  exigir("DIRECT_URL");
  supabase(["db", "push", `--remote=${process.env.DIRECT_URL}`]);
} else if (comando === "reparar") {
  // Marca migrações como já aplicadas (ex.: rodadas à mão no SQL Editor).
  // Uso: npm run db:reparar -- 0001 0002
  exigir("DIRECT_URL");
  const versoes = process.argv.slice(3);
  if (!versoes.length) {
    console.error("Diga quais versões marcar como aplicadas. Ex.: npm run db:reparar -- 0001 0002");
    process.exit(1);
  }
  supabase(["migration", "repair", "--status", "applied", `--remote=${process.env.DIRECT_URL}`, ...versoes]);
} else if (comando === "tipos") {
  // Usa o projeto vinculado (npm run db:vincular).
  const saida = supabase(["gen", "types", "typescript", "--remote", "--schema", "public"], { capturar: true });
  const destino = join(raiz, "src", "data", "supabase", "tipos-banco.ts");
  writeFileSync(destino, `// Gerado por npm run db:tipos. Não edite à mão.\n${saida}`);
  console.log(`Tipos gravados em ${destino}`);
} else {
  console.error("Uso: node scripts/supabase.mjs <vincular|migrar|reparar|tipos>");
  process.exit(1);
}
