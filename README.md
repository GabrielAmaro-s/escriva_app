# myPlan

Gerenciador pessoal de projetos e campanhas, com um quadro Kanban por projeto.

## Rodar

```bash
npm install
npm run dev
```

Abra http://localhost:3000. Sem configuração nenhuma o app roda em **modo local**: os dados ficam no navegador e já vêm alguns projetos de exemplo.

## Conectar ao Supabase

1. Crie um projeto em supabase.com.
2. Copie `.env.example` para `.env.local` e preencha:
   - `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Project Settings > API Keys; a chave publicável começa com `sb_publishable_`, ou use a "anon" legada);
   - `SUPABASE_SECRET_KEY` (chave secreta `sb_secret_...` ou a "service_role" legada; só servidor);
   - `SUPABASE_PROJECT_REF`, `DATABASE_URL` e `DIRECT_URL` (Project Settings > Database > Connection string);
   - `MCP_SEGREDO_TOKENS` (gere com `openssl rand -base64 48`).
3. Vincule o projeto: `npx supabase login` (uma vez por máquina) e depois `npm run db:vincular`.
4. Aplique as migrações: `npm run db:migrar`.
5. Em Authentication > URL Configuration, adicione `http://localhost:3000/auth/callback` (e a URL de produção) em Redirect URLs.
6. Reinicie o `npm run dev`. O app passa a pedir login por link mágico no e-mail. Confira em http://localhost:3000/api/saude: deve responder `"banco": "ok"`.

Se você já tinha rodado `0001` e `0002` à mão no SQL Editor, marque-as como aplicadas antes do passo 4:
`npm run db:reparar -- 0001 0002`.

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm run db:tipos` | Gera `src/data/supabase/tipos-banco.ts` a partir do banco vinculado |
| `npm test` | Roda os testes (vitest) |
| `npm run typecheck` | Confere os tipos |

Os dados do modo local não vão para o Supabase sozinhos: em Configurações, use **Importar dados deste navegador**.

## Estrutura

```
src/
├── app/          rotas (páginas e /api)
├── components/   interface (layout, projects, board, tasks, settings, ui)
├── config/       variáveis de ambiente validadas (ambiente.ts e ambiente-servidor.ts)
├── hooks/        estado da tela com atualização otimista
├── services/     casos de uso (a interface, a API e o agente chamam estas funções)
├── domain/       tipos e regras de negócio puras
└── data/         repositório: Supabase, API ou local
supabase/         migrações SQL com RLS e config do CLI
scripts/          atalhos do Supabase CLI que leem o .env.local
agente/           configuração do agente pessoal (nanobot)
docs/             arquitetura, modelo de dados e etapas
```

Detalhes em `docs/ARQUITETURA.md`.

## Atalhos no quadro

- Enter em um cartão abre a tarefa.
- Espaço pega o cartão; setas movem; Espaço solta; Esc cancela.
- No celular, pressione e segure para arrastar.
