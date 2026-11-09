# Etapa 2: processo e clientes

Branch `juridico/etapa-2`. Referência: seção 10, item 2, de `docs/PROPOSTA_JURIDICA.md`.

## Resumo

O advogado passa a cadastrar clientes e a ligar cada processo ou caso consultivo a um deles. O processo ganha número CNJ, área, fase, tribunal, vara, polo, parte contrária, valor da causa, segredo de justiça e link dos autos. O consultivo ganha tipo de serviço, pedido do cliente e prazo de entrega. A migração 0004 foi testada no Supabase local e **aplicada em produção em 09/11/2026**, com a sua autorização (ver "Banco").

## O que mudou

**domain**
- `src/domain/tipos.ts`: `Cliente`, `DadosCliente`, `DetalhesProcesso`, área, fase e polo. `Projeto` ganhou `clienteId` e `processo`, e `DetalhesCampanha` ganhou `tipoServico`. Há também quatro ícones novos: `scales`, `briefcase`, `gavel` e `file`.
- `src/domain/cliente.ts` (novo):
  - validação de CPF e de CNPJ, inclusive o alfanumérico;
  - formatação e validação do cadastro;
  - busca por nome ou documento.
- `src/domain/processo.ts` (novo):
  - número CNJ, com dígito verificador módulo 97, e sua formatação;
  - áreas ("Família e sucessões" na tela), fases e polos;
  - sugestão entre área e modelo;
  - validação dos detalhes e valor em reais.
- `src/domain/erros.ts` (novo): `ErroDeConflito` (409) e `ErroDeValidacao` (400).
- `src/domain/quadro.ts`: `modelosDoTipo` e `modeloPermitido`. Consultivo só serve para caso consultivo, e os outros quatro modelos só para processo.
- `src/domain/projeto.ts`:
  - a validação cobre os detalhes do processo e o `tipoServico`, que, quando vazio, vem do primeiro canal;
  - a busca acha por cliente, número ou parte contrária, e há filtro por área;
  - padrões novos: ícone de balança, área Cível e sem cliente.

**services**
- `src/services/clientes.ts` (novo): listar, criar, atualizar e excluir.
- `src/services/projetos.ts`: recusa modelo que não combina com o tipo. Erros de validação passam a ser `ErroDeValidacao`.
- `src/services/importacao.ts`: exporta e importa clientes, detalhes do processo e tipo de serviço, como campos opcionais. Um cliente com o mesmo CPF/CNPJ já cadastrado é reaproveitado.

**data**
- `src/data/repositorio.ts`: `listarClientes`, `criarCliente`, `atualizarCliente` e `excluirCliente`.
- `src/data/supabase/repositorio-supabase.ts`:
  - a leitura de projetos traz `processo_detalhes` junto com `campaign_details`;
  - `salvarProcesso` grava os detalhes;
  - CRUD de clientes;
  - se o número já existir ao criar, o projeto recém-criado é apagado, para não ficar pela metade.
- `src/data/supabase/conversores.ts`: conversões de cliente, processo e `tipo_servico`.
- `src/data/supabase/erros.ts` (novo): 23505 vira `ErroDeConflito` com a mensagem certa, e 23503 em `projects_cliente_fk` vira "Cliente não encontrado.".
- `src/data/local/repositorio-local.ts`:
  - clientes e processos no localStorage, com as mesmas garantias do banco: únicos, cliente existente e exclusão que desvincula;
  - dados salvos antes desta etapa continuam sendo lidos.
- `src/data/local/exemplo.ts`: seis clientes fictícios, detalhes de processo, tipo de serviço e ícones jurídicos.
- `src/data/http/repositorio-http.ts`: clientes pela API.

**hooks**
- `src/hooks/use-clientes.tsx` (novo): estado dos clientes com exclusão por "Desfazer". Ao excluir de vez, recarrega os processos.

**interface**
- `/clientes` (`components/clients/tela-clientes.tsx` e `formulario-cliente.tsx`): busca por nome, CPF ou CNPJ, cadastro e edição, exclusão com "Desfazer", e a lista de casos de cada cliente.
- `components/projects/formulario-projeto.tsx`:
  - cliente escolhido pelo nome, ou cadastrado ao salvar quando o nome não existe;
  - modelos só do tipo certo, e área e modelo que se sugerem;
  - número CNJ formatado ao sair do campo;
  - bloco recolhível "Mais dados do processo";
  - no consultivo: Tipo de serviço, Pedido do cliente, Recebido em e Prazo de entrega. Canais saíram da tela.
- `projects/cartao-projeto.tsx`: cliente, número, área e cadeado de segredo de justiça.
- `campaigns/tela-consultivo.tsx`: cliente, tipo de serviço, pedido e prazo de entrega, com busca também pelo cliente.
- `board/aba-detalhes.tsx`: só os dados preenchidos e o link "Abrir os autos".
- `projects/tela-projetos.tsx`: busca nova e filtro "Todas as áreas".
- Menu e ícones: Clientes no menu, ícones jurídicos no menu (sol, balança, maleta, pessoas) e nos padrões de processo (balança) e consultivo (maleta).

**agente/MCP**
- `src/services/agente/ferramentas.ts`: a descrição de `criar_projeto` diz qual modelo serve para cada tipo. Nenhuma ferramenta nova.

**banco**
- `supabase/migrations/0004_processos_e_clientes.sql` (novo, não aplicado). Detalhes em "Banco".

**API**
- `src/app/api/clientes` e `src/app/api/clientes/[id]` (novos).
- `esquemas.ts` com os campos novos.
- `rotas.ts` responde 400 para `ErroDeValidacao` e 409 para `ErroDeConflito`.
- `PATCH /api/projetos/[id]` valida os detalhes do processo.

**docs**
- `docs/PROPOSTA_JURIDICA.md`: seção 5 dividida por etapa (0004 e 0005), escolhas novas e ideias futuras (trocar o modelo de um quadro existente e litisconsórcio).
- `docs/ARQUITETURA.md` e `README.md`: rotas, telas, modelo de dados, erros, testes e o aviso de que o código depende da 0004.

## Decisões tomadas

| Decisão | Motivo | Alternativas descartadas |
|---|---|---|
| Copiar o primeiro valor de `channels` para `tipo_servico` quando ele estiver vazio, sem apagar `channels`. Decisão sua. | Os casos antigos já aparecem com tipo de serviço, e nenhum dado se perde. | Deixar vazio; apagar `channels`. |
| "Prazo de entrega" usa `ends_on` e "Recebido em" usa `starts_on`. Decisão sua. | Aproveita as colunas que existem, sem tabela nova. | Coluna nova de prazo. |
| `cliente_id` em `projects`, com nulo permitido. Decisão sua. | Processo e consultivo usam o mesmo campo. | `cliente_id` em `processo_detalhes`. |
| Área como campo próprio, com o modelo continuando sem ser gravado. Decisão sua. | Área e quadro são coisas diferentes. | Derivar a área do modelo. |
| Consultivo só para casos consultivos; os outros quatro só para processos. Decisão sua. | Evita quadro de processo num consultivo e o contrário. | Qualquer modelo para qualquer tipo. |
| Fase com `administrativa`, área com `administrativo`, Família aparecendo como "Família e sucessões", e `fase` e `link_autos` incluídos. Decisões suas. | O previdenciário começa no INSS; a fase evita mover cartões a cada andamento. | Lista original. |
| `atualizado_em` em clientes, com a função `set_atualizado_em()`. Decisão sua. | `set_updated_at()` grava em `updated_at`. | Reaproveitar a função antiga. |
| CPF/CNPJ e número CNJ únicos por conta, e litisconsórcio como ideia futura. Decisão sua. | O agente vai localizar o processo pelo número. | Só avisar quando houver repetição. |
| `ultima_consulta_em` fica para a Etapa 5. Decisão sua. | Só faz sentido com o DataJud. | Criar agora. |
| Arquivo `0004_processos_e_clientes.sql`, separado da 0005 de prazos. Decisão sua. | Uma migração por etapa. | Uma `0004_juridico.sql` com tudo. |
| CNPJ alfanumérico aceito (`^[0-9A-Z]{12}[0-9]{2}$`). Decisão sua, durante a etapa. | A Receita emite esse formato desde julho de 2026. | Só dígitos, com uma migração nova depois. |
| Chaves estrangeiras compostas com `user_id`. | Uma chave estrangeira não passa pelo RLS; sem isso, daria para apontar para cliente de outra conta. | Chave simples, como em `campaign_details`. |
| `on delete set null (cliente_id)`. | Excluir o cliente não pode zerar o `user_id` do projeto. | `on delete set null` sem lista de colunas, que falharia no `not null`. |
| CPF/CNPJ e número guardados sem pontuação; formatação em `domain/`. | Busca e índices únicos simples. | Guardar formatado. |
| Mensagens de conflito traduzidas no repositório Supabase e mapeadas para 409 nas rotas. | Valem para a API e também para o agente. | Traduzir só dentro de cada rota. |
| O modo local reproduz as garantias do banco. | A tela se comporta igual sem Supabase, e os testes cobrem isso. | Garantias só no banco. |
| Cliente novo cadastrado pelo nome direto no formulário do processo. | Princípio "criar um processo em menos de um minuto". | Exigir cadastro prévio em `/clientes`. |
| Os dados raros do processo ficam num bloco recolhível. | O formulário fica curto. | Todos os campos à vista. |
| O exemplo não tem CPF/CNPJ nem número CNJ, e usa nomes como Fulano de Tal. | Um número válido inventado poderia coincidir com documento ou processo real. | Números fictícios com dígito válido. |
| Exportação na mesma versão 1, com os campos novos opcionais. | Arquivos exportados antes continuam sendo importados. | Versão 2 do arquivo. |
| O agente não ganhou ferramentas, só a descrição de `criar_projeto`. | `criar_processo` é da Etapa 4. | Antecipar ferramentas. |

## Mudanças de comportamento

- **Menu.** Ganha "Clientes" e ícones novos.
- **Novo processo.** Pede cliente, área e número. Os modelos oferecidos são só os de processo, e o Consultivo só aparece para caso consultivo.
- **Cartões e detalhes.** Os cartões de processo mostram cliente, número, área e segredo de justiça, e a aba Detalhes mostra os dados preenchidos.
- **Busca em Processos.** Acha também pelo cliente, pelo número (com ou sem pontuação) e pela parte contrária. Há filtro por área.
- **Consultivo.**
  - mostra cliente, tipo de serviço, pedido do cliente e prazo de entrega;
  - "Canais de divulgação" sumiu da tela;
  - os casos antigos aparecem com o primeiro canal como tipo de serviço.
- **Erros com mensagem clara.**
  - Para CPF/CNPJ ou número repetido: "Já existe um cliente com esse CPF/CNPJ." e "Já existe um processo com esse número.".
  - CPF, CNPJ, número CNJ, valor e link inválidos são recusados com mensagem própria.
- **Padrões de ícone e cor.**
  - Processo novo pela tela usa o ícone de balança, e consultivo novo usa a maleta.
  - Pelo agente continuam pasta e megafone, até a Etapa 4.
- **Agente.**
  - `criar_projeto` com tipo campanha e modelo de processo, ou o contrário, agora devolve erro em vez de criar.
  - Processos criados pelo agente não têm detalhes nem cliente.
- **Exportação e importação.** Levam clientes e detalhes. Na importação, um cliente com o mesmo CPF/CNPJ é reaproveitado.
- **Exclusão de cliente.** Os casos dele continuam existindo, só ficam sem cliente.

## Banco

Migração `supabase/migrations/0004_processos_e_clientes.sql`. Foi testada no Supabase local e **aplicada em produção em 09/11/2026** (as duas coisas estão no fim desta seção).

- **Tabela nova `clientes`:**
  - campos `id`, `user_id`, `nome`, `tipo` (pf|pj), `documento`, `telefone`, `email`, `observacoes`, `criado_em` e `atualizado_em`;
  - o check do documento exige 11 dígitos para PF e 14 caracteres alfanuméricos com os 2 finais numéricos para PJ;
  - índice `(user_id, nome)` e índice único `(user_id, documento)` quando há documento;
  - gatilho `clientes_atualizado_em` com a função `set_atualizado_em()`.
- **Tabela nova `processo_detalhes`:**
  - campos `project_id` (pk), `user_id`, `numero_cnj` (20 dígitos), `tribunal`, `orgao`, `area`, `fase`, `polo`, `parte_contraria`, `valor_causa numeric(14,2)`, `segredo_justica` e `link_autos`;
  - a chave estrangeira `(project_id, user_id)` aponta para `projects (id, user_id)`, com `on delete cascade`;
  - índice único `(user_id, numero_cnj)` quando há número, e índice `(user_id, area)`.
- **`projects`:**
  - restrição única `(id, user_id)`;
  - coluna `cliente_id`, com chave estrangeira `(cliente_id, user_id)` para `clientes (id, user_id)` e `on delete set null (cliente_id)`;
  - índice parcial `projects_cliente_idx`.
- **`campaign_details`:** coluna `tipo_servico` (até 80 caracteres), preenchida a partir de `channels[1]`.
- **RLS:** políticas "own clientes" e "own processos" (`user_id = auth.uid()`).
- **Grants:** `select, insert, update, delete` para `authenticated`, e `all` para `service_role`, nas duas tabelas novas.

### Teste no Supabase local (09/11/2026)

O teste rodou com Supabase CLI 3.0.0, Postgres 17 (`major_version` do `config.toml`), `npx supabase start` e `npx supabase db reset`, só no banco local (`127.0.0.1:54322`). Nenhum comando usou `--remote` ou o projeto vinculado.

1. **As quatro migrações aplicam do zero sem erro.** Isso foi conferido no `start` e em dois `db reset` completos (0001, 0002, 0003, 0004). A tabela `supabase_migrations.schema_migrations` registra as quatro versões.
2. **Preenchimento de `tipo_servico`.** Resetei até a 0003 (`db reset --version 0003`), gravei consultivos antigos direto no banco e apliquei a 0004 com `migration up`:

   | Consultivo antigo | `channels` | `tipo_servico` depois da 0004 |
   |---|---|---|
   | com canais | `{" Parecer ",Contrato}` | `'Parecer'` |
   | sem canais | `{}` | nulo |
   | canal em branco | `{"  "}` | nulo |

   `channels` ficou intacto. Um processo antigo seguiu sem cliente e sem linha em `processo_detalhes`.
3. **Teste de integração (17 de 17 passaram).** Um teste com o vitest usou o código real do app (`criarRepositorioSupabase`, `criarRepositorioDoAgente`, `services/clientes.ts`, `services/projetos.ts` e `traduzirErroDoBanco`). Ele rodou contra a API local, com dois usuários de verdade criados pelo Auth local e logados por senha:
   - **App contra o banco:**
     - criar processo com cliente, número, área, valor e segredo devolve tudo preenchido;
     - a lista de processos traz `processo_detalhes` embutido. O PostgREST resolve o embutido pela chave composta, que era a dúvida em aberto;
     - as colunas do modelo Trabalhista são criadas;
     - o CNPJ alfanumérico é gravado sem pontuação;
     - número repetido gera `ErroDeConflito` ("Já existe um processo com esse número."), sem deixar processo pela metade;
     - o mesmo número em outra conta é aceito;
     - CPF/CNPJ repetido gera `ErroDeConflito` ("Já existe um cliente com esse CPF/CNPJ.");
     - o gatilho `set_atualizado_em` atualiza `atualizado_em`;
     - o consultivo grava `tipo_servico`.
   - **RLS com dois usuários:**
     - B não lê clientes nem `processo_detalhes` de A;
     - update e delete de B nas linhas de A não afetam nada (0 linhas, e os dados de A conferidos com a chave de serviço);
     - inserir cliente com o `user_id` de A é recusado (42501);
     - gravar detalhes no processo de A é recusado;
     - ligar o processo de B ao cliente de A é recusado com "Cliente não encontrado.".
   - **Chave composta com a chave de serviço (sem RLS):**
     - `cliente_id` de outra conta é recusado (23503, traduzido para "Cliente não encontrado."), e o valor antigo fica;
     - `processo_detalhes` com `user_id` diferente do dono do projeto é recusado, tanto ao inserir quanto ao trocar o dono (23503);
     - inserir sem `user_id` falha (23502), o que confirma que no agente `auth.uid()` é nulo;
     - o repositório do agente cria cliente e processo com o `user_id` certo e não enxerga dados de B.
   - **Excluir cliente:** `cliente_id` fica nulo, e o projeto continua com o mesmo `user_id` e os mesmos detalhes. Excluir o projeto apaga os detalhes em cascata.

   Na primeira rodada, um teste falhou por erro do próprio teste. O projeto de B escolhido já tinha o mesmo número de A, e o índice único barrou a troca de dono (23505) antes da chave composta. Com um projeto sem número, a chave composta recusou a inserção e a troca de dono (23503).

   O teste está no repositório em `supabase/testes/banco-local.test.ts` e roda com `npm run test:banco-local` (config `vitest.banco-local.config.mts`, script `scripts/banco-local.mjs`). Ele é opcional e fica fora do `npm test` e do `npm run verificar`. O script lê as chaves de `npx supabase status`, nunca do `.env.local`, e recusa rodar se a URL não for local. Os passos estão no README, em "Testar as migrações no Supabase local".

   Conferido em 09/11/2026: 17 de 17 depois de `db reset`, e 17 de 17 numa segunda rodada sem reset. Com o Supabase local desligado, o script avisa "O Supabase local não está rodando. Rode antes: npx supabase start" e sai com código 1.

O Supabase local foi desligado no fim (`npx supabase stop`, com backup dos volumes locais).

### Aplicação em produção (09/11/2026)

A migração foi aplicada com a sua autorização ("pode aplicar"). As credenciais vieram do `myPlan/.env`, que está ignorado pelo git e não é versionado. Projeto `gmulobmdmdbebmmikhyu`, pela conexão de sessão do pooler (`aws-0-us-east-1.pooler.supabase.com:5432`). O ref do projeto bate com `DIRECT_URL` e com `NEXT_PUBLIC_SUPABASE_URL`.

1. **Checagens antes, só leitura:**
   - Postgres 17.11;
   - histórico com 0001, 0002 e 0003, então só a 0004 era nova;
   - nenhuma tabela, coluna ou função da 0004 existia;
   - nenhuma linha em `projects` nem em `campaign_details`, então o preenchimento de `tipo_servico` não alterou nada e o limite de 80 caracteres não podia falhar.
2. **Ensaio:** `supabase db push --dry-run` listou só `0004_processos_e_clientes.sql`.
3. **Aplicação:** `supabase db push`, o mesmo comando do `npm run db:migrar`. O CLI, em modo agente, pediu confirmação explícita e não alterou nada. Depois rodou com `--yes`, aplicando a 0004 sem erro.
4. **Conferência depois, só leitura:**
   - histórico 0001 a 0004;
   - tabelas `clientes` e `processo_detalhes`;
   - colunas `projects.cliente_id` e `campaign_details.tipo_servico`;
   - restrições `projects_id_user_unique`, `clientes_id_user_id_key`, `projects_cliente_fk` (`ON DELETE SET NULL (cliente_id)`) e `processo_detalhes_projeto_fk`;
   - os cinco índices;
   - RLS ligado nas duas tabelas, com as políticas "own clientes" e "own processos";
   - grants de `select`, `insert`, `update` e `delete` para `authenticated`;
   - gatilho `clientes_atualizado_em`;
   - check do documento aceitando CNPJ alfanumérico.
5. **API:** `GET /rest/v1/projects?select=*,campaign_details(*),processo_detalhes(*)` e `GET /rest/v1/clientes` responderam 200, então a lista de processos do app já funciona com o banco novo.

Não houve backup feito por mim antes da aplicação. O banco não tinha projetos nem campanhas, e a 0004 só acrescenta tabelas, colunas e restrições.

## Testes

- **Antes:** 127 testes em 11 arquivos (a `main` depois da Etapa 1).
- **Depois:** 166 testes em 14 arquivos.
- **Arquivos novos:**
  - `src/domain/cliente.test.ts`: CPF, CNPJ numérico e alfanumérico (exemplo oficial `12.ABC.345/01DE-35`), normalização e formatação, validação do cadastro, e-mail e busca.
  - `src/domain/processo.test.ts`: dígito do número CNJ, formatação, validação dos detalhes (valor, link, normalização), "Família e sucessões", sugestão entre área e modelo e restrição de modelo por tipo.
  - `src/data/supabase/erros.test.ts`: 23505 nos dois índices, 23503 do cliente e erros que passam sem tradução.
- **Arquivos ampliados:**
  - `contexto-agente.test.ts`: os quatro métodos de clientes passam pelo filtro de usuário. Um teste novo exige `user_id` explícito em toda gravação em `clientes` e `processo_detalhes`, com um controle mostrando que sem o embrulho o campo não iria.
  - `rotas.test.ts`: CRUD de clientes pela API, exclusão que desvincula, 409 para CPF/CNPJ e número repetidos, 400 para CPF e número inválidos.
  - `projeto.test.ts`: tipo de serviço, consultivo sem processo, padrões, número CNJ, entrada sem detalhes e busca por cliente, parte contrária, número e área.
  - `importacao.test.ts`: cliente e detalhes na fotografia, arquivo antigo e cliente reaproveitado.
  - `ferramentas.test.ts`: `criar_projeto` recusando modelo que não combina com o tipo.
- **Resultado do `npm run verificar`:** passou (typecheck, 166 testes e build).
- **Banco real:** 17 testes de integração contra o Supabase local passaram (detalhes em "Banco"). Eles rodam com `npm run test:banco-local`, fora do `npm test`.
- **Conferência extra no navegador:** com Chrome sem interface sobre o build de produção, em modo local:
  - `/`, `/clientes` e `/consultivo` renderizaram sem erro de JavaScript;
  - criar um processo com cliente novo, modelo Trabalhista e número CNJ funcionou: a área foi sugerida e o cartão mostrou cliente, número e área;
  - o mesmo número de novo mostrou a mensagem de duplicado;
  - a busca achou pelo número sem pontuação, pelo cliente e pela parte contrária.

## Como conferir à mão

**No navegador (modo local):**

1. Rode `npm run dev`, apague a chave `myplan:v2` do localStorage e recarregue.
2. Abra **Clientes**.
   - Devem aparecer seis clientes fictícios, com a quantidade de casos de cada um.
   - Cadastre um cliente PJ com o CNPJ `12.ABC.345/01DE-35`.
   - Cadastre outro com o mesmo CNPJ: deve aparecer "Já existe um cliente com esse CPF/CNPJ.".
3. Em **Processos**, clique em "Novo processo".
   - Escolha o modelo Trabalhista e veja a área mudar.
   - Digite um cliente que não existe e preencha o número.
   - Abra "Mais dados do processo" e marque segredo de justiça.
   - Salve e confira o cartão.
4. Busque pelo número sem pontuação, pelo nome do cliente e por "locatário". Use também o filtro de área.
5. Abra o processo e depois a aba **Detalhes**: os dados preenchidos e o link dos autos devem aparecer.
6. Em **Consultivo**, crie um caso.
   - Só o modelo Consultivo deve aparecer.
   - Confira os campos Tipo de serviço, Pedido do cliente, Recebido em e Prazo de entrega.
7. Exclua um cliente com processos. Depois de 5 segundos, os cartões devem ficar sem cliente. Teste também o "Desfazer".
8. Em Configurações, exporte e confira se o arquivo traz `clientes` e `processos`.

**Com o Supabase local (já testado, ver "Banco"):**

1. Rode `npx supabase start` e depois `npx supabase db reset` (local por padrão; nunca com `--remote`).
2. Para usar o app com ele, aponte um `.env.local` de teste para `http://127.0.0.1:54321`, com as chaves de `npx supabase status`, e repita os passos acima logado.
3. Confira 409 e 400 na aba Rede do navegador.

**Em produção:** a 0004 já está aplicada (ver "Banco"). O código desta branch pode ser publicado.

**No agente:**

1. Peça "cria a campanha Parecer X com modelo trabalhista". Deve responder com erro: "Caso consultivo usa o modelo Consultivo.".
2. Peça um processo sem modelo. As colunas devem ser as de Cível/JEC, sem cliente nem detalhes.

## Fora do escopo e pendências

- **Etapa 3:**
  - tipos de tarefa, prazo fatal, motor de prazos, feriados e histórico de alterações (migração 0005);
  - "documentos pendentes" do cliente, que dependem de definir quais itens de checklist contam.
- **Etapa 4:**
  - `criar_processo` com cliente, número e área pelo agente;
  - mensagens do agente no vocabulário jurídico;
  - ícones jurídicos também no agente.
- **Etapa 5:** `ultima_consulta_em` e DataJud.
- **Ideias futuras:** litisconsórcio e trocar o modelo de um quadro existente.
- **Tipos do banco:** `npm run db:tipos` não foi rodado, porque depende de um banco com a 0004.

## Riscos e dúvidas para a próxima etapa

**Riscos**
- **O arquivo de ambiente se chama `.env`, não `.env.local`.** O Next.js lê os dois, mas os scripts `npm run db:*` só leem o `.env.local`. Para usá-los, renomeie ou copie o arquivo. A 0004 foi aplicada passando as variáveis direto para o CLI.
- **Região do banco.** O projeto está em `us-east-1`. O README recomenda funções na Vercel em `gru1`, perto de `sa-east-1`. Com o banco em `us-east-1`, vale escolher a região das funções perto dele.
- **Ordem de publicação.** O código desta branch quebra a lista de processos num banco sem a 0004. É preciso aplicar a migração antes do deploy.
- **Cliente cadastrado pelo nome no formulário.** Se a gravação do processo falhar depois (número repetido, por exemplo), o cliente novo fica cadastrado sem processo. Na segunda tentativa ele é reaproveitado pelo nome.
- **Clientes com o mesmo nome.** O formulário escolhe o primeiro. Mostrar o documento na sugestão ajudaria.
- **Segredo de justiça é só uma marca.** Ele não muda quem vê nem o que vai para o agente. Se quiser algum efeito (por exemplo, o agente não citar a parte contrária), isso precisa ser decidido.

**Respostas para a Etapa 3 (já decididas por você, etapa ainda não começada)**
1. **Documento pendente:** item de checklist com um campo novo `doCliente`, guardado no jsonb sem migração e marcável na tela.
2. **Margem do prazo interno:** 2 dias úteis por padrão, ajustável em Configurações e editável por tarefa.
3. **Feriados:**
   - nacionais fixos e móveis calculados em `domain/`, sem tabela;
   - a tabela guarda feriados e suspensões por tribunal, começando por TJRS, TRT4 e TRF4, carregados por migração;
   - ela também guarda feriados locais do usuário, com `user_id`. O RLS lê os gerais e os próprios, e grava só os próprios.
4. **Validação com advogados de Pelotas:** ainda não aconteceu.

## Commits

| Hash | Mensagem |
|---|---|
| `c25e26a` | Atualiza o modelo de dados da proposta para a etapa 2 |
| `965558d` | Adiciona a migração 0004 com clientes e detalhes do processo |
| `5f0cac8` | Aceita CNPJ alfanumérico na migração 0004 |
| `2f5a137` | Adiciona clientes e detalhes do processo ao domínio e aos repositórios |
| `e6cf9e6` | Adiciona as rotas de clientes e os campos novos à API |
| `7027181` | Testa clientes, conflitos e a restrição de modelo pela API e pelo agente |
| `c576020` | Leva clientes e detalhes do processo na exportação e no exemplo |
| `dcbda44` | Adiciona a tela de clientes e os ícones jurídicos no menu |
| `2e8df88` | Mostra cliente e dados do processo no formulário, cartões e detalhes |
| `933f1c4` | Atualiza ARQUITETURA e README para a etapa 2 |
| `5c5c72c` | Adiciona o relatório da etapa 2 |
| `18cfad4` | Registra no relatório da etapa 2 o teste da 0004 no Supabase local |

O commit que adiciona o `npm run test:banco-local` e atualiza este relatório entra depois dos listados acima.
