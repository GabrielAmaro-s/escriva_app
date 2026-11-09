import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Teste de integração com o Supabase local (npm run test:banco-local).
// Fica fora do npm test padrão: precisa de `npx supabase start` rodando.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/testes/vazio.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["supabase/testes/**/*.test.ts"],
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
