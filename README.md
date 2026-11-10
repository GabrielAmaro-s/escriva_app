# Tempestivo

O assistente no WhatsApp que não deixa o advogado autônomo perder prazo. Ele recebe a intimação, calcula o vencimento mostrando como chegou na data, só grava depois do "sim", lembra antes do vencimento e manda toda manhã o que vence e as audiências do dia. O app serve para ver e organizar processos, casos consultivos, prazos e clientes.

- Proposta e etapas: `docs/PROPOSTA_JURIDICA.md`.
- Marca (manual, tokens, logotipo): `docs/marca/`.
- O Tempestivo nasceu do myPlan, um gerenciador de projetos; por isso o código ainda chama processo de "project" e caso consultivo de "campaign".

## Rodar

```bash
git clone git@github.com:GabrielAmaro-s/tempestivoapp.git
cd tempestivoapp
npm install
npm run dev
```

Abra http://localhost:3000. Sem configuração nenhuma o app roda em **modo local**: os dados ficam no navegador e já vêm alguns casos jurídicos fictícios de exemplo.

Telas: **Hoje** (`/hoje`), **Processos** (`/`), **Consultivo** (`/consultivo`), **Prazos e tarefas** (`/prazos`), **Clientes** (`/clientes`) e **Configurações**. Os endereços antigos `/visao-geral`, `/campanhas` e `/tarefas` redirecionam para os novos. Ao criar um processo, escolha o modelo de quadro (Cível/JEC, Trabalhista, Previdenciário ou Família), o cliente e, se quiser, o número CNJ e os outros dados do processo. Caso consultivo usa o modelo Consultivo e tem tipo de serviço, pedido do cliente e prazo de entrega.

Quem já usava o modo local continua com os dados que tinha: eles ficam na chave `tempestivo:v2` do localStorage, e dados antigos na chave `myplan:v2` passam para a nova na primeira leitura. Para ver o exemplo novo, apague a chave `tempestivo:v2`.

## Dois ambientes: local e produção

O dia a dia roda contra um **Supabase local**, e as credenciais de produção ficam num arquivo separado que só os scripts `db:*` leem, e só quando você pede:

| Arquivo | Quem lê | Para onde aponta |
|---|---|---|
| `.env.local` | `npm run dev`, `npm run build` e os scripts `db:*` sem flag | Supabase local (`npx supabase start`) |
| `.env.producao` | Só os scripts `db:*` com `-- --producao` | Projeto de produção no supabase.com |

Os dois estão no `.gitignore`. **Não crie um `.env`**: o Next lê o `.env` sozinho, e credenciais de produção nele fariam o `npm run dev` usar a produção.

### Desenvolver com o Supabase local

1. Com o Docker rodando: `npx supabase start` (a primeira vez baixa as imagens).
2. Copie `.env.example` para `.env.local` e preencha com o que `npx supabase status -o env` mostra:
   - `NEXT_PUBLIC_SUPABASE_URL` = `API_URL` (`http://127.0.0.1:54321`);
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = `PUBLISHABLE_KEY`;
   - `SUPABASE_SECRET_KEY` = `SECRET_KEY`;
   - `DATABASE_URL` e `DIRECT_URL` = `DB_URL`;
   - `MCP_SEGREDO_TOKENS`: um segredo só deste ambiente (`openssl rand -base64 48`), diferente do de produção;
   - `NEXT_PUBLIC_APP_URL=http://localhost:3000`.
3. Aplique as migrações: `npm run db:migrar` (ou `npx supabase db reset` para começar do zero).
4. `npm run dev`. O link mágico do login chega no Mailpit local, em http://127.0.0.1:54324 (não suba o Supabase com `-x mailpit` se quiser entrar no app).
5. Para voltar ao modo local sem banco, com os dados no navegador, tire as duas variáveis `NEXT_PUBLIC_SUPABASE_*` do `.env.local`.

### Produção

1. Crie o projeto em supabase.com.
2. Copie `.env.example` para `.env.producao` e preencha:
   - `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Project Settings > API Keys; a chave publicável começa com `sb_publishable_`, ou use a "anon" legada);
   - `SUPABASE_SECRET_KEY` (chave secreta `sb_secret_...` ou a "service_role" legada; só servidor);
   - `SUPABASE_PROJECT_REF`, `DATABASE_URL` e `DIRECT_URL` (Project Settings > Database > Connection string);
   - `MCP_SEGREDO_TOKENS` (gere com `openssl rand -base64 48`).
3. Vincule o projeto: `npx supabase login` (uma vez por máquina) e depois `npm run db:vincular -- --producao`.
4. Aplique as migrações: primeiro `npm run db:migrar -- --producao --dry-run`, para ver o que vai entrar, e depois `npm run db:migrar -- --producao`. O script mostra o alvo ("Alvo: PRODUÇÃO (...)") antes de rodar. Se o CLI pedir confirmação, acrescente `--yes`.
5. Em Authentication > URL Configuration, adicione `http://localhost:3000/auth/callback` (e a URL de produção) em Redirect URLs.
6. As variáveis do `.env.producao` vão para a Vercel (veja "Publicar na Vercel"). O app publicado lê as variáveis da Vercel, não esse arquivo.

Se você já tinha rodado `0001` e `0002` à mão no SQL Editor, marque-as como aplicadas antes do passo 4:
`npm run db:reparar -- --producao 0001 0002`.

**Scripts do banco.** Sem `--producao`, `db:migrar`, `db:reparar` e `db:tipos` rodam no Supabase local e não leem nenhuma credencial remota. `db:vincular` só existe com `--producao`.

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm run db:tipos` | Gera `src/data/supabase/tipos-banco.ts` a partir do Supabase local (`-- --producao` para gerar da produção) |
| `npm test` | Roda os testes (vitest) |
| `npm run typecheck` | Confere os tipos |
| `npm run verificar` | Typecheck, testes e build em sequência; para no primeiro erro |
| `npm run test:banco-local` | Testes de integração contra o Supabase local (opcional; veja abaixo) |

### Testar as migrações no Supabase local

`npm run test:banco-local` roda `supabase/testes/` contra um Supabase local, com dois usuários de verdade. Ele confere RLS, as chaves compostas com a chave de serviço, a exclusão de cliente e a lista e a criação de processos com o código do app. Desde a etapa 3, também os feriados (RLS com dois usuários), o histórico de prazos gravado só pelo gatilho, os lembretes automáticos e as preferências, com o código do app e do agente. Não faz parte do `npm test` nem do `npm run verificar`.

1. Com o Docker rodando: `npx supabase start` (só é preciso o banco, a autenticação e a API; para subir menos coisas, use `-x studio,imgproxy,storage-api,realtime,edge-runtime,logflare,vector,supavisor,mailpit,postgres-meta`).
2. Para começar limpo e aplicar as migrações do zero: `npx supabase db reset` (local por padrão; nunca passe `--remote`).
3. `npm run test:banco-local`.
4. No fim: `npx supabase stop`.

O script lê a URL e as chaves de `npx supabase status`, nunca do `.env.local`, e recusa rodar se a URL não for local, porque o teste cria usuários e grava dados. Cada rodada cria usuários novos, então dá para repetir sem reset.

Os dados do modo local não vão para o Supabase sozinhos: em Configurações, use **Importar dados deste navegador**.

## Publicar na Vercel

1. **Migre o banco antes do primeiro deploy.** Com o `.env.producao` preenchido: `npm run db:vincular -- --producao` e depois `npm run db:migrar -- --producao` (veja "Produção").
   A partir da etapa 2 da versão jurídica, o código depende da migração `0004_processos_e_clientes.sql` (clientes e detalhes do processo). Publicar esse código num banco sem a 0004 quebra a lista de processos; aplique a migração antes.
   A partir da etapa 3, depende também da `0005_prazos_e_feriados.sql` (tipo da tarefa, prazo fatal, feriados, histórico, lembretes automáticos e preferências). Sem ela, gravar tarefas e abrir as Configurações falha.
2. **Importe o repositório** `GabrielAmaro-s/tempestivoapp` em vercel.com > Add New > Project. O framework (Next.js) é detectado sozinho. O projeto de produção na Vercel se chama `tempestivo`.
3. **Região das funções:** em Settings > Functions > Function Region, escolha **São Paulo (gru1)**, que fica na mesma região AWS do Supabase (`sa-east-1`). Assim as rotas /api e o servidor MCP ficam perto do banco.
4. **Cadastre as variáveis** em Settings > Environment Variables (ambiente Production). As `NEXT_PUBLIC_*` são embutidas no build: cadastre antes do primeiro deploy e faça um novo deploy sempre que mudar alguma.

   Públicas (vão para o navegador):

   | Variável | Valor |
   |---|---|
   | `NEXT_PUBLIC_APP_URL` | o domínio final, ex.: `https://tempestivo.seudominio.com` (sem barra no fim). Hoje é `https://myplan-ashy.vercel.app`, até a troca de domínio (pendência em `docs/PROPOSTA_JURIDICA.md`). É o endereço dos links que o agente manda |
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
   | `TEMPESTIVO_FUSO_HORARIO` | `America/Sao_Paulo`. O nome antigo, `MYPLAN_FUSO_HORARIO`, continua aceito; a Vercel de produção ainda usa ele |
   | `MCP_VALIDADE_TOKEN_DIAS` | `90` |
   | `MCP_LIMITE_ITENS_POR_PEDIDO` | `10` |
   | `AGENTE_ALERTA_SEM_HEARTBEAT_MIN` | `60` |

   Sem `NEXT_PUBLIC_APP_URL`, `SUPABASE_SECRET_KEY` ou `MCP_SEGREDO_TOKENS`, o servidor para na inicialização com uma mensagem dizendo o que falta.
5. **No Supabase**, em Authentication > URL Configuration:
   - **Site URL:** o domínio final (ex.: `https://tempestivo.seudominio.com`);
   - **Redirect URLs:** `https://<domínio>/auth/callback` (mantenha também `http://localhost:3000/auth/callback` para desenvolver).
6. **Faça o deploy** e, se usar domínio próprio, aponte-o em Settings > Domains.
7. **Confira depois do deploy:**
   - `https://<domínio>/api/saude` responde `{"ok":true,"modoLocal":false,"banco":"ok"}`. A rota mostra só esses três campos, sem chaves nem erros do banco; o detalhe de uma falha fica no log da função na Vercel;
   - o login por link mágico funciona: peça o link em `/login`, abra o e-mail no mesmo navegador e confirme que caiu em Processos;
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
scripts/          atalhos do Supabase CLI (local por padrão; produção só com --producao, lendo o .env.producao)
agente/           agente no WhatsApp (nanobot): configuração, SOUL.md e o guia do piloto (uma instância por advogado)
docs/             arquitetura, modelo de dados e etapas
```

Detalhes em `docs/ARQUITETURA.md`.

## Atalhos no quadro

- Enter em um cartão abre a tarefa.
- Espaço pega o cartão; setas movem; Espaço solta; Esc cancela.
- No celular, pressione e segure para arrastar.
