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

## Publicar na Vercel

1. **Migre o banco antes do primeiro deploy.** Com o `.env.local` apontando para o projeto de produção: `npm run db:vincular` e depois `npm run db:migrar`.
2. **Importe o repositório** em vercel.com > Add New > Project. O framework (Next.js) é detectado sozinho.
3. **Região das funções:** em Settings > Functions > Function Region, escolha **São Paulo (gru1)**, que fica na mesma região AWS do Supabase (`sa-east-1`). Assim as rotas /api e o servidor MCP ficam perto do banco.
4. **Cadastre as variáveis** em Settings > Environment Variables (ambiente Production). As `NEXT_PUBLIC_*` são embutidas no build: cadastre antes do primeiro deploy e faça um novo deploy sempre que mudar alguma.

   Públicas (vão para o navegador):

   | Variável | Valor |
   |---|---|
   | `NEXT_PUBLIC_APP_URL` | o domínio final, ex.: `https://myplan.seudominio.com` (sem barra no fim). É o endereço dos links que o agente manda |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://SEU-PROJETO.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave publicável (`sb_publishable_...`) |

   Só de servidor (nunca com o prefixo `NEXT_PUBLIC_`):

   | Variável | Valor |
   |---|---|
   | `SUPABASE_SECRET_KEY` | chave secreta (`sb_secret_...`), usada pelo servidor MCP |
   | `SUPABASE_PROJECT_REF` | id do projeto no Supabase |
   | `DATABASE_URL` | conexão do pooler, modo transação (porta 6543) |
   | `DIRECT_URL` | conexão de sessão (porta 5432) |
   | `MCP_SEGREDO_TOKENS` | segredo longo (`openssl rand -base64 48`). Se mudar, todos os tokens do agente deixam de valer |
   | `MYPLAN_FUSO_HORARIO` | `America/Sao_Paulo` |
   | `MCP_VALIDADE_TOKEN_DIAS` | `90` |
   | `MCP_LIMITE_ITENS_POR_PEDIDO` | `10` |
   | `AGENTE_ALERTA_SEM_HEARTBEAT_MIN` | `60` |

   Sem `NEXT_PUBLIC_APP_URL`, `SUPABASE_SECRET_KEY` ou `MCP_SEGREDO_TOKENS`, o servidor para na inicialização com uma mensagem dizendo o que falta.
5. **No Supabase**, em Authentication > URL Configuration:
   - **Site URL:** o domínio final (ex.: `https://myplan.seudominio.com`);
   - **Redirect URLs:** `https://<domínio>/auth/callback` (mantenha também `http://localhost:3000/auth/callback` para desenvolver).
6. **Faça o deploy** e, se usar domínio próprio, aponte-o em Settings > Domains.
7. **Confira depois do deploy:**
   - `https://<domínio>/api/saude` responde `{"ok":true,"modoLocal":false,"banco":"ok"}`. A rota mostra só esses três campos, sem chaves nem erros do banco; o detalhe de uma falha fica no log da função na Vercel;
   - o login por link mágico funciona: peça o link em `/login`, abra o e-mail no mesmo navegador e confirme que caiu em Meus projetos;
   - `https://<domínio>/api/mcp` sem token responde 401.

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
