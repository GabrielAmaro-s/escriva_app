# Etapa 3: motor de prazos

Branch `juridico/etapa-3`. Referência: seção 10, item 3, de `docs/PROPOSTA_JURIDICA.md`.

## Resumo

O advogado passa a registrar prazos com cálculo automático do vencimento, em dias úteis ou corridos, considerando feriados nacionais, feriados do tribunal, feriados locais, o recesso de fim de ano e dias de sistema fora do ar. Cada cálculo mostra a memória e um aviso de que a contagem está em validação. A tarefa ganha tipo (prazo, providência, audiência), prazo fatal separado do prazo interno, lembretes automáticos D-3, D-1 e no dia, histórico das mudanças de prazo e itens de checklist marcados como documento do cliente. A migração 0005 foi testada só no Supabase local e **não foi aplicada em produção**.

## O que mudou

**domain**
- `src/domain/prazos.ts` (novo), com o princípio "na dúvida, o prazo vence antes" no topo:
  - feriados nacionais fixos e móveis (Páscoa pelo algoritmo de Meeus, Carnaval, Sexta-feira Santa, Corpus Christi);
  - `tribunalDoProcesso`, que tira a sigla do número CNJ (TJ de cada UF, TRT e TRF) ou, sem número, do campo tribunal;
  - `criarCalendario`, que junta os nacionais, a carga do tribunal e os feriados locais, com feriado, suspensão e expediente reduzido;
  - `inicioDaContagem` (DJe, portal e pessoal), `calcularPrazo` (dias úteis e corridos) e `calcularPrazoDaIntimacao`, com a memória do cálculo;
  - quatro regras: cível, trabalhista, juizado e penal, com recesso, dobro e a exceção do art. 798-A;
  - `prazoInterno`, `datasDosLembretes`, `lembretesDesejados`, `montarContagem`, `alteracaoDePrazo` e `ajustarAlteracaoAoTipo`;
  - `AVISO_CONTAGEM_EM_VALIDACAO`, a constante única do aviso. Trocar por `null` tira o aviso de todas as telas.
- `src/domain/tipos.ts`:
  - `Tarefa` ganhou `tipo`, `prazoFatal`, `contagem`, `localAudiencia` e `horarioAudiencia`;
  - `ItemChecklist` ganhou `doCliente`, e `Lembrete` ganhou `automatico`;
  - tipos novos: `Feriado`, `AlteracaoRegistrada`, `Preferencias` e `ContagemPrazo`.
- `src/domain/quadro.ts`: `documentosPendentes`.

**services**
- `src/services/prazos.ts` (novo):
  - `calcularPrazoDaTarefa`, pelo tribunal do processo e pela margem das Configurações;
  - `alterarTarefa`: limpa os campos do tipo anterior na mesma gravação e acerta os lembretes;
  - `sincronizarLembretesAutomaticos`;
  - feriados locais e preferências.
- `src/services/lembretes.ts`: `lembretesProximos` cancela, em vez de devolver, o lembrete automático de uma tarefa já concluída.
- `src/services/desfazer.ts`: recriar ou restaurar uma tarefa traz o tipo e o prazo fatal e, com o fuso, recupera os lembretes automáticos.
- `src/services/importacao.ts`: exporta e importa os campos novos e os feriados locais. Arquivos antigos continuam válidos.

**data**
- `src/data/repositorio.ts`: métodos `listarFeriados`, `criarFeriado`, `excluirFeriado`, `listarAlteracoesDaTarefa`, `obterPreferencias` e `salvarPreferencias`.
- `src/data/supabase/repositorio-supabase.ts` e `conversores.ts`: os campos e os métodos novos.
- `src/data/supabase/erros.ts`:
  - feriado repetido vira 409;
  - os checks de `tasks` viram `ErroDeValidacao` com mensagem clara.
- `src/data/supabase/contexto-agente.ts`:
  - no agente, a leitura de feriados inclui a carga geral (`user_id` nulo);
  - o `userId` precisa ser um uuid, porque entra num filtro em texto.
- `src/data/local/repositorio-local.ts`: o modo local reproduz o banco:
  - a carga dos tribunais;
  - o histórico, como faria o gatilho;
  - os checks de `tasks`;
  - um único automático ativo de cada tipo por tarefa;
  - as tarefas salvas antes desta etapa, lidas como providência.
- `src/data/local/feriados-tribunais.ts` (novo): a mesma carga da 0005. Um teste compara as duas linha a linha.
- `src/data/local/exemplo.ts`: "Rol de testemunhas" vira um prazo do TRT4 com memória, e "Juntar holerites e CTPS" ganha documentos do cliente.
- `src/data/http/repositorio-http.ts`: as rotas novas.

**hooks**
- `src/hooks/use-prazos.ts` (novo): feriados, margem padrão e histórico.
- `src/hooks/use-tarefas.ts`:
  - grava pelo service `alterarTarefa`;
  - recarrega os lembretes quando a alteração mexe neles;
  - duplicar copia o tipo e os lembretes.
- `src/hooks/use-lembretes.tsx`: o lembrete da tarefa, que aparece no campo "Lembrete", passa a ser só o feito à mão.

**interface**
- `components/tasks/secao-prazo.tsx` (novo):
  - escolha do tipo;
  - prazo fatal e prazo interno editáveis;
  - calculadora com data da intimação, meio, dias, regra, margem, dobro e recesso (no penal, a exceção do art. 798-A);
  - prévia do vencimento e da memória com o aviso, antes de gravar;
  - audiência (data, hora e local);
  - histórico do prazo.
- `components/tasks/janela-tarefa.tsx`:
  - integra a seção nova;
  - cada item do checklist pode ser marcado como documento do cliente;
  - "Data de entrega" fica só para a providência.
- `components/board/cartao-tarefa.tsx` e `components/tasks/lista-tarefas.tsx`: selo "Fatal" e ícone de audiência.
- `components/tasks/tela-prazos.tsx`: filtro por tipo.
- `components/tasks/tela-hoje.tsx`: "Prazos fatais em 7 dias" e "Documentos pendentes do cliente", com cliente e processo.
- `components/settings/secao-prazos.tsx` (novo): margem padrão e feriados locais (feriado, suspensão ou expediente reduzido, para todos os tribunais ou um só).

**agente/MCP**
- As ferramentas, as descrições e as respostas não mudaram.
- Três ajustes para o agente não quebrar com os campos novos:
  - leitura de feriados no repositório do agente;
  - cancelamento em `lembretesProximos`;
  - campos novos no desfazer.

**API**
- Rotas novas: `/api/feriados`, `/api/feriados/[id]`, `/api/preferencias` e `/api/tarefas/[id]/alteracoes`.
- `esquemas.ts`:
  - tipo, prazo fatal, contagem e audiência nas tarefas;
  - `doCliente` no checklist;
  - `automatico` no lembrete.
- O desfazer do agente passa o fuso do servidor.

**banco**
- `supabase/migrations/0005_prazos_e_feriados.sql` (nova, não aplicada em produção). Detalhes em "Banco".

**docs**
- `docs/validacao-prazos.md` (novo): 10 casos para os advogados marcarem, mais as perguntas em aberto.
- `docs/PROPOSTA_JURIDICA.md`:
  - o princípio "na dúvida, o prazo vence antes";
  - a seção 5 com feriados em três camadas, o que substitui a tabela única de antes;
  - na seção 7, as regras implementadas;
  - na seção 12, as pendências de feriados.
- `docs/ARQUITETURA.md` e `README.md`: rotas, telas, modelo de dados, testes e a dependência da 0005.

## Decisões tomadas

| Decisão | Motivo | Alternativas descartadas |
|---|---|---|
| Documento pendente é o item de checklist com `doCliente`, no jsonb. Decisão sua. | Não precisa de migração e se marca na tela. | Tabela de documentos. |
| Margem de 2 dias úteis, ajustável em Configurações e editável em cada prazo. Decisão sua. | O padrão serve à maioria, e cada prazo pode ter a sua. | Margem fixa. |
| Feriados em três camadas (nacionais no domínio, carga por tribunal e locais na tabela), com RLS que lê os gerais e os próprios. Decisão sua. | Os nacionais não dependem de manutenção, e os locais ficam com quem os conhece. | Tabela única alimentada por admin, prevista antes. |
| `lembretes.automatico` e a tabela `preferencias`. Decisão sua. | Recriar os automáticos sem tocar nos feitos à mão, e margem igual em qualquer aparelho e para o agente da etapa 4. | Prefixo no texto do lembrete; margem no localStorage. |
| TJRS só com a Data Magna; Dia do Servidor de 2027 fora. Decisão sua. | Não inventar datas. | Carregar a lista provável. |
| Lembretes D-3, D-1 (dias úteis) e no dia, às 9h, contados do prazo fatal; na audiência, no dia, 2 h antes. Decisão sua. | O prazo fatal é o que não pode passar. | Contar do prazo interno; dias corridos. |
| Princípio "na dúvida, o prazo vence antes", no topo de `domain/prazos.ts` e na proposta. Decisão sua. | Um feriado a mais faz o advogado perder o prazo. | Carregar tudo que for provável. |
| Data Magna fora do TRF4. Decisão sua. | O TRF4 cobre SC e PR. O advogado do RS cadastra como feriado local. | Carregar para o TRF4. |
| Tipo `expediente_reduzido` (CPC, art. 224, § 1º), que também serve para sistema fora do ar. A Quarta-feira de Cinzas ficou fora da carga. Decisão sua. | Só com ato do tribunal; ela é o caso 2 da validação. | Tratar como feriado. |
| Recesso no penal (CPP, art. 798-A), com as exceções como opção marcada. Decisão sua, condicionada à conferência do texto. | O art. 798-A, incluído pela Lei 14.365/2022, suspende os prazos penais de 20/12 a 20/01, salvo réu preso, Lei Maria da Penha e medidas urgentes com despacho fundamentado. Conferido em [OAB](https://www.oab.org.br/noticia/59821/ferias-para-advocacia-criminal-agora-e-lei), [Conjur](https://www.conjur.com.br/?p=729363) e [Jus.com.br](https://jus.com.br/artigos/101420/recesso-forense-e-a-suspensao-de-prazos-processuais-criminais). Não li o texto no site do Planalto, que fica como conferência na validação. | Penal sem recesso. |
| Histórico só por gatilho `security definer`, com o app apenas lendo. Decisão sua. | Ninguém escreve histórico falso pelo app. | Gravar pelo service. |
| Concluir cancela os automáticos, e reabrir recria os que estão no futuro. Decisão sua. | Não lembrar de prazo já cumprido. | Deixar os lembretes. |
| Trocar o tipo limpa os campos do tipo anterior na mesma gravação. Decisão sua. | Os checks da 0005 nunca ficam violados no meio. | Duas gravações. |
| `revoke all` de `anon` e `authenticated` nas três tabelas novas, antes dos grants. **Mudança depois da aprovação do SQL**, descrita em "Banco". | O teste mostrou que o Supabase dá todos os privilégios por padrão às tabelas novas. Só o `grant select` não tirava o update do histórico (o RLS barrava, mas não era o combinado). | Confiar só no RLS. |
| O histórico é gravado com `origem = 'agente'` quando a gravação vem da chave de serviço. | O agente grava pelo cliente admin, sem mudar o código dele. | Passar a origem em cada chamada. |
| Juizado com a suspensão do recesso desligada por padrão, mas ligável. | Não achei regra expressa. Pelo princípio, fica a leitura que vence antes. | Ligada por padrão. |
| Publicação no DJe durante o recesso: a publicação não espera o fim da suspensão; só a contagem para. | É a leitura que vence antes. Está como pergunta na validação. | Publicação em 21/01. |
| Intimação pessoal usa a data informada como dia do começo. | O advogado sabe qual data conta (juntada do mandado ou do AR). A tela pede "Intimado em". | Calcular a juntada. |
| Prazo interno e lembretes recuam só sobre dias com expediente, sem pular o recesso. | Com recesso, o prazo interno de um vencimento em 22/01 iria para dezembro. | Recuar em dias úteis com suspensão. |
| A carga do modo local fica num arquivo TS, comparado ao SQL por teste. | O modo local não lê a migração. | Duplicar sem teste. |
| Lembrete automático de tarefa concluída pelo agente é cancelado em `lembretesProximos`, a consulta que o agente faz antes de enviar. | Cobre qualquer caminho de conclusão sem mudar as ferramentas do agente. | Mexer em `mover_tarefa` e `concluir_em_lote`. |
| O campo "Lembrete" da tarefa trata só do lembrete feito à mão. | Sem isso, ele remarcaria um D-3 automático. | Mostrar todos. |

## Mudanças de comportamento

- **Janela da tarefa:**
  - tem "Tipo";
  - num prazo, mostra prazo fatal e prazo interno, a calculadora com a memória e o aviso "Contagem em validação. Confira o vencimento antes de usar.", e o histórico do prazo;
  - num prazo, o vencimento só é gravado quando o advogado clica em "Usar este cálculo";
  - numa audiência, mostra data, hora e local;
  - "Data de entrega" só aparece na providência.
- **Checklist:** cada item pode ser marcado como documento do cliente, com o ícone de identidade e o selo "Cliente".
- **Cartões e listas:** selo vermelho "Fatal" e ícone de audiência.
- **Prazos:** filtro por tipo (Todos, Prazos, Audiências, Providências).
- **Hoje:** número "Prazos fatais em 7 dias" e a lista "Documentos pendentes do cliente".
- **Configurações:** seção "Prazos", com a margem e os feriados locais.
- **Lembretes:**
  - os prazos e as audiências ganham lembretes automáticos;
  - o sino dos cartões aparece também por causa deles;
  - o campo "Lembrete" da janela ignora os automáticos.
- **Trocar o tipo** apaga o prazo fatal, a contagem e os campos de audiência que não valem mais, e cancela os lembretes automáticos.
- **Agente:**
  - as ferramentas e as respostas são as mesmas;
  - tarefas criadas por ele são providências;
  - se ele mudar o prazo interno, a mudança entra no histórico como "pelo agente";
  - se ele concluir um prazo, os lembretes automáticos dele não são enviados;
  - desfazer uma ação dele traz de volta os lembretes automáticos.
- **Exportação:** leva os campos novos e os feriados locais.

## Banco

Migração `supabase/migrations/0005_prazos_e_feriados.sql`. Foi **testada no Supabase local e não foi aplicada em produção**.

- **`tasks`:**
  - colunas `tipo` (padrão `providencia`), `prazo_fatal`, `contagem jsonb`, `local_audiencia` e `horario_audiencia`;
  - checks: prazo fatal só no tipo prazo; local e horário só na audiência;
  - índices parciais `(user_id, prazo_fatal)` e `(user_id, horario_audiencia)`.
- **`feriados` (nova):**
  - campos `id`, `user_id` (nulo na carga geral), `tribunal`, `data`, `ate`, `tipo` (feriado, suspensão ou expediente reduzido), `descricao`, `fonte` e `criado_em`;
  - checks de período e de "geral só por tribunal";
  - índice único `(user_id, tribunal, data) nulls not distinct`;
  - carga de 27 linhas: TJRS 2 (só a Data Magna), TRT4 13 e TRF4 12, sem a Data Magna no TRF4.
- **`registro_alteracoes` (nova):**
  - sem chave estrangeira para `tasks`, então o histórico fica depois da exclusão;
  - gatilho `tasks_registrar_prazo`, com a função `registrar_alteracao_de_prazo()` (`security definer`, `set search_path = public`).
- **`lembretes`:**
  - coluna `automatico` (`d-3`, `d-1` ou `dia`);
  - índice único `(tarefa_id, automatico)` só entre os ativos.
- **`preferencias` (nova):** `user_id` (pk), `margem_prazo_interno` (0 a 30, padrão 2) e `atualizado_em` (gatilho `set_atualizado_em`).
- **RLS:**
  - feriados: lê `user_id is null or user_id = auth.uid()`, e cria, altera e exclui só os próprios;
  - histórico: o dono só lê;
  - preferências: só o dono.
- **Grants:**
  - `revoke all` de `anon` e `authenticated` nas três tabelas novas;
  - `select, insert, update, delete` em `feriados` e `preferencias` para `authenticated`;
  - `select` em `registro_alteracoes` para `authenticated`;
  - `all` para `service_role`.

**O que mudou depois da aprovação do SQL:** a linha `revoke all on feriados, registro_alteracoes, preferencias from anon, authenticated;`. O primeiro teste mostrou que o update direto no histórico não dava erro (afetava 0 linhas pelo RLS), porque o Supabase concede tudo por padrão às tabelas novas. Com o revoke, insert, update e delete do app respondem 42501, e o `anon` não lê nada. Essa linha só restringe.

### Teste no Supabase local (09/11/2026)

O teste rodou com Supabase CLI 3.0.0 e Postgres 17, no banco local (`127.0.0.1`), com `npm run test:banco-local`. Nenhum comando usou `--remote`, o projeto vinculado ou o `.env`.

1. **As cinco migrações aplicam do zero.** Conferido em três `db reset`.
2. **39 de 39 passaram**: os 17 da 0004 e 22 novos em `supabase/testes/prazos-banco-local.test.ts`. Conferido depois do `db reset` e numa segunda rodada sem reset:
   - **Tarefas:**
     - a tarefa nova fica como providência;
     - os checks recusam prazo fatal fora do prazo, local fora da audiência e tipo desconhecido (23514).
   - **Feriados, com dois usuários:**
     - A e B leem a carga;
     - a carga não tem a Data Magna no TRF4 e tem só duas datas no TJRS;
     - B não lê, não altera e não exclui o feriado local de A;
     - ninguém grava feriado geral nem em nome de outro (42501);
     - ninguém altera nem exclui a carga;
     - período invertido é recusado (23514) e data repetida também (23505);
     - a mesma data em outra conta é aceita.
   - **Histórico:**
     - o gatilho registra a criação e as mudanças, com origem `app` pela sessão e `agente` pela chave de serviço;
     - mudança que não é de prazo não registra;
     - o app não insere, não altera e não apaga (42501);
     - B não lê o histórico de A;
     - o histórico fica depois de excluir a tarefa.
   - **Lembretes automáticos:** não há dois D-1 ativos na mesma tarefa, e o cancelado libera.
   - **Sem login:** o `anon` não lê nem grava nas três tabelas.
   - **Preferências:** margem 2 por padrão, só o dono lê e grava, e o limite é de 0 a 30.
   - **Código real contra o banco:**
     - o service grava um prazo do TJRS com o tribunal tirado do número CNJ, os três lembretes às 12:00Z (9h em São Paulo) e o histórico;
     - trocar para providência limpa os campos e cancela os lembretes;
     - o check vira "Só tarefas do tipo prazo têm prazo fatal.";
     - feriado repetido vira `ErroDeConflito`;
     - as preferências funcionam por upsert;
     - o repositório do agente lê a carga e os próprios, grava com o `user_id` dele e salva preferências;
     - uma conclusão feita pelo agente faz `lembretesProximos` cancelar os automáticos.
3. O Supabase local foi desligado no fim (`npx supabase stop`).

## Testes

- **Antes:** 166 testes em 14 arquivos (a `main` depois da etapa 2).
- **Depois:** 235 testes em 17 arquivos.
- **Arquivos novos:**
  - `src/domain/prazos.test.ts` (34 testes):
    - Páscoa e feriados móveis;
    - tribunal pelo número CNJ e pelo texto;
    - Carnaval, Semana Santa (TJRS e TRF4), Corpus Christi, fim de semana e virada de mês com a Consciência Negra;
    - recesso, e a Data Magna só no TJRS e no TRT4;
    - feriado local e suspensão;
    - expediente reduzido no meio, no vencimento, no começo e antes do fim de semana;
    - penal: Súmula 310, vencimento em feriado, art. 798-A e exceção;
    - DJe (inclusive no recesso), portal e pessoal;
    - memória completa, dobro, juizado, prazo interno, lembretes e validação.
  - `src/services/prazos.test.ts` (19 testes):
    - cálculo pelo tribunal e pela margem, e feriado local;
    - lembretes: criar, já passados, trocar o prazo fatal, prazo interno sem efeito, concluir e reabrir, concluída pelo agente e audiência;
    - troca de tipo numa gravação só (prazo para providência e audiência para prazo);
    - histórico, feriados locais, preferências e desfazer do agente.
  - `src/data/local/feriados-tribunais.test.ts` (2 testes): a carga local é igual à da 0005, e o TRF4 fica sem a Data Magna.
- **Arquivos ampliados:**
  - `contexto-agente.test.ts`: os 6 métodos novos passam pelo filtro de usuário; feriados lidos com a carga geral; recusa de `userId` que não é uuid.
  - `rotas.test.ts`: prazo pela API com lembretes e histórico, tipo inválido (400), feriado (409 e 400) e preferências.
  - `importacao.test.ts`: os campos novos e os feriados locais vão e voltam, e o arquivo antigo vira providência.
  - `quadro.test.ts`: documentos pendentes.
- **Resultado do `npm run verificar`:** passou (typecheck, 235 testes e build).
- **Banco local:** 39 de 39 (detalhes em "Banco").
- **Navegador:** Chrome sem interface sobre o build de produção em modo local, com as variáveis do Supabase vazias. Os 13 pontos passaram, sem erro de JavaScript:
  - o selo Fatal;
  - o filtro por tipo;
  - a memória e o aviso na janela;
  - o histórico;
  - o recálculo atravessando o recesso no TRT4;
  - aplicar o cálculo;
  - virar audiência;
  - os documentos pendentes em Hoje;
  - a seção Prazos;
  - o cadastro de feriado local.

## Como conferir à mão

**No navegador (modo local):**

1. Rode `npm run dev`, apague a chave `myplan:v2` do localStorage e recarregue.
2. Em **Prazos**, filtre por "Prazos".
   - Abra "Rol de testemunhas": aparecem prazo fatal, prazo interno, a memória e o aviso amarelo.
   - Clique em "Recalcular", troque a data para 15/12/2026 e veja o recesso na memória.
   - Clique em "Substituir pelo novo cálculo".
3. Ainda na janela, clique em "Ver histórico do prazo".
4. Troque o tipo para Audiência. O prazo fatal e a contagem somem, e aparecem data, hora e local.
5. Num item de checklist, clique no ícone de identidade para marcar como documento do cliente. Ele aparece em **Hoje**, em "Documentos pendentes do cliente".
6. Em **Configurações**, na seção **Prazos**:
   - mude a margem;
   - cadastre um feriado local e calcule um prazo que passe por ele;
   - cadastre um dia como "Expediente reduzido ou sistema fora do ar" no último dia de um prazo e veja o vencimento passar para o dia seguinte.
7. Conclua um prazo e reabra. Os lembretes automáticos que já passaram não voltam.

**Com o Supabase local:** `npx supabase start`, `npx supabase db reset` e `npm run test:banco-local`.

**No agente:** use as mesmas ferramentas de antes.
- `buscar_tarefas` devolve os prazos normalmente.
- Mudar o prazo de uma tarefa de prazo pelo agente aparece no histórico como "pelo agente".
- `concluir_em_lote` num prazo, seguido de `lembretes_proximos`, não traz os automáticos dele.

**Validação:** levar `docs/validacao-prazos.md` aos advogados.

## Fora do escopo e pendências

- **Produção:** a 0005 não foi aplicada (pedido seu). O código desta branch precisa dela, como explicado em "Riscos".
- **Feriados:**
  - os feriados forenses do TJRS além da Data Magna, até conferir o ato do Órgão Especial;
  - o Dia do Servidor de 2027 (TRF4, e o do TRT4 se houver);
  - a Quarta-feira de Cinzas, que só entra com ato do tribunal;
  - a carga de 2028 em diante (revisão anual).
- **Validação com advogados:** os 10 casos e 5 perguntas em `docs/validacao-prazos.md`. O aviso sai quando ela terminar, trocando a constante para `null`.
- **Etapa 4:**
  - `registrar_intimacao`, `prazos_proximos`, `audiencias_proximas` e `documentos_pendentes` no agente, que já podem usar `calcularPrazoDaTarefa` e a margem de `preferencias`;
  - resumo das 8h com prazos fatais;
  - o agente criar prazos e audiências (hoje ele só cria providências).
- **Tipos do banco:** `npm run db:tipos` não foi rodado, porque depende de um banco com a 0005.

## Riscos e dúvidas para a próxima etapa

**Riscos**
- **Ordem de publicação.** Sem a 0005, gravar tarefas, abrir as Configurações e listar lembretes falham. É preciso aplicar a migração antes do deploy. Os scripts `db:*` leem o `.env.local`, e o arquivo aqui se chama `.env`.
- **Fuso dos lembretes automáticos.** Pelo app, o horário de 9h usa o fuso do aparelho; no desfazer do agente, usa `MYPLAN_FUSO_HORARIO`. Para quem está no Brasil é o mesmo, mas um aparelho em outro fuso gera 9h daquele fuso.
- **O agente pode deixar o prazo interno depois do prazo fatal** (`atualizar_tarefa` com prazo). O banco não proíbe; a tela limita o campo. Na etapa 4 vale validar no service.
- **`lembretesProximos` lê todas as tarefas** quando há algum automático na janela. Para um advogado autônomo é pouco, mas cresce com a conta.
- **Carga anual de feriados.** Ela vai até 06/01/2028. Depois disso, a Semana Santa e o recesso do TRT4 e do TRF4 não entram até haver uma migração nova. A falta deixa o prazo mais cedo, não mais tarde.
- **Instalação.** O repositório estava sem `node_modules`. Rodei `npm ci`, que não alterou o `package-lock.json`.

**Dúvidas para os advogados** (também em `docs/validacao-prazos.md`)
1. Os juizados do TJRS suspendem os prazos no recesso?
2. Publicação no DJe disponibilizada durante o recesso: a contagem começa em 21/01 ou em 22/01?
3. Quais são os feriados forenses do TJRS em 2026 e 2027?
4. A Quarta-feira de Cinzas no TJRS é dia normal, expediente reduzido ou sem expediente?
5. A margem de 2 dias e os lembretes às 9h estão bons?

## Commits

| Hash | Mensagem |
|---|---|
| `944cf3f` | Adiciona a migração 0005 com prazos, feriados, histórico e preferências |
| `ecf1f87` | Adiciona o motor de prazos em domain/prazos.ts, com testes |
| `f3d1085` | Leva tipo, prazo fatal, feriados, histórico e preferências aos repositórios |
| `6b74f73` | Adiciona os casos de uso de prazos, audiências, feriados locais e preferências |
| `aa5ff23` | Adiciona as rotas de feriados, preferências e histórico, e os campos novos na API |
| `40a52fc` | Mostra tipo, cálculo do prazo, audiência e documentos do cliente na interface |
| `082cb5b` | Testa no Supabase local o código do app e do agente contra a 0005 |
| `47e6cab` | Ajusta o texto do expediente reduzido na memória do cálculo |
| `90a2405` | Adiciona os 10 casos de validação da contagem de prazos para os advogados |
| `ab8ecf0` | Atualiza proposta, ARQUITETURA e README para a etapa 3 |

O commit deste relatório entra depois dos listados acima.
