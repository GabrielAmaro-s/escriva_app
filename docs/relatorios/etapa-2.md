# Etapa 2: processo e clientes

Branch `juridico/etapa-2`. Referência: seção 10, item 2, de `docs/PROPOSTA_JURIDICA.md`.

## Resumo

O advogado passa a cadastrar clientes e a ligar cada processo ou caso consultivo a um deles. O processo ganha número CNJ, área, fase, tribunal, vara, polo, parte contrária, valor da causa, segredo de justiça e link dos autos. O consultivo ganha tipo de serviço, pedido do cliente e prazo de entrega. A migração 0004 está escrita e revisada, mas **não foi aplicada em nenhum banco**.

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

Migração `supabase/migrations/0004_processos_e_clientes.sql`. **Não foi aplicada.** Também não foi executada em nenhum Postgres, nem descartável.

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

**Com Supabase (só depois da sua confirmação para aplicar a 0004):**

1. Aplique a 0004 num projeto de desenvolvimento com `npm run db:migrar`.
2. Repita os passos acima logado.
3. Confira 409 e 400 na aba Rede do navegador.

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
- **A migração não foi executada em nenhum Postgres.**
  - A sintaxe segue a 0001–0003, mas `on delete set null (cliente_id)` exige Postgres 15 ou mais novo.
  - O embutido `processo_detalhes(*)` do PostgREST passa por uma chave estrangeira composta. Ele deve funcionar, mas só um banco real confirma.
  - O Docker está disponível nesta máquina para um teste num Postgres descartável, se você autorizar.
- **Ordem de publicação.** O código desta branch quebra a lista de processos num banco sem a 0004. É preciso aplicar a migração antes do deploy.
- **Cliente cadastrado pelo nome no formulário.** Se a gravação do processo falhar depois (número repetido, por exemplo), o cliente novo fica cadastrado sem processo. Na segunda tentativa ele é reaproveitado pelo nome.
- **Clientes com o mesmo nome.** O formulário escolhe o primeiro. Mostrar o documento na sugestão ajudaria.
- **Segredo de justiça é só uma marca.** Ele não muda quem vê nem o que vai para o agente. Se quiser algum efeito (por exemplo, o agente não citar a parte contrária), isso precisa ser decidido.

**Dúvidas para a Etapa 3**
1. **Documentos pendentes:** contam todos os itens de checklist abertos dos processos do cliente, ou só os de uma etiqueta ou tipo "documento"?
2. **Prazo fatal e prazo interno:** a margem padrão (em dias úteis) é configurável por conta em Configurações, como diz a seção 9?
3. **Feriados:** quem alimenta a tabela nacional e estadual na primeira versão? Você, por migração com dados, ou uma tela de administração?
4. **Advogados de Pelotas:** a seção 10 pede validar com dois ou três advogados antes da Etapa 3. Isso já aconteceu, ou a Etapa 3 começa só pelo que não depende da validação (tipos de tarefa e histórico)?

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

Este relatório entra num último commit, depois dos listados acima.
