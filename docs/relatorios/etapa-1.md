# Etapa 1: renomear e reorganizar

Branch `juridico/etapa-1`. Referência: seção 10, item 1, de `docs/PROPOSTA_JURIDICA.md`.

## Resumo

A interface passa a falar a língua do advogado: Hoje, Processos, Consultivo e Prazos e tarefas, com rotas novas e redirecionamento das antigas. Ao criar um processo ou caso consultivo, o advogado escolhe um modelo de quadro por área (Cível/JEC, Trabalhista, Previdenciário, Família ou Consultivo). O modo local vem com casos jurídicos fictícios. Nada mudou no banco.

## O que mudou

**domain**
- `src/domain/quadro.ts`: `COLUNAS_PADRAO` deu lugar a `MODELOS_DE_QUADRO`, `MODELOS`, `modeloPadrao(tipo)` e `colunasDoModelo(modelo)`. Todo modelo tem uma coluna de cada `kind` (todo, doing, waiting, done), e só os títulos mudam.
- `src/domain/projeto.ts`: `SUGESTOES_DE_CANAIS` passou a ser Contrato, Parecer, Notificação extrajudicial e Inventário extrajudicial.

**services**
- `src/services/projetos.ts`: `criarProjeto(repo, dados, modelo?)`. Sem modelo, usa Cível/JEC para projeto e Consultivo para campanha.

**data**
- `src/data/local/exemplo.ts`: sete casos fictícios. Os processos são Cobrança de aluguéis, Cobrança de cheques, Reclamação trabalhista e Aposentadoria por idade. Os consultivos são Contrato de prestação de serviços, Parecer sobre LGPD e Notificação extrajudicial. Cada caso usa o modelo da sua área.
- O repositório, a API e o Supabase não mudaram. `POST /api/projetos` já recebia as colunas prontas.

**hooks**
- `src/hooks/use-projetos.tsx`: `criar(dados, modelo?)` e avisos novos ("Processo criado", "Caso consultivo criado", "Caso arquivado"...).

**interface**
- Rotas: `src/app/(app)/hoje`, `consultivo` e `prazos` (eram `visao-geral`, `campanhas` e `tarefas`). Os redirecionamentos 307 ficam em `next.config.ts`.
- Telas renomeadas: `tasks/tela-hoje.tsx` (`TelaHoje`), `campaigns/tela-consultivo.tsx` (`TelaConsultivo`) e `tasks/tela-prazos.tsx` (`TelaPrazos`).
- `projects/formulario-projeto.tsx`: seletor "Modelo de quadro" (só ao criar), tipos Processo e Consultivo, e "Tipo de serviço" no lugar de "Canais de divulgação".
- Textos: `layout/menu-lateral.tsx`, `projects/tela-projetos.tsx`, `projects/interface-projeto.tsx`, `board/aba-detalhes.tsx`, `board/tela-quadro.tsx`, `settings/secao-dados.tsx`, `settings/secao-agente.tsx` e `app/layout.tsx`.

**agente/MCP**
- `src/services/agente/ferramentas.ts`: `criar_projeto` ganhou o parâmetro opcional `modelo` (civel, trabalhista, previdenciario, familia, consultivo) e uma descrição com as colunas de cada modelo. As outras ferramentas e as mensagens do agente não mudaram.

**banco**
- Sem mudanças.

**docs**
- `docs/ARQUITETURA.md`: vocabulário, rotas, redirecionamentos, modelos de quadro, ferramenta `criar_projeto` e etapa concluída.
- `README.md`: telas, endereços antigos e modelos.
- `agente/README.md`: "Visão geral" virou "Hoje".
- `docs/PROPOSTA_JURIDICA.md`: o campo de área foi para a etapa 2, os ícones para a etapa 2 e as mensagens do agente para a etapa 4.
- `CLAUDE.md`: regras de trabalho e modelo deste relatório.

## Decisões tomadas

| Decisão | Motivo | Alternativas descartadas |
|---|---|---|
| O modelo de quadro não é gravado. Ele só escolhe as colunas criadas. | A API já recebia as colunas, então não foi preciso migração. Depois de criado, o quadro vive das próprias colunas. | Gravar o modelo em `projects` (exigiria migração). |
| Cível/JEC é o padrão de processo e Consultivo o de campanha. | É o que a proposta pede. | Manter as quatro colunas antigas como padrão. |
| O seletor de modelo aparece só ao criar. | Trocar o modelo de um quadro existente exigiria renomear colunas que já têm tarefas. | Mostrar também na edição. |
| No Consultivo, `channels` aparece como "Tipo de serviço", com sugestões jurídicas. Decisão sua. | Aproveita o campo sem migração. | Esconder o campo. |
| Um item do Consultivo é chamado de "caso consultivo", e os avisos comuns aos dois tipos dizem "Caso". | "Consultivo criado" não soa natural, e "Caso pausado" serve para os dois tipos. | "Consultivo" sozinho; avisos diferentes por tipo. |
| Redirecionamento 307, temporário. Confirmado por você. | O nome do produto ainda não está definido. Um 308 ficaria guardado nos navegadores. | 308, permanente. |
| `/projetos/[id]` continua igual. | O agente manda links nesse formato. | Nenhuma. |
| O megafone continua no Consultivo, na tela e no agente, e os ícones do menu não mudaram. Decisão sua. | Ícones jurídicos ficam para a etapa 2. | Trocar o ícone agora nos dois lugares. |
| O campo de área foi para a etapa 2. Combinado com você. | Ele precisa de coluna nova no banco. | Guardar a área em etiqueta ou na descrição. |
| As mensagens do agente ("Criei o projeto X") ficam para a etapa 4. Decisão sua. | Nesta etapa o agente só ganha o parâmetro `modelo`. | Trocar as mensagens agora. |
| O exemplo novo mantém a estrutura do antigo (quantidade de tarefas, colunas, prioridades, datas e checklists). | Os testes do agente, da rota MCP e da importação contam com esses números. Assim só os nomes mudaram. | Escrever um exemplo do zero e refazer as asserções. |
| Os componentes das telas foram renomeados (`TelaHoje`, `TelaConsultivo`, `TelaPrazos`). | Mantém nome da rota e nome do componente iguais. | Manter `TelaVisaoGeral` e os outros nomes antigos. |
| As suas alterações em docs entraram num commit separado. Combinado com você. | Assim não se misturam com os commits da etapa. | Você commitar antes. |

## Mudanças de comportamento

- **Telas e menu.** Hoje, Processos, Consultivo e Prazos e tarefas substituem Visão geral, Meus projetos, Campanhas e Tarefas. Os endereços antigos levam aos novos.
- **Formulário de criação.** Pede o modelo de quadro e mostra as colunas do modelo escolhido.
- **Colunas de quem cria sem escolher modelo, na tela ou pelo agente.**
  - Um processo agora ganha "A fazer, Em andamento, Aguardando decisão, Concluído".
  - Um caso consultivo agora ganha "A fazer, Redigindo, Aguardando cliente, Entregue".
  - Antes, os dois ganhavam "Aguardando" e "Concluído".
- **Agente.** `criar_projeto` aceita `modelo` e recusa valores fora da lista. As respostas continuam "Criei o projeto X" e "Criei a campanha X".
- **Modo local.** Navegadores sem dados salvos começam com os casos jurídicos. Quem já tinha dados em `myplan:v2` continua vendo o exemplo antigo.
- **Quadros que já existem.** Não mudam.

## Banco

Sem mudanças: nenhuma migração, tabela, coluna, política de RLS ou grant.

## Testes

- **Antes:** 121 testes em 11 arquivos.
- **Depois:** 127 testes em 11 arquivos.
- **Testes novos:**
  - `src/domain/quadro.test.ts` (4): todo modelo tem os quatro `kind` na ordem certa; as colunas de cada área seguem a proposta; o padrão por tipo; `colunasDoModelo` devolve uma cópia.
  - `src/services/agente/ferramentas.test.ts` (2): `criar_projeto` com `modelo: "trabalhista"` e recusa de um modelo inexistente.
- **Testes ajustados:**
  - `criar_projeto` sem modelo agora espera as colunas Cível/JEC e confere as colunas Consultivo da campanha.
  - Os nomes do exemplo foram trocados em `ferramentas.test.ts`, `mcp/route.test.ts` e `importacao.test.ts`.
  - `rotas.test.ts` usa `colunasDoModelo("familia")`, cujas colunas são iguais às antigas.
- **Resultado do `npm run verificar`:** passou (typecheck, 127 testes e build).
- **Conferência extra:** com `next start`, `/visao-geral`, `/campanhas` e `/tarefas` responderam 307 para os endereços novos, e `/hoje`, `/consultivo` e `/prazos` responderam 200.

## Como conferir à mão

**No navegador (modo local):**

1. Rode `npm run dev` e abra http://localhost:3000.
2. Para ver o exemplo novo, apague a chave `myplan:v2` do localStorage (DevTools > Application > Local Storage) e recarregue.
3. Confira o menu: Hoje, Processos, Consultivo, Prazos e tarefas.
4. Abra http://localhost:3000/visao-geral, `/campanhas` e `/tarefas`. Cada um deve levar a `/hoje`, `/consultivo` e `/prazos`.
5. Em Processos, clique em "Novo processo".
   - O modelo deve vir em Cível/JEC.
   - Troque para Trabalhista e veja as colunas mudarem embaixo do seletor.
   - Crie o processo e confira as colunas no quadro.
6. No formulário, troque o tipo para Consultivo.
   - O modelo deve ir para Consultivo.
   - O campo deve aparecer como "Tipo de serviço", com as sugestões jurídicas.
7. Abra "Cobrança de aluguéis" e depois a aba Detalhes. O Tipo deve aparecer como "Processo".
8. Edite um processo. O seletor de modelo não deve aparecer.

**No agente:**

1. Peça "cria o processo Teste de horas extras, modelo trabalhista". As colunas devem terminar em "Aguardando audiência" e "Concluído".
2. Peça um processo sem modelo. As colunas devem ser as de Cível/JEC.
3. O link da resposta deve continuar em `/projetos/<id>`.

## Fora do escopo e pendências

- **Etapa 2:**
  - campo de área (em `processo_detalhes`);
  - clientes;
  - `tipo_servico` próprio no consultivo;
  - ícones jurídicos;
  - restringir os modelos por tipo;
  - busca por cliente, número ou parte contrária em Processos.
- **Etapa 4:** mensagens do agente no vocabulário jurídico. `COLUNA_PT`, "2 em Aguardando" e o `SOUL.md` não mudaram.
- **Ideia futura:** trocar o modelo de um quadro existente.

## Riscos e dúvidas para a próxima etapa

**Riscos**
- Quem já usou o modo local não vê o exemplo novo sem limpar o localStorage.
- Hoje o seletor aceita qualquer modelo nos dois tipos. Um caso consultivo criado com o modelo Trabalhista tem colunas de processo. A restrição entra na etapa 2.
- O agente cria processos com colunas Cível/JEC quando não recebe modelo. Pode ser preciso orientar o `SOUL.md` na etapa 4 para ele perguntar ou deduzir a área.

**Dúvidas que você já respondeu para a etapa 2**
- **Área:** é um campo próprio em `processo_detalhes`, independente do modelo, que continua sem ser gravado. No formulário, escolher o modelo sugere a área e vice-versa.
- **Cliente:** `cliente_id` (nulo permitido) fica em `projects`, para processo e consultivo.
- **Consultivo:**
  - ganha `tipo_servico` (texto único) em `campaign_details`, e `channels` sai da tela;
  - "Objetivo" vira "Pedido do cliente" e o período vira "Prazo de entrega";
  - não haverá tabela nova.
- **Modelos:** Consultivo só para casos consultivos; os outros quatro só para processos.
- **Trocar o modelo de um quadro existente:** fica como ideia futura.

**Em aberto**
- O que acontece com os dados que já estão em `channels` quando o campo sair da tela: migrar o primeiro valor para `tipo_servico` ou deixar como está.
- Se "Prazo de entrega" substitui o início e o fim da campanha ou só o fim.

## Commits

| Hash | Mensagem |
|---|---|
| `15dcd0a` | Adiciona a proposta jurídica e a revisão da arquitetura |
| `1f43e2a` | Troca as colunas padrão por modelos de quadro por área |
| `1b7c633` | Adiciona o parâmetro modelo à ferramenta criar_projeto |
| `cb4fc63` | Adiciona a escolha do modelo de quadro ao criar projeto |
| `db63ff4` | Troca o vocabulário da interface e as rotas para o jurídico |
| `6d5ee43` | Troca os dados de exemplo por casos jurídicos fictícios |
| `49763fe` | Atualiza a documentação para a etapa 1 da versão jurídica |

Este relatório e o `CLAUDE.md` entram num último commit, depois dos listados acima.
