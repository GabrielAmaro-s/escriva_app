// Atalhos do Supabase CLI.
// Uso: node scripts/supabase.mjs <vincular|migrar|reparar|tipos> [--producao] [outras opções do CLI]
//
// Sem --producao, tudo roda no Supabase LOCAL (npx supabase start) e nenhuma credencial remota é lida.
// Com --producao, o script lê só o .env.producao (fora do git), mostra o alvo e repassa as outras
// opções ao CLI (ex.: --dry-run, --yes). Assim o dia a dia nunca chega à produção por engano.
//
// O npm roda scripts no cmd do Windows, que não expande $VARIAVEL. Este script carrega o arquivo,
// confere o que falta e chama o CLI sem passar por shell, então funciona igual no Windows, no macOS
// e no Linux.

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
    console.error(`Preencha no .env.producao antes de continuar: ${faltando.join(", ")}`);
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

const argumentos = process.argv.slice(2);
const comando = argumentos[0];
const producao = argumentos.includes("--producao");
const extras = argumentos.slice(1).filter((a) => a !== "--producao");

if (producao) {
  if (!existsSync(join(raiz, ".env.producao"))) {
    console.error("Falta o .env.producao (credenciais de produção, fora do git). Veja o README.");
    process.exit(1);
  }
  carregarEnv(".env.producao");
}

/** Mostra para onde o comando vai antes de rodar. */
function avisarAlvo() {
  if (!producao) {
    console.log("Alvo: Supabase LOCAL (npx supabase start). Para produção, acrescente: -- --producao");
    return;
  }
  exigir("DIRECT_URL");
  const host = new URL(process.env.DIRECT_URL).host;
  console.log(`Alvo: PRODUÇÃO (${host}), com as credenciais do .env.producao.`);
}

const destinoDosTipos = join(raiz, "src", "data", "supabase", "tipos-banco.ts");

if (comando === "vincular") {
  if (!producao) {
    console.error("vincular liga o CLI ao projeto de produção. Use: npm run db:vincular -- --producao");
    process.exit(1);
  }
  exigir("SUPABASE_PROJECT_REF");
  console.log("Vinculando ao projeto de produção. Se pedir, rode antes: npx supabase login");
  supabase(["link", "--project-ref", process.env.SUPABASE_PROJECT_REF, ...extras]);
} else if (comando === "migrar") {
  // Local: aplica as migrações que faltam no Supabase local. Produção: db push pela conexão de sessão.
  avisarAlvo();
  supabase(producao ? ["db", "push", `--remote=${process.env.DIRECT_URL}`, ...extras] : ["migration", "up", ...extras]);
} else if (comando === "reparar") {
  // Marca migrações como já aplicadas (ex.: rodadas à mão no SQL Editor).
  // Uso: npm run db:reparar -- 0001 0002            (local)
  //      npm run db:reparar -- --producao 0001 0002 (produção)
  const versoes = extras.filter((a) => !a.startsWith("--"));
  if (!versoes.length) {
    console.error("Diga quais versões marcar como aplicadas. Ex.: npm run db:reparar -- --producao 0001 0002");
    process.exit(1);
  }
  avisarAlvo();
  const opcoes = extras.filter((a) => a.startsWith("--"));
  supabase(["migration", "repair", "--status", "applied", ...(producao ? [`--remote=${process.env.DIRECT_URL}`] : []), ...opcoes, ...versoes]);
} else if (comando === "tipos") {
  avisarAlvo();
  const saida = supabase(["gen", "types", "typescript", "--schema", "public", ...(producao ? [`--remote=${process.env.DIRECT_URL}`] : [])], { capturar: true });
  writeFileSync(destinoDosTipos, `// Gerado por npm run db:tipos. Não edite à mão.\n${saida}`);
  console.log(`Tipos gravados em ${destinoDosTipos}`);
} else {
  console.error("Uso: node scripts/supabase.mjs <vincular|migrar|reparar|tipos> [--producao]");
  process.exit(1);
}
