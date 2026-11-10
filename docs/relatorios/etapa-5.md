# Etapa 5: investigação da captura de publicações pelo DJEN

Branch `juridico/etapa-5`, criada da `main` em `e18b9bf`. Etapa só de investigação: nada no app, no banco nem no agente mudou. Testes feitos em 10/11/2026, com consultas reais de leitura e sem credencial de ninguém.

**Numeração das etapas.** A captura de publicações pelo DJEN passa a ser a etapa 5. O DataJud, que a seção 10 da `docs/PROPOSTA_JURIDICA.md` chamava de etapa 5, fica para uma etapa posterior. A proposta também dizia que a "captura automática de publicações" ficava fora desta fase. Quem atualiza a proposta é a responsável pelo produto.

## Resumo

O DJEN tem uma API pública, documentada pelo CNJ e usada pelo próprio portal `comunica.pje.jus.br`. Ela devolve as comunicações por número e UF da OAB, sem login. As intimações do eproc do TJRS (1º e 2º grau) aparecem nela, com link para o documento. O que fica de fora:

- o teor dos processos sigilosos;
- as citações e intimações pessoais, que vão ao Domicílio Judicial Eletrônico;
- a quantidade de dias do prazo, que só está no texto.

O relatório propõe uma consulta diária de um ponto fixo (a VPS do agente). Cada comunicação vira uma sugestão que passa pelo `registrar_intimacao` atual, sempre com o "sim" do advogado.

## O que funciona

### A API

| Item | Valor |
|---|---|
| Base | `https://comunicaapi.pje.jus.br/api/v1` |
| Especificação | `https://comunicaapi.pje.jus.br/swagger/djen.yml` (OpenAPI 3.0.1, versão 1.0.4, atualizada em 04/03/2026) |
| Quem publica | Conselho Nacional de Justiça. Na especificação: "API pública do DJEN. Endpoints sem cadeado não exigem autenticação. Endpoints autenticados e de login são de uso exclusivo pelos Tribunais." |
| Uso pelo portal | `https://comunica.pje.jus.br/assets/config/config.json` aponta `api.url` para essa mesma base. É o endpoint que o portal usa, não uma API paralela. |
| CORS | `access-control-allow-origin: *` |

Endpoints públicos (sem autenticação):

| Endpoint | Para quê |
|---|---|
| `GET /comunicacao` | Consulta de comunicações com filtros (abaixo). |
| `GET /comunicacao/{hash}/certidao` | Certidão da comunicação em PDF (testado: 200, `application/pdf`, 68 KB). |
| `GET /comunicacao/tribunal` | Tribunais por UF, com a data do último envio. |
| `GET /caderno/{sigla}/{data}/{meio}` | Caderno do dia compactado, com URL de download válida por 5 minutos. Disponível a partir das 3h. Testado com TJRS de 09/11/2026: 77.257 comunicações, 78 arquivos, 50 MB. |

Os endpoints `POST /login`, `POST /comunicacao` e `DELETE /comunicacao/{id}` são só dos tribunais.

### Filtros do `GET /comunicacao`

| Parâmetro | Testado | Observação |
|---|---|---|
| `numeroOab`, `ufOab` | sim | Com ou sem zero à esquerda dá o mesmo resultado. Sem `ufOab` vêm também advogados de outras UFs com o mesmo número (1 a mais no teste, do TRF6). Sempre mandar a UF. |
| `dataDisponibilizacaoInicio`, `dataDisponibilizacaoFim` | sim | `aaaa-mm-dd`. Janela de 9 dias e de 1 ano funcionaram. |
| `siglaTribunal` | sim | `TJRS`, `TRF4`, `STJ`... |
| `numeroProcesso` | sim | Com ou sem máscara. |
| `nomeParte`, `nomeAdvogado`, `texto`, `numeroComunicacao`, `orgaoId` | não | Documentados. Não usaremos (ver LGPD). |
| `meio` | sim | `D` (Diário) ou `E` (Plataforma de Editais). |
| `pagina`, `itensPorPagina` | sim | A especificação diz "valores válidos: 5 e 100". O valor 10 também foi aceito, mas usaremos 100. |

A especificação exige pelo menos um destes filtros: tribunal, texto, parte, advogado, OAB ou processo. Também limita a 10.000 resultados as pesquisas por OAB ou texto, com janela de datas ou por número de processo.

### Consulta por OAB (teste real)

Uma OAB/RS escolhida entre os advogados de uma intimação pública do TJRS. O número e os nomes não entram neste relatório.

| Consulta | Resultado |
|---|---|
| OAB e UF, de 01/11 a 09/11/2026 | 138 comunicações: página 1 com 100, página 2 com 38, sem repetição |
| Mesma consulta, só TJRS | 103 |
| OAB e UF, sem datas | 5.357 |
| OAB e UF, de 01/11/2025 a 09/11/2026 | 3.876 |

Nas 100 da primeira página:

- **Tribunais:** TJRS 79, TRF4 18, STJ 3.
- **Tipos:** Intimação 96, Lista de distribuição 2, Pauta de julgamento 2.
- **OAB:** a OAB consultada estava entre os advogados de todas as 100.
- **Datas de disponibilização:** de 03/11 a 09/11, sem nenhuma no fim de semana.

### Formato da resposta

`{ status: "success", message, count, items: [...] }`. Cada item traz:

| Campo | Exemplo ou uso |
|---|---|
| `id` | Identificador numérico da comunicação no DJEN (ex.: 775948858). |
| `hash` | Usado na certidão. |
| `data_disponibilizacao` | `2026-11-09`; também `datadisponibilizacao` como `09/11/2026`. |
| `siglaTribunal`, `nomeOrgao`, `idOrgao` | `TJRS`, "Juizado Especial Cível Adjunto da Comarca de ..." |
| `numero_processo`, `numeroprocessocommascara` | 20 dígitos e formatado. |
| `nomeClasse`, `codigoClasse` | Classe processual. |
| `tipoComunicacao` | Intimação, Edital, Pauta de julgamento, Lista de distribuição... |
| `tipoDocumento` | DESPACHO/DECISÃO, Ato ordinatório, Sentença, Outros. |
| `meio`, `meiocompleto` | `D`, "Diário de Justiça Eletrônico Nacional". |
| `texto` | Teor em **HTML** com entidades (`&Ccedil;`). Tem cabeçalho com classe, número, partes e advogados com OAB. Mediana de 1.271 caracteres. |
| `link` | Link do documento no eproc (`eproc1g.tjrs.jus.br`, `eproc2g.tjrs.jus.br`, `eproc.jfrs.jus.br`, `eproc.trf4.jus.br`) ou no STJ. Vazio em parte das comunicações (26 de 100 no TJRS). |
| `destinatarios` | Partes, com polo (A, P, T, D). |
| `destinatarioadvogados` | Advogados, com nome, número e UF da OAB. |
| `ativo`, `status`, `data_cancelamento`, `motivo_cancelamento` | Comunicação cancelada pelo tribunal (nenhuma nas 238 vistas). |
| `numeroComunicacao` | Sequência dentro do processo (vários com valor 1). **Não identifica a comunicação sozinho.** |

### TJRS: as intimações do eproc estão no DJEN

- **No teste:** das 100 comunicações do TJRS no Diário em 09/11/2026, todas eram intimações de processos do eproc (número começando com 5) e todas tinham advogado destinatário. Na consulta por OAB apareceram intimações do 1º e do 2º grau do TJRS, com links para `eproc1g` e `eproc2g`.
- **Na norma:** pela Res. CNJ 455/2022, alterada pela 569/2024, o DJEN é o meio oficial das intimações não pessoais. O art. 13, II, inclui "as intimações destinadas aos advogados nos sistemas de processo judicial eletrônico, cuja ciência não exija vista ou intimação pessoal". O art. 11, § 3º, diz que a intimação concomitante por outros meios tem valor só informacional.
- **TJRS no eproc:** o TRF4 informou que "o TRF4, o TJSC e o TJRS farão a mudança no eproc de forma coordenada" e que "o painel do advogado no eproc continuará recebendo todas comunicações de intimações", mas que, "como a contagem do prazo dependerá da publicação no DJEN, não haverá mais a opção de 'abrir prazo'". A OAB/RS registra que a nova sistemática entrou em vigor em 19/05/2025. O TRF4 e o TJSC falam em 16/05/2025.
- **Contagem:** disponibilização no DJEN; publicação no dia útil seguinte; o prazo começa no dia útil seguinte à publicação. É a regra que o motor da etapa 3 já aplica com `meio: "dje"`.

**O que só aparece no eproc ou fora do DJEN:**

1. **Teor dos processos sigilosos.** No teste, 31 das 238 comunicações eram de processo sigiloso. Nelas, o destinatário vem como `SIGILO` e o texto é só "Processo sigiloso. Para visualização do documento, consulte os autos digitais". O número do processo, o órgão, a classe e o tipo vêm normalmente; o link vem vazio. A intimação está no DJEN, mas o conteúdo e o prazo só se veem no eproc.
2. **Citações e comunicações que exigem vista, ciência ou intimação pessoal.** Vão ao Domicílio Judicial Eletrônico, não ao DJEN. Isso inclui as pessoas jurídicas de direito público.
3. **Ministério Público, Defensoria e parte sem advogado.** As fontes lidas não tratam deles. Não foi confirmado.

Não achamos registro de intimação a advogado que apareça só no painel do eproc e não no DJEN. Confirmar isso exigiria comparar o painel de um advogado com o DJEN, o que depende de credencial e ficou fora desta investigação.

## O que não funciona ou é limitado

- **Quantidade de dias do prazo:** não há campo para isso. Os dias só aparecem no texto (ver "Extração dos dias").
- **Teor em HTML:** precisa ser convertido para texto antes de qualquer leitura.
- **Processos sigilosos:** sem teor (acima).
- **Citações e intimações pessoais:** não estão no DJEN.
- **Limite de requisições por IP:**
  - os cabeçalhos mostram `x-ratelimit-limit: 20`;
  - em 30 chamadas seguidas, o restante caiu e voltou a 20 várias vezes em poucos segundos, de forma irregular (parece haver mais de um servidor contando);
  - não recebemos 429;
  - a especificação manda esperar 1 minuto depois de um 429 e diz que "a utilização de múltiplos IPs por um mesmo cliente para contornar o controle da taxa de requisições é considerado uso abusivo e poderá resultar em bloqueios".
- **Instabilidade:**
  - nas mesmas 30 chamadas, 2 voltaram com erro 500 e a seguinte funcionou;
  - a OAB/RS registrou dificuldade de acesso ao DJEN de 19 a 23/05/2025.
- **`/comunicacao/tribunal`:** não devolve os cabeçalhos de limite.
- **Texto da Res. 455 no site do CNJ:** o `atos.cnj.jus.br` recusa acesso automatizado (403). Respeitamos o bloqueio e usamos o texto citado em fontes oficiais de tribunais e da OAB. Antes de qualquer uso real, alguém deve ler o texto compilado no navegador.

## Termos de uso

**Não encontramos termos de uso próprios da API do DJEN.** A especificação traz só três coisas:

- a licença "Resolução Nº 455 de 27/04/2022";
- o aviso de uso abusivo;
- a orientação sobre os cabeçalhos de limite.

O mais próximo são os Termos de Uso da API Pública do CNJ (versão 1.2, de novembro de 2023), mas eles são do DataJud. Se valessem também para o DJEN, o que não está confirmado, os pontos que importam seriam:

- aceitar os termos ao usar a API;
- não sobrecarregar os servidores;
- não coletar dados pessoais de terceiros sem consentimento;
- a responsabilidade do usuário pelo uso das informações.

**Recomendação.** Antes de oferecer a captura a mais de um advogado, fazer uma consulta formal ao CNJ (ouvidoria ou o canal do DJEN). Perguntar:

- se uma aplicação pode consultar a API em nome do advogado, pela OAB dele, todos os dias;
- qual é o volume aceitável;
- se há termos de uso ou cadastro de aplicação.

Até a resposta, a captura fica no piloto, com o consentimento expresso de cada advogado e no volume descrito abaixo.

## Desenho proposto

### Visão geral

```
VPS do agente (IP fixo)                         Tempestivo (Vercel)                 WhatsApp
───────────────────────                         ──────────────────                  ────────
timer diário  ─► fila única (flock) ─► DJEN
                  1 consulta por advogado
                  campos mínimos ───────────►  POST /api/djen/comunicacoes
                                                (token do advogado)
                                                domain/djen: chave, sigilo,
                                                dias e trecho; descarta o resto
                                                services/djen: grava sugestões,
                                                sem duplicar
                                                                     ◄─── nanobot: resumo das 8h
                                                                          e heartbeat
                                                registrar_intimacao  ◄─── "sim" do advogado
                                                (prévia, depois grava)
                                                lembretes D-3/D-1/dia
```

### Origem fixa das consultas

- **Nunca em funções da Vercel.** Elas saem por IPs que mudam, e o CNJ trata o uso de vários IPs para contornar o limite como abuso. O app não chama o DJEN.
- **Um ponto só: a VPS do agente.** Um script pequeno roda por um timer do systemd, uma vez por dia, às 7h (os cadernos do dia saem a partir das 3h). Assim, as comunicações do dia entram no resumo das 8h.
- **Uma instância por advogado, uma fila para todas.** Cada instância (`nanobot-<apelido>`) tem um timer próprio com horário escalonado (7h00, 7h05...), e todas usam a mesma trava (`flock /var/lock/tempestivo-djen.lock`). Duas consultas nunca rodam ao mesmo tempo, então o IP da VPS soma o tráfego de todos e fica muito abaixo do limite.
- **No máximo uma consulta por advogado por dia**, com a janela de datas:
  - `dataDisponibilizacaoInicio` = a data da última consulta que terminou bem, menos 2 dias de sobreposição;
  - `dataDisponibilizacaoFim` = hoje;
  - na primeira consulta, só os últimos 15 dias.

  Uma consulta pode ter várias páginas de 100. Elas contam como a mesma consulta e respeitam o intervalo abaixo.
- **Intervalo e limite:**
  - pelo menos 5 segundos entre requisições;
  - se `x-ratelimit-remaining` chegar a 2 ou menos, espera 60 segundos;
  - com 429, espera 60 segundos e tenta uma vez; se vier outro 429, para e deixa para o dia seguinte.
- **Erros 500 e de rede:** novas tentativas com espera crescente (30 s, 1 min, 2 min, 4 min). Se as 4 tentativas falharem, o dia fica como "consulta falhou", e o resumo das 8h avisa: "Não consegui consultar o DJEN hoje. Confira o painel do eproc." Uma falha nunca fica em silêncio.
- **Identificação:** `User-Agent: Tempestivo/<versão> (+<URL do app>)`, sem dado pessoal.
- **O que o script envia ao app:** por item, só os campos da tabela de LGPD, mais o `texto` convertido para texto simples. Ficam de fora `destinatarios` e `destinatarioadvogados` (fora a confirmação de que a OAB consultada está entre eles). O script não guarda nada em disco além da data da última consulta boa, e o log registra só contagens e códigos HTTP.
- **Regra de negócio fica no app.** A extração dos dias, o sigilo e a chave ficam em `domain/djen.ts`, com testes, e o script da VPS só busca e repassa. Assim a camada de regras continua uma só, como no resto do Tempestivo.

### Sem duplicidade

- **Chave:** `(user_id, djen_id)`, com `djen_id` = o `id` do DJEN, único no banco. O `hash` é guardado só para a certidão. O `numeroComunicacao` não serve como chave, porque se repete entre processos.
- **Gravação:** `insert ... on conflict (user_id, djen_id) do nothing`. Uma consulta repetida, as 2 datas de sobreposição ou uma nova tentativa depois de erro nunca criam a segunda sugestão.
- **Republicação:** se o tribunal cancelar e publicar de novo, vem outro `id`. Para isso, uma segunda conferência é só aviso, não bloqueio: mesmo processo, mesma data de disponibilização e mesmo resumo do teor (SHA-256 do texto normalizado) geram "Parece repetida da comunicação de dd/mm. Responda *sim* para registrar mesmo assim."
- **Intimação já registrada à mão:** antes da prévia, se já existe prazo no mesmo processo com a mesma data de disponibilização, o agente pergunta: "Já há um prazo com disponibilização em dd/mm nesse processo (Contestação). É o mesmo? Responda *sim* para descartar a sugestão."
- **Comunicação cancelada:** se uma consulta seguinte trouxer o mesmo `id` com `ativo: false` ou `data_cancelamento`, a sugestão pendente vira "cancelada". Se o prazo já foi registrado, o agente avisa ("A comunicação de dd/mm em <processo> foi cancelada pelo tribunal. Confira o prazo.") e não mexe na tarefa sozinho.

### Processo sigiloso

- **Detecção:** destinatário `SIGILO`, ou texto igual a "Processo sigiloso. Para visualização do documento, consulte os autos digitais".
- **Sem cálculo:** o agente não calcula nada, não extrai dias e não chama `registrar_intimacao`.
- **Mensagem, na regra de segredo de justiça do manual** (só nome e número, nunca a parte contrária):

  > Chegou comunicação em processo sigiloso: 5001234-56.2026.8.21.0001, disponibilizada em 09/11. Consulte o eproc.

  Se o processo está cadastrado, o nome dele vem antes do número. A mensagem não traz órgão, classe nem tipo de documento.
- **Na sugestão:** fica gravado só `djen_id`, número, data e `sigiloso = true`, para não repetir o aviso.

### Extração dos dias

Uma função pura em `domain/djen.ts`, `extrairDiasDoPrazo(texto)`, com testes. Ela não usa o LLM: o número precisa ser reproduzível e mostrável.

1. **Normalização:** HTML para texto, entidades resolvidas, espaços juntados. O cabeçalho (classe, número, tabela de partes e advogados) sai, e só o corpo é lido.
2. **Padrões aceitos:** "prazo de 15 (quinze) dias", "no prazo de quinze dias", "em 15 dias", "15 (quinze) dias úteis", "prazo de 5 dias corridos". O número em algarismos e o número por extenso (de um a noventa, cem e cento e vinte) são lidos e precisam bater quando os dois aparecem.
3. **Seguro**, quando:
   - há um único número de dias distinto no corpo, ligado a "prazo", "no prazo de" ou "em ... dias";
   - os algarismos e o extenso batem;
   - não aparece nenhum destes sinais:
     - mais de um prazo ("15 dias para réplica e 5 dias para especificar provas");
     - "prazo sucessivo" ou "sucessivamente";
     - "em dobro";
     - prazo em horas ("48 horas") ou em meses;
     - "prazo legal" ou "no prazo da lei" sem número;
     - prazo para terceiro (perito, oficial, cartório), quando o trecho não fala em "parte", "autor", "réu", "intimad".
4. **Mensagem quando é seguro:** a prévia mostra o trecho de onde saiu o número (até 200 caracteres em volta) e segue para o `registrar_intimacao` com `confirmado=false`:

   > Comunicação do DJEN em Cobrança de aluguéis, disponibilizada em 09/11. Tirei 15 dias deste trecho: "intimada para apresentar réplica à contestação no prazo de 15 (quinze) dias". Prazo de 15 dias úteis: vence quarta, 02/12 (prazo interno 30/11). Confira o vencimento. Responda *sim* para registrar.

5. **Quando não é seguro, o agente pergunta e não chuta:**

   > Comunicação do DJEN em Cobrança de aluguéis, disponibilizada em 09/11. Não achei com segurança quantos dias são. Trecho: "especifiquem as partes as provas que pretendem produzir, no prazo legal". Quantos dias de prazo?

   - Com mais de um número, os trechos aparecem lado a lado e a pergunta é "Qual destes é o seu?".
   - Se o texto não tem prazo nenhum (ex.: só ciência de decisão), a pergunta é "Essa comunicação abre prazo para você? Se sim, de quantos dias?".
6. **O LLM pode ajudar, mas não decide.** Se o agente achar o número por conta própria quando a função não achou, ele ainda mostra o trecho e pede a confirmação do número antes da prévia.

### Encaixe no registrar_intimacao e nos lembretes

- **Correspondência de campos:**

  | Campo do `registrar_intimacao` | De onde vem |
  |---|---|
  | `processo` | `numero_processo` |
  | `disponibilizacao` | `data_disponibilizacao` |
  | `meio` | `"dje"` |
  | `dias` | `extrairDiasDoPrazo` ou o advogado |
  | `texto_original` | o trecho guardado, mais o link do documento e o da certidão; o teor inteiro não é guardado |
  | `titulo` | sugestão pelo tipo de documento e pelo trecho ("Réplica"), que o advogado pode trocar |

  O que não muda: `regra` vem do processo, como hoje, ou da pergunta "vara comum ou juizado?"; `em_dobro` e `excecao_recesso_penal` são marcados pelo advogado, nunca automáticos.
- **Órgão como pista:** se o processo não tem órgão no Tempestivo e o `nomeOrgao` do DJEN diz "Juizado", o agente sugere completar o órgão do processo. Isso faz `regraSeguraDoProcesso` valer nas próximas vezes. A palavra "Vara" continua sem valer como pista, como na proposta.
- **Processo não cadastrado:** "Chegou intimação no processo 5001234-56.2026.8.21.0001 (Juizado Especial Cível Adjunto de Soledade), que não está na sua conta. Quer que eu cadastre?" Com o *sim*, chama `criar_processo` com número e órgão, e depois a prévia do prazo.
- **Confirmação sempre:**
  - a sugestão nunca vira tarefa sozinha;
  - o fluxo é o de hoje: `confirmado=false` com a prévia; depois `confirmado=true` com `prazo_fatal_esperado` igual ao da prévia;
  - a sugestão só vira "registrada" quando a tarefa é criada; o `registrar_intimacao` ganha um campo opcional `comunicacao_djen_id` para ligar as duas;
  - o advogado pode responder "descartar", e a sugestão vira "descartada".
- **Lembretes:**
  - os D-3, D-1 e do dia continuam saindo da tarefa confirmada, pelo `services/prazos.ts`, sem mudança;
  - enquanto uma sugestão está pendente, o resumo das 8h a repete ("2 comunicações do DJEN esperando você: ..."), com o vencimento da prévia, porque o prazo corre mesmo sem o *sim*;
  - se faltar 3 dias úteis ou menos para o vencimento previsto, o HEARTBEAT também lembra, uma vez por dia.
- **Novas ferramentas MCP** (desenho; nomes a confirmar):
  - `comunicacoes_djen_pendentes` (leitura): o que espera resposta, sem os sigilosos já avisados;
  - `descartar_comunicacao_djen` (escrita, com desfazer).

  O texto do DJEN é dado, nunca instrução, como o das intimações coladas.

### Dados de terceiros e LGPD

A resposta do DJEN traz nomes de partes (inclusive pessoas físicas), advogados e, às vezes, dados sensíveis no teor. A proposta guarda só o necessário para a sugestão:

| Guardado | Não guardado |
|---|---|
| `djen_id`, `hash`, número do processo, data de disponibilização, tribunal, órgão, classe, tipo de comunicação e de documento, link, `sigiloso`, status da sugestão, dias extraídos e **o trecho do teor** (até 600 caracteres em volta do prazo, ou o começo do corpo) | Texto completo, `destinatarios`, `destinatarioadvogados`, nomes das partes e dos outros advogados |

- **Tabela nova (migração futura, SQL a apresentar na etapa de implementação):** `comunicacoes_djen`, com `user_id`, RLS por dono e grants explícitos, como as tabelas da 0005.
- **Retenção:**
  - sugestões descartadas, canceladas ou sem resposta: o trecho e os metadados são apagados 30 dias depois da disponibilização;
  - registradas: o trecho vai para a tarefa, onde fica sob as regras da tarefa, e a sugestão perde o trecho, guardando só `djen_id` e datas por 1 ano, para não duplicar;
  - sigilosas: só `djen_id`, número e data, apagados em 30 dias.

  A limpeza é um job diário no banco.
- **Provedor de LLM:** o agente recebe o trecho e os metadados, nunca o teor inteiro. Isso reduz o que sai para o provedor (ver "Provedor de LLM e sigilo" no `agente/README.md`).
- **OAB como dado do advogado:**
  - o número e a UF são informados por ele em Configurações > Agente, ao ligar a captura, e guardados em `preferencias`;
  - a captura só consulta essa OAB, uma por conta, sem campo de busca livre por OAB, nome de parte ou de advogado;
  - na primeira consulta, o app mostra o nome que o DJEN associa à OAB e pergunta: "Achei comunicações para <nome> (OAB/RS <número>). É você?";
  - sem o *sim*, nada é guardado e a captura não liga;
  - o advogado desliga a captura quando quiser, e as sugestões pendentes são apagadas.
- **Consentimento:** ao ligar a captura, o advogado aceita o aviso de cobertura abaixo e um texto curto sobre os dados que passam pela VPS, pelo app e pelo provedor de LLM.

### Aviso de cobertura

Texto para Configurações > Agente, ao ligar a captura, e para a primeira mensagem do agente depois disso. Segue a voz do manual.

> **Captura do DJEN.** Todo dia às 7h, o Tempestivo procura no DJEN as comunicações da sua OAB e traz para você confirmar. Ela não substitui a sua conferência. Não chegam por aqui: citações e intimações pessoais, que vão para o Domicílio Judicial Eletrônico; o teor de processos sigilosos, que só aparece no eproc; e o que o DJEN não publicar ou publicar com atraso. Se a consulta falhar, eu aviso no resumo das 8h. Confira o painel do eproc e o Domicílio Judicial Eletrônico.

No WhatsApp, a versão curta:

> A partir de amanhã, trago às 8h as comunicações do DJEN da sua OAB para você confirmar. Citações, intimações pessoais e o teor de processos sigilosos não chegam por aqui. Confira o eproc e o Domicílio Judicial Eletrônico.

## O que mudou

**docs**
- `docs/relatorios/etapa-5.md` (este arquivo).

Sem mudanças em domain, services, data, hooks, interface, agente/MCP ou banco.

## Decisões tomadas

| Decisão | Motivo | Alternativas descartadas |
|---|---|---|
| API pública `comunicaapi.pje.jus.br` | É a do próprio portal, documentada pelo CNJ e sem login. | Raspar o portal, que é a mesma API com mais fragilidade. Baixar o caderno diário do tribunal (50 MB e 77 mil comunicações por dia só do TJRS, para achar 10 de um advogado). |
| Consultar pela VPS do agente | O limite é por IP, e trocar de IP é abuso. A VPS tem IP fixo e já roda o agente. | Funções da Vercel (IP variável). Cron do Supabase (também sem IP fixo garantido). |
| Uma consulta por advogado por dia, com janela | É o suficiente para o resumo das 8h e fica muito abaixo do limite. | Consultas de hora em hora (o DJEN publica uma vez por dia). |
| Chave `id` do DJEN | É único por comunicação. | `hash`, que é só para a certidão. `numeroComunicacao`, que se repete. |
| Regras no app, script burro na VPS | Mantém a regra em `domain/` com testes, como no resto do Tempestivo. | Lógica no script da VPS (duas fontes de regra). Deixar o LLM ler o teor inteiro (mais dado de terceiro no provedor e número não reproduzível). |
| Dias por função pura, LLM só sugere | O número precisa ser reproduzível e mostrável, com o trecho. | Só o LLM. Ou não extrair e sempre perguntar (mais atrito no caso comum, que é um prazo só). |
| Sigiloso sem cálculo | O teor não vem, e qualquer número seria chute. | Pedir os dias ao advogado pelo WhatsApp (ele precisa abrir o eproc de qualquer forma). |
| Guardar só o trecho, com retenção | Minimização (LGPD) e menos dado no provedor de LLM. | Guardar o teor inteiro, como faz hoje a intimação colada. |
| Consulta formal ao CNJ antes de ampliar | Não há termos próprios da API. | Assumir os termos do DataJud. |

## Mudanças de comportamento

Nenhuma. O app, o agente e o banco estão como na `main`.

## Banco

Sem mudanças. A proposta prevê, para a etapa de implementação:
- a tabela `comunicacoes_djen`;
- as colunas `numero_oab`, `uf_oab` e `captura_djen_ligada` em `preferencias`;
- a data da última consulta boa por advogado.

O SQL completo será apresentado para revisão antes de qualquer migração.

## Testes

Sem testes novos (etapa sem código): 331 antes e depois. `npm run verificar` passou na branch (typecheck, 21 arquivos de teste com 331 testes e build).

## Como conferir à mão

Sem login e no ritmo do limite (uma chamada por vez). Troque `NUMERO` pela sua OAB:

```bash
B=https://comunicaapi.pje.jus.br/api/v1
curl -s "$B/comunicacao?numeroOab=NUMERO&ufOab=RS&dataDisponibilizacaoInicio=2026-11-01&dataDisponibilizacaoFim=2026-11-09&itensPorPagina=100" \
  -D - -o /tmp/djen.json | grep -i ratelimit
python3 -c "import json;d=json.load(open('/tmp/djen.json'));print(d['count'],[ (i['siglaTribunal'],i['data_disponibilizacao'],i['tipoComunicacao']) for i in d['items'][:5]])"
```

Conferir também:
- o número de um processo seu, com `numeroProcesso=`;
- a certidão de uma comunicação, com `$B/comunicacao/<hash>/certidao`;
- no navegador, `https://comunica.pje.jus.br`, que mostra o mesmo resultado.

## Fora do escopo e pendências

- **Implementação:**
  - script e timer na VPS;
  - `POST /api/djen/comunicacoes`;
  - `domain/djen.ts` e `services/djen.ts`;
  - a migração;
  - as ferramentas MCP;
  - a tela de ligar a captura.

  Fica para a próxima etapa, depois da aprovação deste desenho e da resposta do CNJ, quando for além do piloto.
- **Comparar o painel do eproc com o DJEN** de um advogado do piloto, por uma ou duas semanas, para confirmar que nenhuma intimação ao advogado fica só no painel.
- **Ler no navegador o texto compilado da Res. CNJ 455/2022** (art. 11, 13 e o que fala de segredo de justiça e de acesso ao DJEN). Ele não abriu por acesso automatizado.
- **Ministério Público, Defensoria e parte sem advogado no DJEN:** não confirmado.
- **Atualizar a `docs/PROPOSTA_JURIDICA.md`** com a nova numeração (a responsável pelo produto fará).
- **DataJud:** etapa posterior.

## Riscos e dúvidas para a próxima etapa

- **Falsa sensação de cobertura:** o maior risco. O advogado pode parar de olhar o eproc e o Domicílio Judicial Eletrônico. O aviso de cobertura, o aviso de falha no resumo e os sigilosos sinalizados reduzem o risco, mas não o eliminam.
- **Instabilidade do DJEN:** houve dois erros 500 em 30 chamadas, e a OAB/RS registrou indisponibilidade em maio de 2025. Pela Res. 569, vale o que está no DJEN, e a norma não diz o que acontece quando ele não funciona.
- **Mudança da API sem aviso:** a especificação tem versão, mas não há compromisso de estabilidade nem canal de aviso. A integração precisa tolerar campo ausente e avisar quando a resposta não tiver o formato esperado.
- **Termos de uso:** não há termos próprios. Um bloqueio por IP derruba a captura de todos os advogados da VPS de uma vez.
- **Extração dos dias:** é o ponto mais sensível ao erro de leitura. A função pura precisa de casos reais do TJRS, do TRT4 e do TRF4 nos testes (despachos, atos ordinatórios e sentenças), além de revisão por advogado, como os prazos em `docs/validacao-prazos.md`.
- **Dados de terceiros:** a VPS recebe o teor inteiro por alguns segundos. O log não pode guardar o teor.
- **Juizado ou vara:** o `nomeOrgao` do DJEN ajuda, mas os juizados adjuntos ("Juizado Especial Cível Adjunto da Comarca de ...") ficam dentro de varas. Por isso a pista vale para "Juizado", não para "Vara".
- **Dúvida para a responsável pelo produto:** a captura é opcional por advogado (proposto) ou ligada por padrão?

## Commits

| Hash | Mensagem |
|---|---|
| (este commit) | Adiciona o relatório da etapa 5: investigação da captura pelo DJEN |

## Fontes

- **CNJ, especificação da API do DJEN:** `https://comunicaapi.pje.jus.br/swagger/djen.yml`
- **Configuração do portal:** `https://comunica.pje.jus.br/assets/config/config.json`
- **TRF4, mudanças nas intimações do eproc (13/03/2025):** `https://www.trf4.jus.br/trf4/controlador.php?acao=noticia_visualizar&id_noticia=28958`
- **TRF4/CNJ, novas regras de contagem (08/05/2025):** `https://www.trf4.jus.br/trf4/controlador.php?acao=noticia_visualizar&id_noticia=29120`
- **TJSC, novas regras para intimações no eproc a partir de 16/05/2025:** `https://www.tjsc.jus.br/web/processo-eletronico-eproc/-/atencao-advogado-a-novas-regras-para-intimacoes-no-eproc-a-partir-de-16-05-2025`
- **OAB/RS, instabilidade no DJEN e no eproc (26/05/2025):** `https://www2.oabrs.org.br/jornalDaOrdem/oab-rs-oficia-cnj-e-tjrs-sobre-instabilidade-no-djen-e-no-eproc/51441`
- **CNJ, Termos de Uso da API Pública v1.2 (DataJud):** `https://formularios.cnj.jus.br/wp-content/uploads/2023/11/Termos-de-uso-api-publica-V1.2.pdf`
- **Res. CNJ 455/2022:** `https://atos.cnj.jus.br/atos/detalhar/4509` (não aberta por acesso automatizado)
