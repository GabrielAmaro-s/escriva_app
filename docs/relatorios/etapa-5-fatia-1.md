# Etapa 5, fatia 1: consulta ao DJEN e sugestões de registro

Branch `juridico/etapa-5-captura`, criada da `main` em `d88c74d`. Segue o desenho de `docs/relatorios/etapa-5.md`.

> **Banco não executado.** A migração `0006_captura_djen.sql` e o teste `supabase/testes/djen-banco-local.test.ts` foram escritos, mas não rodaram em banco nenhum: nem no Supabase local (não há Docker nesta máquina) nem em produção. Os dois dizem isso no cabeçalho. **A branch não deve ser mergeada antes de o teste de banco passar no Supabase local** (lista na seção 6).

## 1. Resumo

O Tempestivo ganha o código da captura de comunicações do DJEN, com três partes:

- a configuração por advogado, desligada por padrão;
- o cliente da API pública, que roda só na VPS e respeita os limites de uso;
- o recebimento das comunicações no app, onde cada uma vira uma sugestão pendente, sem duplicar.

A extração dos dias é conservadora: na dúvida, a sugestão fica com "dias não identificados". Nada é enviado ao advogado, o agente do WhatsApp não mudou e nada foi aplicado no banco, na VPS ou na Vercel.

## 2. O que mudou

**domain**
- `src/domain/djen.ts`, com regras puras e sem importações:
  - janela da consulta;
  - plano do dia (até 3 tentativas, com 4 horas de intervalo);
  - validação da OAB;
  - HTML do teor para texto, sem o cabeçalho de partes e advogados;
  - sigilo;
  - `extrairDiasDoPrazo`;
  - `montarSugestao`, que separa o que é guardado.

**data**
- `src/data/repositorio-djen.ts`: contrato da captura. Fica separado do `Repositorio` porque só existe com Supabase.
- `src/data/supabase/repositorio-djen.ts`: tabelas da 0006, com inserção `on conflict (user_id, djen_id) do nothing`.
- `src/data/supabase/contexto-agente.ts`: `criarRepositorioDjenDoAgente(userId)`, com o mesmo cliente admin de `user_id` forçado.
- `src/data/djen/cliente-djen.ts`:
  - faz uma requisição por vez ao `GET /comunicacao`;
  - classifica a resposta em ok, 429, 5xx, rede, outro erro ou formato inesperado;
  - confere a OAB entre os destinatários e descarta as partes e os advogados.
- `src/data/djen/cliente-tempestivo.ts`: a VPS chamando o app com o token da instância.
- `src/data/djen/repositorio-djen-memoria.ts`: para os testes.
- `src/data/djen/exemplos/pagina-1.json`: resposta de exemplo fictícia nos três formatos de teor que o DJEN usa.

**services**
- `src/services/consulta-djen.ts`, a consulta como roda na VPS:
  - pelo menos 5 s entre requisições;
  - páginas de 100;
  - espera de 60 s com o limite quase no fim;
  - com 429, espera 60 s e tenta mais uma vez; outro 429 encerra como "limite";
  - novas tentativas depois de 30 s, 1, 2 e 4 min para erro 500 e de rede;
  - envio ao app em lotes de 20.
- `src/services/captura-djen.ts`, o lado do app:
  - `ligarCaptura` e `desligarCaptura`;
  - `iniciarConsulta`, `receberComunicacoes` e `concluirConsulta`;
  - `resumoDoTeor` (SHA-256 do corpo normalizado).

**API**
- `src/app/api/djen/rota-com-token.ts`: autenticação pelo token do agente, igual à do MCP. Leitura recebe 403.
- `POST /api/djen/consulta/iniciar`, `POST /api/djen/comunicacoes` e `POST /api/djen/consulta/concluir`.
- `src/app/api/esquemas.ts`: esquemas das duas entradas.

**VPS**
- `scripts/captura-djen.ts`: roda direto pelo Node 22.18 ou mais novo, sem `npm install` e sem build.
- `agente/systemd/tempestivo-djen@.service` e `.timer` (7h, 12h e 17h, com `flock`), e `agente/systemd/tempestivo-djen.conf` (tmpfiles da trava). Nada foi instalado.

**banco**
- `supabase/migrations/0006_captura_djen.sql` e `supabase/testes/djen-banco-local.test.ts`, os dois **não executados**.

**configuração**
- `tsconfig.json`: `allowImportingTsExtensions`.

**docs**
- `agente/README.md`: seção "Captura do DJEN (ainda não instalar)", com o requisito do Node 22.18 ou mais novo.
- `docs/ARQUITETURA.md`: rotas, camadas, tabelas, testes e etapas.
- Este relatório.

**Sem mudanças:** hooks, interface, agente e MCP (nenhuma ferramenta nova, `SOUL.md` e `HEARTBEAT.md` intactos).

## 3. Decisões tomadas

| Decisão | Motivo | Alternativas descartadas |
|---|---|---|
| Tabela própria `captura_djen` (aprovada) | O estado da consulta é do sistema, não do advogado. Grants por coluna deixam o advogado mudar só ligada, OAB, UF e aceite. `Preferencias` e `/api/preferencias` ficam como estavam. | Colunas em `preferencias`, como dizia o relatório da investigação. |
| Campos guardados (aprovada) | Os do relatório de LGPD. Além de processo, data, classe, link e trecho, entram `hash` (certidão), tribunal (calendário), órgão (pista de "Juizado") e os tipos de comunicação e de documento (título sugerido). | Só a lista curta, que tiraria a pista de Juizado e o calendário. |
| Retenção de 30 dias e de 1 ano (aprovada) | Pendentes, descartadas, canceladas e sigilosas saem 30 dias depois da disponibilização. As registradas ficam 1 ano, só para não duplicar. A janela de consulta nunca volta mais de 30 dias, então o que foi apagado não volta como novo. | Guardar tudo; janela sem limite. |
| "É você?" na fatia 2 (aprovada) | Depende de mandar mensagem ao advogado, o que esta fatia não faz. **É requisito obrigatório da fatia 2** (seção 8). | Fazer agora, sem canal para a pergunta. |
| Até 3 tentativas por dia: 7h, e 12h e 17h só se a anterior falhou (pedida na revisão do plano) | Com uma tentativa só, um DJEN instável às 7h atrasaria o aviso em um dia inteiro. As tentativas extras respeitam os mesmos limites de requisição e ficam 4 horas uma da outra. A tentativa é registrada ao começar (`em_andamento`), então uma queda no meio também conta. | Uma tentativa por dia, como estava no plano. Repetir de hora em hora. |
| O app decide se consulta; a VPS só pergunta, busca e repassa | Regra num lugar só (`domain/djen.ts`), com testes. O timer dispara 3 vezes, mas sem motivo o script termina sem chamar o DJEN. | Guardar a data da última consulta em disco na VPS (o relatório da investigação). |
| Rotas `POST /consulta/iniciar` e `/consulta/concluir`, no lugar de `GET /captura` | Iniciar registra a tentativa, então não pode ser GET. | GET que grava. |
| Timers às 7h, 12h e 17h para todos, enfileirados pelo `flock` | A trava já forma a fila única, então não é preciso escalonar o horário de cada instância. | Horários escalonados por instância (7h00, 7h05...), que exigiriam um arquivo por instância. |
| Trava em `/run/lock`, criada por root via tmpfiles | Com `fs.protected_regular`, um usuário não abre com O_CREAT um arquivo de outro usuário num diretório com sticky bit. Criado por root, o arquivo pode ser aberto por todos os `nanobot-*`. | Deixar o primeiro usuário criar a trava. |
| Script em TypeScript rodado pelo Node 22.18 ou mais novo, sem build | O cliente fica em `data/` e `services/`, como foi pedido, com os mesmos testes, e a VPS não precisa de `npm install` (a e2-micro tem pouca memória). Os arquivos carregados pela VPS só usam importações relativas com `.ts`. | Script em Python (duas fontes de regra). Bundler ou `tsx` na VPS. |
| `allowImportingTsExtensions` no tsconfig | Necessário para as importações com `.ts`. Conferido: `npm run verificar` passou, com o build do Next. | Mudar o `"type"` do `package.json` para `module`, que afetaria as outras configurações. |
| `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` no serviço | O Node avisa que o tipo do módulo não está declarado. O aviso não muda o funcionamento. | Mudar o `package.json`. |
| Extração conservadora dos dias | Só é "identificados" quando há **exatamente uma** menção a N dias no corpo, todas estas condições valem e não aparece nenhum sinal de cuidado. Qualquer ambiguidade vira `nao_identificados`. | Aceitar o mesmo número repetido. Aceitar "Prazo: 05 dias" (no eproc, esse formato também aparece na lista de eventos, com prazo de outra pessoa). Usar o LLM. |
| Teor com mais de 60 mil caracteres vai cortado e marcado | Num texto cortado, um segundo prazo pode ter ficado de fora. A sugestão vira `nao_identificados`. | Mandar inteiro (limite de corpo da Vercel). Extrair do texto cortado. |
| Consulta real de leitura só no scratchpad | Para acertar a estrutura dos três formatos de teor. Uma consulta, filtrada por tribunal e data, sem nenhum dado meu. Nada dela foi para o repositório. Os exemplos usam OAB 9999991 a 9999992, processos do ano 2099 e ids a partir de 990000001. | Inventar o formato sem conferir. |

Condições da extração segura:
- o número vem logo depois de "prazo de", "no prazo de", "em" ou "dentro de";
- os algarismos e o número por extenso batem, quando os dois aparecem;
- a frase fala com a parte ("intim", "parte", "autor", "réu", "exequente"...);
- a frase não fala de terceiro (perito, oficial, cartório, contadoria, Ministério Público...);
- o prazo não é passado nem só narrado ("decorrido", "encerrado"...).

Sinais de cuidado: "em dobro", "sucessivo", "prazo legal" ou "recursal" sem número, prazo em horas ou em meses.

## 4. Mudanças de comportamento

Nenhuma visível. O advogado não vê tela nova e não recebe mensagem, e o agente responde como antes. Também não há forma de ligar a captura pelo app nem pelo WhatsApp: `ligarCaptura` existe só no serviço e nos testes.

As três rotas novas existem no código, mas sem a 0006 aplicada respondem com erro de banco. Elas recusam pedidos sem token de escrita.

## 5. Banco

Migração `supabase/migrations/0006_captura_djen.sql`. **Não executada** em banco nenhum.

- **`captura_djen`**, uma linha por advogado:
  - colunas: `ligada` (padrão `false`), `numero_oab` (sem zeros à esquerda), `uf_oab`, `aviso_aceito_em`, `ultima_consulta_ok`, `ultima_tentativa_em`, `tentativas_no_dia`, `ultimo_resultado` (`ok`, `falhou`, `limite` ou `em_andamento`) e `atualizado_em`;
  - check: ligada exige OAB, UF e aceite;
  - gatilho `captura_djen_trocar_oab`: trocar a OAB ou a UF zera `ultima_consulta_ok`.
- **`comunicacoes_djen`**:
  - colunas: `djen_id`, `hash`, `numero_processo`, `data_disponibilizacao`, `sigiloso`, `tribunal`, `orgao`, `classe`, `tipo_comunicacao`, `tipo_documento`, `link`, `trecho` (600), `dias_situacao`, `dias`, `unidade_dias`, `trecho_dias` (200), `resumo_teor`, `status` (`pendente`, `registrada`, `descartada` ou `cancelada`) e `cancelada_no_djen_em`;
  - único `(user_id, djen_id)`;
  - check: sigiloso guarda só id, número e data;
  - check: os dias são coerentes com `dias_situacao` e com o trecho;
  - índices por `(user_id, status, data_disponibilizacao)` e por data.
- **Retenção:**
  - `limpar_comunicacoes_djen(hoje)`, `security definer`, executável só pelo `service_role`;
  - `pg_cron` todo dia às 9h30 UTC (6h30 em Brasília).
- **RLS:** o dono lê, altera e exclui. Em `captura_djen`, também insere.
- **Grants:**
  - `revoke all` de `anon` e `authenticated`;
  - `authenticated`: select em `captura_djen`, e insert e update só em `ligada`, `numero_oab`, `uf_oab` e `aviso_aceito_em`;
  - `authenticated`: select e delete em `comunicacoes_djen`, e update só em `status`;
  - `service_role`: tudo.
- **Diferenças em relação ao SQL do plano:**
  - `tentativas_no_dia` e o valor `em_andamento`, pelas tentativas extras;
  - o gatilho da troca de OAB;
  - `numero_oab` sem zero à esquerda;
  - o check dos dias mais estrito (trecho se e só se houver dias; unidade só com dias).
- **Tipos:** `src/data/supabase/tipos-banco.ts` não foi regenerado. Depois de aplicar a 0006, é preciso rodar `npm run db:tipos`.

## 6. Testes

**Unitários:** de 331 testes em 21 arquivos para **427 em 27 arquivos** (+96).

| Arquivo | Testes | Cobre |
|---|---|---|
| `src/domain/djen.test.ts` | 47 | ver abaixo |
| `src/data/djen/cliente-djen.test.ts` | 7 | parâmetros e User-Agent; 429, 5xx, 4xx, rede e corpo que não é JSON; formato inesperado; OAB com zeros e com outra UF; descarte de partes e advogados; teor cortado |
| `src/services/consulta-djen.test.ts` | 11 | política com relógio falso; o log sem teor, nome, OAB ou número de processo |
| `src/services/captura-djen.test.ts` | 14 | ver abaixo |
| `src/app/api/djen/rotas-djen.test.ts` | 4 | 401, 403 com token de leitura, captura desligada, corpo inválido e lote grande; o fluxo da VPS gravando só nos dados do dono do token |
| `src/data/supabase/contexto-agente.test.ts` | +10 | cada método do repositório da captura sai com o `user_id` forçado, com controle sem o embrulho; o upsert com `ignoreDuplicates` |
| `src/services/script-captura-djen.test.ts` | 3 | o script roda no Node, sem bundler, contra um app falso em 127.0.0.1, sem chamar o DJEN |

**`domain/djen.test.ts`:**
- janela e plano do dia (7h, 12h, 17h, intervalo de 4 horas e virada do dia);
- OAB;
- teor nos três formatos, entidades e sigilo;
- 7 casos seguros de extração e 16 que viram `nao_identificados`;
- números por extenso;
- `recortar`;
- o que é guardado: sem nomes, sigiloso só com id, número e data, e link que não é https recusado.

**`services/consulta-djen.test.ts`:**
- 5 s entre requisições e lotes de 20;
- espera de 60 s com o limite quase no fim;
- 429 uma vez; segundo 429 encerra como "limite";
- erro 500 com 30 s, 1 e 2 min; falhou depois de 4 novas tentativas;
- formato inesperado;
- falha na segunda página.

**`services/captura-djen.test.ts`:**
- ligar exige OAB válida e aceite;
- trocar a OAB apaga as pendentes;
- desligar apaga só as pendentes;
- tentativas do dia e queda no meio;
- conferência da janela;
- sem duplicidade;
- cancelada, sigiloso e resumo do teor;
- ponta a ponta com a página de exemplo.

**`npm run verificar`:** passou (typecheck, 27 arquivos com 427 testes e build do Next com `allowImportingTsExtensions`, já listando as três rotas novas).

**Testes de banco que ainda precisam rodar** (`supabase/testes/djen-banco-local.test.ts`, com `npx supabase start`, `npx supabase db reset` e `npm run test:banco-local`):

1. A 0006 aplica do zero, depois da 0001 à 0005, inclusive `create extension pg_cron` e `cron.schedule`.
2. `captura_djen` começa sem linha e liga pela sessão do app, com o `user_id` do dono (upsert com grants por coluna).
3. Ligada sem OAB, OAB com zero à esquerda e UF inexistente são recusadas (23514).
4. Pela sessão, o advogado não grava `ultima_consulta_ok`, `tentativas_no_dia` nem `ultimo_resultado` (42501).
5. O servidor grava o estado. Trocar a OAB zera a última consulta boa pelo gatilho; com a mesma OAB, ela fica.
6. **Isolamento:** B não lê nem altera a captura de A, e o repositório do agente de B não enxerga a de A.
7. O fluxo da VPS pelo servidor grava 4 sugestões e, repetido, nenhuma; a consulta "ok" avança a data.
8. O mesmo `djen_id` em outra conta é outra sugestão.
9. **Isolamento:** B não lê, não altera e não apaga as sugestões de A, nem pelo repositório do agente.
10. Pela sessão, o advogado não insere sugestão nem muda o trecho (42501), mas muda o status. Status inválido é recusado (23514).
11. Os checks:
    - sigiloso só com id, número e data;
    - dias coerentes com a situação e o trecho;
    - número com 20 dígitos;
    - trecho de até 600 caracteres;
    - `djen_id` positivo;
    - par `(user_id, djen_id)` repetido (23505).
12. Cancelada pelo tribunal: a pendente vira cancelada; a registrada só ganha a marca.
13. Desligar apaga só as pendentes da própria conta.
14. `limpar_comunicacoes_djen` recusada para `authenticated` e `anon`; com o servidor, os limites de 30 e de 365 dias.
15. `anon` não lê nem grava as duas tabelas.

Conferências à mão no banco local, porque o teste não alcança o esquema `cron`:
- `select jobname, schedule, command from cron.job where jobname = 'limpar-comunicacoes-djen';`
- `\dp captura_djen` e `\dp comunicacoes_djen`, para conferir os grants por coluna.

## 7. Como conferir à mão

Sem banco aplicado, a conferência é pelos testes e pelo script:

1. `npm run verificar`.
2. `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/captura-djen.ts`. Sem token, sai com código 2 e uma mensagem clara.
3. `npx vitest run src/domain/djen.test.ts`. Para testar um texto novo, acrescente o caso à tabela de casos seguros ou de casos não identificados.
4. Depois do Docker:
   - `npx supabase start`, `npx supabase db reset` e `npm run test:banco-local`;
   - as conferências do `cron.job` e dos grants (seção 6);
   - `npm run db:tipos`.
5. Na VPS, só a partir da fatia 2: os passos de `agente/README.md`, "Captura do DJEN".

Na navegação e no agente, nada muda nesta fatia.

## 8. Fora do escopo e pendências

**Antes do merge desta branch:**
- rodar e passar os 15 testes de banco da seção 6 no Supabase local;
- as conferências do `cron.job` e dos grants;
- `npm run db:tipos`.

**Produção:** só com aprovação explícita, e com backup antes:
1. `npx supabase db dump` com o `DIRECT_URL` do `.env.producao`, para esquema e dados, num arquivo fora do git;
2. `npm run db:migrar -- --producao`.

**Fatia 2 (ativação e avisos):**
- **conferência do nome ("É você?"), requisito obrigatório.** Uma OAB digitada errada traria as intimações de outro advogado para esta conta. O filtro que confere se a OAB consultada está entre os destinatários reduz o risco, mas não o elimina: ele só prova que a comunicação é daquela OAB, não que a OAB é de quem a digitou. Sem o segundo *sim*, nada é guardado e a captura não liga;
- **avisar o advogado quando a captura falhar dois dias seguidos.** O dado já existe: a data da última consulta boa ficou mais de um dia para trás, mesmo com tentativas;
- ligar e desligar pelo WhatsApp e em Configurações > Agente, com o aviso de cobertura;
- `comunicacoes_djen_pendentes` e `descartar_comunicacao_djen` no MCP;
- o resumo das 8h com as sugestões e com o aviso de falha;
- a prévia pelo `registrar_intimacao`, com `comunicacao_djen_id`, e o trecho apagado da sugestão quando ela vira tarefa;
- a marca de "sigiloso já avisado";
- a conferência de republicação pelo `resumo_teor`.

**Depois:**
- instalar o Node 24 LTS, o serviço, o timer e o tmpfiles na VPS;
- a consulta formal ao CNJ antes de ampliar além do piloto;
- casos reais anonimizados do TJRS, do TRT4 e do TRF4 nos testes da extração, com revisão por advogado.

## 9. Riscos e dúvidas para a próxima etapa

- **OAB errada:** é o maior risco desta fatia, e por isso a conferência do nome não pode ficar para depois da fatia 2 (seção 8).
- **Extração dos dias:**
  - as regras foram ajustadas com uma amostra pequena e com exemplos fictícios;
  - por ser conservadora, muitas comunicações vão chegar como "dias não identificados" (no TJRS, o formato "Prazo: 05 dias" dos atos ordinatórios não é aceito);
  - isso gera atrito, mas não gera prazo errado;
  - medir no piloto quantas ficam sem dias antes de afrouxar qualquer regra.
- **Formato do teor:** a amostra mostrou três formatos de HTML. A remoção do cabeçalho depende deles (tabela com "ADVOGADO" ou "OAB", título com "Nº"). Uma mudança no formato pode deixar nomes no trecho guardado. O teste com a página de exemplo pega a regressão, mas só para os formatos conhecidos.
- **A VPS sem teste real:**
  - a trava com `ProtectSystem=strict` e `fs.protected_regular`;
  - o `OnCalendar` com fuso;
  - o Node da NodeSource com `--disable-warning`.

  Conferir os três na primeira instalação.
- **Um IP para todos:** um bloqueio do CNJ derruba a captura de todos os advogados da VPS de uma vez. As tentativas extras não podem virar insistência: no máximo 3 por dia, com 4 horas de intervalo.
- **pg_cron:** se a extensão não subir no local ou em produção, a limpeza precisa de outro gatilho, e a retenção não pode ficar sem execução.
- **Janela de 30 dias:** se a captura ficar fora do ar mais de 28 dias, comunicações mais antigas que 30 dias não são buscadas. É o preço de não ressuscitar sugestões apagadas, e o aviso de falha da fatia 2 precisa cobrir esse caso.

## 10. Commits

| Hash | Mensagem |
|---|---|
| `ed6859b` | Adiciona as regras da captura do DJEN em domain |
| `1b72f13` | Adiciona o cliente da API pública do DJEN e o cliente do app para a VPS |
| `5fc98ef` | Adiciona a consulta diária ao DJEN que roda na VPS |
| `8c242ad` | Adiciona as sugestões do DJEN e as rotas que a VPS chama |
| `0891a79` | Escreve a migração 0006 e o teste de banco da captura (não executados) |
| `c5b83ae` | Documenta a captura do DJEN na VPS e na arquitetura |
| (este commit) | Adiciona o relatório da etapa 5, fatia 1 |
