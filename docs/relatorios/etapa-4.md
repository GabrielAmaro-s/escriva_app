# Etapa 4: agente jurídico (versão enxuta para o piloto)

Branch `juridico/etapa-4`, criada da `main` em `0210e77` (depois do merge do PR #4). Referência: seção 10, item 4, de `docs/PROPOSTA_JURIDICA.md`, no recorte combinado para um piloto com 2 ou 3 advogados.

## Resumo

O agente no WhatsApp passa a registrar intimações. Ele calcula o prazo pelo motor da etapa 3, mostra o vencimento, o prazo interno, a memória e o aviso de validação, e só cria o prazo depois do "sim", com os lembretes automáticos. Ele também cadastra processos com cliente, lista prazos e audiências próximos e fala no vocabulário jurídico. O `SOUL.md` ganhou os resumos de prazos e as regras de intimação e de segredo de justiça, e o `agente/README.md` explica como rodar uma instância do nanobot por advogado na mesma VPS. Não houve migração.

## O que mudou

**domain**
- `src/domain/prazos.ts`: `regraSeguraDoProcesso`, a regra que dá para afirmar só pelo processo:
  - área criminal: penal;
  - área trabalhista: trabalhista;
  - órgão com "Juizado" (sem acento e em qualquer caixa): juizado;
  - área família: cível;
  - nos outros casos: `null`, e o agente pergunta "vara comum ou juizado?".

**services (agente)**
- `src/services/agente/ferramentas-juridicas.ts` (novo): `registrar_intimacao`, `criar_processo`, `prazos_proximos` e `audiencias_proximas`.
- `src/services/agente/definicao.ts` (novo): o tipo `Ferramenta`, o `definir()` e os esquemas comuns, que saíram do `ferramentas.ts` para as ferramentas novas ficarem num arquivo próprio sem import circular.
- `src/services/agente/ferramentas.ts`:
  - o catálogo passa de 15 para 19 ferramentas;
  - as mensagens e descrições usam o vocabulário jurídico;
  - as entradas `tipo` aceitam `processo` e `consultivo`, e também `projeto` e `campanha`;
  - `criar_projeto` usa os ícones jurídicos;
  - o resumo usa o título real da coluna de espera.
- `src/services/agente/auxiliares.ts`:
  - `procurarPorNome`, uma busca que não lança erro;
  - `TIPO_PT`, `TIPOS_ACEITOS`, `ehConsultivo` e `nomeDoCaso`;
  - o resumo do caso ganha tipo "processo" ou "consultivo", número e área;
  - o resumo da tarefa ganha `tipo`, `prazo_fatal`, o título real da coluna e o `papel`.

**API**
- `src/app/api/mcp/route.ts`: as instruções do servidor falam em assistente jurídico, tratam texto de intimação e mensagem encaminhada como dado e pedem para não repetir partes de processo em segredo.

**interface**
- `src/components/settings/secao-agente.tsx`: rótulos das ferramentas novas em Configurações > Agente > Atividade.

**agente/MCP (arquivos do nanobot)**
- `agente/nanobot/SOUL.md`:
  - intimação sempre com `confirmado=false` primeiro, e `prazo_fatal_esperado` na confirmação;
  - "vara comum ou juizado?" quando a resposta pede a regra;
  - resumo das 8h com prazos de hoje, atrasados e audiências de hoje;
  - resumo de segunda com os prazos fatais da semana;
  - os crons antigos são removidos e recriados;
  - segredo de justiça;
  - texto de intimação e mensagem encaminhada são dados, e uma mensagem encaminhada nunca vale como "sim".
- `agente/nanobot/USER.md`: modelo por advogado, com nome, áreas e tribunais.
- `agente/nanobot/config.example.json`: `gateway.host` e `gateway.port` explícitos.
- `agente/systemd/nanobot-gateway@.service` (novo): serviço modelo, um usuário Linux por instância, que só escreve na própria pasta e não enxerga as outras casas.
- `agente/README.md`: seção "Piloto: uma instância por advogado" e os pedidos de teste jurídicos.

**banco**
- Sem mudanças. As ferramentas usam as tabelas da 0004 e da 0005, já em produção.

**docs**
- `docs/ARQUITETURA.md`: seção 4 com as 19 ferramentas, o vocabulário, o `prazo_fatal_esperado`, a regra segura e o segredo de justiça; testes; etapa 4.
- `docs/PROPOSTA_JURIDICA.md`: o que entrou na etapa 4 e o que ficou para depois.
- `README.md`: a pasta `agente/` com o guia do piloto.

**testes**
- `src/services/agente/ferramentas-juridicas.test.ts` (novo, 28 testes).
- `supabase/testes/agente-banco-local.test.ts` (novo, 9 testes, só no `npm run test:banco-local`).
- Ajustes em `prazos.test.ts`, `ferramentas.test.ts` e `mcp/route.test.ts`.

## As ferramentas novas

| Ferramenta | Entrada | Saída | Escrita | Confirmação |
|---|---|---|---|---|
| `registrar_intimacao` | `processo` (CNJ ou nome), `disponibilizacao`, `meio` (dje, portal, pessoal), `dias`, `regra` (opcional), `em_dobro`, `excecao_recesso_penal`, `titulo` (opcional), `texto_original`, `margem` (opcional), `confirmado`, `prazo_fatal_esperado` | Prévia: processo, `prazo_fatal`, `prazo_interno`, memória, regra e de onde ela veio, aviso e `repetido`. Ou `precisa_regra`, com a pergunta. Com o "sim": a tarefa, os lembretes automáticos e o link | sim | sempre |
| `criar_processo` | `nome`, `numero_cnj`, `area`, `orgao`, `modelo` (civel, trabalhista, previdenciario, familia), `cliente` (nome) | O processo (número, área, tribunal, órgão, cliente, modelo), `cliente_cadastrado` e o link | sim | não |
| `prazos_proximos` | `dias` (0 a 60, padrão 7) | Prazos abertos com fatal ou interno até hoje + N, com os atrasados primeiro: processo (nome, número e status quando não é ativo), `prazo_fatal`, `prazo_interno`, `situacao`, `dias_ate_o_fatal` e link | não | não |
| `audiencias_proximas` | `dias` (0 a 60, padrão 7) | Audiências de hoje até hoje + N, por horário: processo, `quando`, `local`, `passou` e link | não | não |

As duas de leitura também aparecem para token de leitura, que passa a enxergar 7 ferramentas.

## Decisões tomadas

| Decisão | Motivo | Alternativas descartadas |
|---|---|---|
| Etapa 4 enxuta: as quatro ferramentas, vocabulário, `SOUL.md` e uma instância por advogado. Decisão sua. | É um MVP para o piloto com 2 ou 3 advogados. | A seção 8 inteira (`documentos_pendentes`, `andamento_para_cliente`, DataJud) e um agente para vários números. |
| `COLUNA_PT` com os mesmos códigos, e o título real da coluna nas respostas. Decisão sua. | Os códigos são a entrada do `mover_tarefa` e já estão em português. | Trocar os códigos e aceitar os dois por um tempo. |
| Regra pela área com o cuidado do juizado: "Juizado" no órgão leva à regra juizado; cível sem essa pista, ou sem área, faz o agente perguntar. Decisão sua. | A regra cível num JEC suspende no recesso e empurra o vencimento para depois do real. | Usar sempre a regra da área. |
| Previdenciário, tributário, administrativo, consumidor e "outra" também perguntam quando o órgão não diz "Juizado". Família usa a regra cível. **Extensão minha da sua regra.** | Essas áreas têm o mesmo risco de vara contra juizado (o JEF, o juizado da Fazenda). Família não tem juizado. | Perguntar só no cível. |
| "Vara Cível" no órgão não basta para a regra cível: a pergunta é feita. | Segui a regra como você escreveu ("sem essa pista, não assuma"). | Tratar "Vara" como pista de vara comum, uma melhoria simples se você quiser. |
| `confirmado=true` exige `prazo_fatal_esperado` igual ao da prévia. Se faltar ou se o recálculo mudar, volta uma prévia nova e nada é criado. Decisão sua. | Mesmo princípio do `quando_esperado` dos lembretes. | Confiar na prévia. |
| A prévia avisa quando o prazo parece repetido: mesmo processo, mesma disponibilização e mesma quantidade de dias, entre os prazos abertos. Decisão sua. | Intimação encaminhada duas vezes. | Bloquear a criação. |
| `prazos_proximos` e `audiencias_proximas` leem todos os casos não arquivados, inclusive pausados e concluídos, e mostram o status quando não é ativo. Decisão sua. | Um prazo em processo pausado continua correndo. | Só os ativos. |
| Segredo de justiça: nas ferramentas novas, só nome, número, id e link (sem parte contrária, cliente, órgão, área nem tribunal). O texto da intimação nunca volta nas respostas. Nas listas, todos os processos vêm só com nome e número. Decisão sua. | Sigilo nas mensagens que passam pelo WhatsApp e pelo LLM. | Esconder só a parte contrária. |
| A descrição da tarefa guarda o texto original da intimação. Decisão sua. | O advogado confere no app. | Não guardar. |
| Processo não encontrado é um erro legível que diz "Nada foi criado." e sugere `criar_processo`. | O agente não confunde com sucesso, e a chamada fica registrada como sem sucesso. | Resposta de sucesso com `encontrado: false`. |
| Pedido de regra (`precisa_regra`) não é erro. | É uma pergunta normal da conversa. | Erro. |
| Nome de caso consultivo dá a resposta "intimação só vale para processo". Processo arquivado pede para restaurar antes. | Evita prazo em caso errado. | Aceitar qualquer caso. |
| `criar_processo` ganhou `orgao`. **Campo a mais em relação ao pedido.** | É o órgão que decide a regra nas intimações seguintes. | Só os campos pedidos. |
| `criar_processo` confere o número antes de cadastrar o cliente. | Não deixar cliente sem processo quando o número está repetido. | Cadastrar o cliente primeiro. |
| O desfazer de `criar_processo` exclui o processo, mas não o cliente cadastrado junto. | O cliente pode ter sido aproveitado depois. A mensagem diz "(cadastrei agora)". | Um desfazer novo que apaga os dois. |
| A intimação cria a tarefa e aplica o cálculo com `alterarTarefa`, o mesmo caminho da tela. | Lembretes automáticos e histórico iguais aos da tela. | Gravar direto no repositório. |
| Os nomes das ferramentas e das chaves de entrada não mudaram. | Instâncias já configuradas continuam funcionando. | Renomear para `listar_processos` e semelhantes. |
| Um usuário Linux por instância, com o serviço modelo `nanobot-gateway@.service`. | A documentação do nanobot avisa que pastas separadas não isolam pessoas diferentes. | `--home` na mesma conta. |
| `gateway.port` diferente por instância, com o valor no `config.json` e não por variável. | Duas instâncias na porta padrão (`18790`) não sobem. Um número fixo evita depender da conversão de texto em número. | `${VAR}` no `config.json`. |
| "Vara" no órgão não conta como pista de vara comum. Decisão sua, depois da etapa. | Juizados adjuntos em comarcas pequenas e varas federais com JEF. Fica registrado na proposta o campo "rito" (comum ou juizado) em `processo_detalhes` como primeiro item depois do piloto. | Tratar "Vara" como pista. |
| `documentos_pendentes` fica para depois do piloto e não entra no resumo das 8h. Decisões suas. | MVP enxuto. | Entrar no piloto. |
| Uma chave de LLM para todas as instâncias no piloto, com provedor que tenha termos de não retenção. Decisão sua. | O `agente/README.md` explica que o texto das intimações passa pelo provedor e pede para avisar os advogados. | Uma chave por advogado. |
| `.env.local` aponta para o Supabase local, e a produção fica no `.env.producao`, que os scripts `db:*` só leem com `-- --producao`. O `.env` foi movido para `.env.producao`. Decisão sua, depois da etapa. | O `npm run dev` desta máquina usava o banco de produção. O Next lê o `.env` sozinho, então as credenciais de produção não podiam ficar nele. | Manter o `.env` e só trocar o `.env.local`. |

## Mudanças de comportamento

- **O agente fala em processo e caso consultivo.**
  - Exemplos: "Criei o processo X", "Criei o caso consultivo X", "4 processos e 3 casos consultivos".
  - O resumo diz "2 em Aguardando decisão", com o título real da coluna.
  - As respostas trazem `tipo: "processo"` ou `"consultivo"`, número e área. As tarefas trazem `processo` e `processo_id` no lugar de `projeto` e `projeto_id`, e também o `papel`.
- **Intimação colada no WhatsApp:**
  - o agente mostra o vencimento, o prazo interno e o aviso, e pede o "sim";
  - ele pergunta "vara comum ou juizado?" no cível sem pista;
  - ele avisa quando o prazo parece repetido;
  - ele não cria nada se o processo não existir na conta.
- **Novos pedidos que o agente atende:** "quais prazos tenho esta semana?", "tenho audiência amanhã?" e "cadastra o processo X do cliente Y".
- **Ícones:** `criar_projeto` usa a balança para processo e a maleta para caso consultivo, como a tela.
- **Combinação inválida de tipo e modelo:** um caso consultivo com modelo de processo, ou o contrário, continua sendo recusado, como na etapa 2.
- **Resumos das 8h e de segunda:** passam a ser de prazos e audiências. Isso vale depois de copiar o `SOUL.md` novo para a VPS. O próprio agente refaz os crons antigos na conversa seguinte.

## Banco

Sem mudanças: nenhuma migração, tabela, coluna, política de RLS ou grant.

## Testes

- **Antes:** 235 testes em 17 arquivos (a `main` depois da etapa 3).
- **Depois:** 269 testes em 18 arquivos.
- **Novos:**
  - `src/services/agente/ferramentas-juridicas.test.ts` (28 testes):
    - catálogo e escopo de leitura;
    - prévia sem gravar e confirmação negada (sem `confirmado=true`, e com `confirmado=true` sem o prazo da prévia);
    - criação com 3 lembretes automáticos e desfazer;
    - recálculo diferente devolve uma prévia nova;
    - prazo que atravessa o recesso: TRT4, DJe em 15/12/2026, 8 dias úteis, vence em 28/01/2027;
    - aviso de repetido;
    - processo não cadastrado;
    - número CNJ válido que não existe na conta, e número com dígito errado;
    - busca pelo número com e sem pontuação, e caso consultivo recusado;
    - regra pela área: "Vara Cível" pergunta, sem área pergunta, regra informada calcula, Juizado e trabalhista;
    - exceção penal fora do penal e prazo em dobro;
    - segredo de justiça (as respostas não trazem parte, cliente nem texto, e a descrição guarda o texto);
    - `criar_processo` com cliente novo, cliente existente, número repetido sem cadastrar o cliente, e órgão que vale na intimação seguinte;
    - `prazos_proximos` com os atrasados primeiro, processo pausado com status, sem os arquivados, janela de dias e token de leitura;
    - `audiencias_proximas` com horário, local e janela;
    - mensagens de "nenhum" e processo sem detalhes.
  - `src/domain/prazos.test.ts` (4 testes): `regraSeguraDoProcesso`.
  - `src/services/agente/ferramentas.test.ts` (2 testes): contagem por tipo em `listar_projetos`, tipos novos e antigos, título e papel da coluna.
- **Ajustados:**
  - catálogo com 19 ferramentas e 7 de leitura, e confirmação com `registrar_intimacao`, em `ferramentas.test.ts` e `mcp/route.test.ts`;
  - mensagens "Criei o processo" e "Criei o caso consultivo";
  - "2 em Aguardando decisão".
- **Banco local** (`npm run test:banco-local`, Supabase local, nada em produção): de 39 para 48 testes.
  - Os 9 novos de `agente-banco-local.test.ts` usam o repositório do agente, como no servidor MCP:
    - processo, detalhes e cliente gravados com o `user_id` certo;
    - prazo com os 3 lembretes e o histórico com origem `agente`;
    - aviso de repetido;
    - o número de A não existe para o agente de B;
    - recesso no TRT4 com a carga do banco;
    - leitura com token de leitura e o registro de cada conta.
  - Passou depois de `db reset` (as 5 migrações do zero) e numa segunda rodada sem reset.
- **Resultado do `npm run verificar`:** passou (typecheck, 269 testes e build).

## Como conferir à mão

**Na VPS, numa instância de teste:**

1. Publique o código desta branch (o servidor MCP precisa das ferramentas novas).
2. Copie `agente/nanobot/SOUL.md` e `USER.md`, preenchido, para o workspace e reinicie o serviço.
3. Mande o texto de uma intimação de um processo cadastrado com número.
   - O agente mostra o vencimento, o prazo interno e o aviso, e pede "sim".
   - Responda "não": nada aparece no app.
   - Mande de novo e responda "sim": o prazo aparece em **Prazos**, com a memória, e os lembretes D-3, D-1 e no dia aparecem na tarefa.
4. Mande a mesma intimação de novo. Ele avisa que parece repetida.
5. Mande uma intimação de um processo cível em "Vara Cível". Ele pergunta "vara comum ou juizado?".
6. Mande uma intimação com um número que não está na conta. Ele diz que não encontrou e não cria nada.
7. Peça "cadastra o processo Teste, número …, cliente Fulano, juizado especial cível". O processo aparece com a balança, e o cliente em **Clientes**.
8. Peça "quais prazos tenho esta semana?" e "tenho audiência esta semana?".
9. Marque um processo como segredo de justiça no app. Peça os prazos: ele aparece só com nome e número.
10. No dia seguinte às 8h, confira o resumo do dia, com prazos e audiências.

**Piloto com mais de um advogado:** siga "Piloto: uma instância por advogado" no `agente/README.md`, inclusive as conferências de isolamento (`/proc/<pid>/root/home`, `Permissão negada` entre casas, dados separados e número certo).

**Banco local:** `npx supabase start`, `npx supabase db reset`, `npm run test:banco-local` e `npx supabase stop`.

## Fora do escopo e pendências

- **Ferramentas:**
  - `documentos_pendentes` (dá para usar `documentosPendentes`, de `domain/quadro.ts`);
  - `andamento_para_cliente` (etapa 6);
  - `consultar_processo` com DataJud (etapa 5).
- **Um agente que atende vários números:** fora do piloto.
- **Validação com advogados:** os 10 casos de `docs/validacao-prazos.md` continuam pendentes. O aviso aparece também no agente, pela mesma constante.
- **Não confirmado na documentação do nanobot:** o caminho padrão da sessão do WhatsApp quando `channels.whatsapp.databasePath` não está definido. Com um usuário Linux por instância, cada sessão fica na própria casa de qualquer forma.

## Riscos e dúvidas para a próxima etapa

**Riscos**
- **Ordem de publicação.** O `SOUL.md` novo cita ferramentas que só existem neste código. Publique o app antes de copiar o `SOUL.md` para a VPS. O `SOUL.md` antigo continua funcionando com o código novo.
- **Campos renomeados nas respostas** (`projeto` para `processo` nas tarefas, `tipo: "projeto"` para `"processo"`). Quem lê o JSON é o LLM, que se adapta. Um script externo que lesse esses campos quebraria; não conheço nenhum.
- **Segredo de justiça depende do título.** As ferramentas não devolvem parte nem texto, mas o título da tarefa é escolhido pelo LLM e pode trazer o nome de uma parte. O `SOUL.md` pede para não citar, mas isso não é garantido pelo código.
- **O isolamento do serviço modelo não foi testado numa VPS real.** `systemd-analyze verify` só conferiu a sintaxe (`ProtectHome=tmpfs`, `BindReadOnlyPaths` e `ReadWritePaths`). O README traz as conferências para fazer depois de instalar.
- **Cada instância precisa de um número de WhatsApp próprio para o agente.** São 2 ou 3 chips para o piloto.
- **Prazo criado pelo agente fica com prioridade média,** igual ao criado pela tela.

**Dúvidas que você respondeu depois da etapa**
1. "Vara" não conta como pista. O campo "rito" fica como primeiro item depois do piloto.
2. `documentos_pendentes` fica para depois do piloto.
3. Documentos pendentes não entram no resumo das 8h.
4. Uma chave de LLM para todas as instâncias, com provedor de não retenção de dados.

**Ambientes desta máquina, ajustados antes do push**
- **`.env.local`:** aponta para o Supabase local, com um `MCP_SEGREDO_TOKENS` só deste ambiente. Com o carregador do próprio Next, `next dev` e `next build` leem só o `.env.local`, e as duas URLs são `127.0.0.1`.
- **`.env.producao`:** é o antigo `.env`, movido com o conteúdo intacto (permissão 600 e no `.gitignore`).
- **Scripts:**
  - `db:migrar`, `db:reparar` e `db:tipos` rodam no Supabase local por padrão;
  - com `-- --producao`, leem só o `.env.producao` e mostram "Alvo: PRODUÇÃO (...)" antes de rodar;
  - `db:vincular` sem `--producao` é recusado.
- **Conferido:**
  - `db:migrar` local: nada pendente;
  - `db:tipos` local gerou um `tipos-banco.ts` idêntico ao gerado de produção;
  - `db:migrar -- --producao --dry-run`: banco de produção em dia, sem gravar nada.

**Dúvidas para depois do piloto**
1. O campo "rito": preencher pelo agente na primeira intimação de cada processo (perguntando uma vez) ou só no formulário?
2. A carga anual de feriados de 2028 entra numa migração antes do fim de 2027, ou junto com a revisão dos casos de validação?

## Commits

| Hash | Mensagem |
|---|---|
| `4e68e47` | Adiciona a regra de contagem segura do processo para o agente |
| `88a1be7` | Passa as respostas do agente para o vocabulário jurídico |
| `2ddfd41` | Adiciona registrar_intimacao, criar_processo, prazos_proximos e audiencias_proximas |
| `7f8e64f` | Atualiza as instruções do servidor MCP e os rótulos da atividade do agente |
| `1b30b91` | Ajusta o agente para o piloto jurídico: SOUL.md, perfil e uma instância por advogado |
| `0d33b10` | Atualiza ARQUITETURA, proposta e README para a etapa 4 |
| `c329e21` | Testa as ferramentas jurídicas do agente no Supabase local |
| `1999504` | Adiciona o relatório da etapa 4 |
| `c89fd45` | Separa o ambiente local da produção nos arquivos de ambiente e nos scripts do banco |

O commit que registra as respostas e o provedor de LLM entra depois dos listados acima.
