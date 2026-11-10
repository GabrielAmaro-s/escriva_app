# Marca Tempestivo

Branch `marca/tempestivo`, criada da `main` em `34b8acc`. O repositório agora é `GabrielAmaro-s/tempestivoapp`, e o remoto desta máquina foi atualizado para `git@github.com:GabrielAmaro-s/tempestivoapp.git`. A fonte da verdade da marca é `docs/marca/` (`MANUAL_DA_MARCA.md` e `tokens.json`).

## Resumo

O produto passa a se chamar Tempestivo no app, no agente e na documentação. Entram o logotipo, as cores e a tipografia da marca, e os estados de prazo ganham selos com palavra e o vencimento grifado. As mensagens do agente seguem a seção Voz e tom do manual. Nada que já funcionava quebrou: tokens `myplan_`, `MYPLAN_FUSO_HORARIO` e os dados do navegador em `myplan:v2` continuam aceitos. Não houve migração.

## O que mudou

**domain**
- `src/domain/datas.ts`:
  - `dataNumerica` (`02/12`, ou `02/12/2027` quando o ano muda), `dataComDia` (`quarta, 02/12`) e `dataCurtaComDia` (`qua, 02/12/2026`);
  - `descreverDia` passa a dizer "hoje", "amanhã", "ontem" ou "sexta, 22/01".
- `src/domain/prazos.ts`:
  - `situacaoDoPrazo`, que saiu das ferramentas do agente e agora é compartilhada com a tela;
  - `seloDoPrazo`, com Fatal vencido, Vence hoje, Interno vencido, No prazo e Cumprido, e os dias até o fatal;
  - `diasEntreDatas`;
  - textos dos lembretes automáticos na voz da marca.
- `src/domain/quadro.ts`:
  - `formatarData` em `dd/mm`;
  - prioridades em cores neutras;
  - `corDoPrazo` com a opção `prazoInterno`, que pinta o interno vencido em `interno`.

**services**
- `src/services/tokens.ts`: tokens novos com o prefixo `tempestivo_`; `validarToken` aceita também `myplan_`.
- `src/services/agente/ferramentas.ts`, `ferramentas-juridicas.ts` e `definicao.ts`:
  - o nome Tempestivo;
  - "Responda *sim* para confirmar." e "Responda *sim* para registrar.";
  - datas com o dia da semana;
  - erros que oferecem o cadastro ("Quer que eu cadastre o processo?");
  - "Parece repetido" no lugar de "Atenção";
  - a confirmação diz quando o Tempestivo vai lembrar.
- `src/services/importacao.ts`: mensagem com o nome novo (o formato do arquivo é o mesmo).

**data**
- `src/data/local/repositorio-local.ts`: a chave passa a ser `tempestivo:v2`. Dados só na `myplan:v2` são copiados na primeira leitura, e a chave antiga só é apagada depois de a cópia ser conferida.

**config**
- `src/config/ambiente-servidor.ts`: `TEMPESTIVO_FUSO_HORARIO`, com `MYPLAN_FUSO_HORARIO` como alternativa. O nome novo tem prioridade.

**interface**
- `src/app/globals.css`:
  - os tokens do `tokens.json`, com os mesmos nomes, nos temas claro e escuro;
  - as derivadas que o app precisa: `line-forte`, `hover`, `scrim` e os fundos das colunas;
  - o foco no token `foco`;
  - sombra só em janelas (`shadow-flutuante`, que usa o token `shadow-janela`);
  - títulos em `font-display` e a classe `dado` em mono.
- `src/lib/aparencia.ts`: cor de destaque Petróleo (padrão), Grafite ou Ameixa, com um valor por tema, guardada em `tempestivo-destaque`.
- `src/app/layout.tsx`:
  - Bricolage Grotesque, IBM Plex Sans e IBM Plex Mono pelo `next/font/google`;
  - metadados do Tempestivo;
  - cor do tema do navegador igual ao `surface`.
- `src/app/icon.svg` (o símbolo oficial) e `src/app/apple-icon.tsx` (novo, 180px, com fundo petróleo).
- `src/components/layout/logotipo.tsx` (novo): o símbolo, na versão escura no tema escuro, e "tempestivo" em Bricolage 600. O menu usa o calendário para Prazos.
- `src/components/ui/prazo.tsx` (novo): `SeloPrazo`, `MemoriaCalculo` e `AvisoValidacao`, usados no cartão do quadro, na lista de tarefas e na janela da tarefa.
- Classes em 31 componentes, numa troca mecânica:
  - `surface` vira `surface-raised` nos cartões;
  - `bg` vira `surface`;
  - `ink2` e `ink3` viram `ink-muted`;
  - `line2` vira `line-forte`;
  - as cores de estado passam para `fatal`, `interno` e `no-prazo`;
  - cartões ficam sem sombra.
- Títulos com peso 600, e o título de tela com o token `titulo` (32/38).
- Nome Tempestivo nos títulos das páginas, em Configurações, na seção do agente e no arquivo exportado (`tempestivo-AAAA-MM-DD.json`).

**agente/MCP**
- `src/app/api/mcp/route.ts`: `serverInfo` `tempestivo` 0.3.0, e instruções com o nome novo.
- `agente/nanobot/SOUL.md`: a persona Tempestivo, a seção Voz e tom com os exemplos do manual e o *sim* entre asteriscos.
- `agente/nanobot/USER.md` e `HEARTBEAT.md`: nome novo, e o lembrete do heartbeat sem emoji.
- `agente/nanobot/config.example.json` e `.env.example`:
  - `TEMPESTIVO_MCP_URL`, `TEMPESTIVO_MCP_TOKEN` e a chave `"tempestivo"` em `mcpServers`;
  - exemplo de token `tempestivo_`.
- `agente/systemd/*.service`: a descrição com o nome novo.

**banco**
- Sem mudanças.

**docs**
- `docs/marca/` entrou no repositório. O manual passa a dizer que, no WhatsApp, o *sim* vai entre asteriscos.
- `CLAUDE.md`: a regra que proibia renomear deu lugar ao nome Tempestivo e ao que não se renomeia.
- `README.md`:
  - clone de `tempestivoapp`;
  - a chave `tempestivo:v2`;
  - `TEMPESTIVO_FUSO_HORARIO`;
  - o projeto `tempestivo` na Vercel;
  - o domínio atual.
- `docs/ARQUITETURA.md`: título, a seção da marca, os componentes novos, o prefixo dos tokens e a etapa.
- `docs/PROPOSTA_JURIDICA.md`: título e base técnica. Nas pendências, o nome definido e a troca do domínio.
- `agente/README.md`: nome, variáveis novas, clone de `tempestivoapp`, e o nome e a foto do contato no WhatsApp.
- `.env.example`: o nome novo e `TEMPESTIVO_FUSO_HORARIO`.

## Decisões tomadas

| Decisão | Motivo | Alternativas descartadas |
|---|---|---|
| Os nomes do `tokens.json` viram as variáveis do CSS, e as classes antigas foram trocadas nos componentes. | Você pediu os mesmos nomes do `tokens.json`. Como `surface` já existia com outro sentido (cartões), só trocar os valores deixaria tudo com a cor errada. | Manter os nomes antigos apontando para os tokens. |
| Derivadas com nomes próprios (`line-forte`, `hover`, `scrim`, fundos das colunas) e os tons dos processos mantidos. | O `tokens.json` não cobre borda de campo, hover nem os tons de `projects.color`, que estão gravados no banco. | Inventar tokens com nomes do manual. |
| `ink3` (3,3:1) vira `ink-muted` (6,1:1 no claro). | O manual exige 4,5:1 em todo texto. | Manter um terceiro nível de cinza. |
| Cores de destaque: Petróleo (padrão), Grafite e Ameixa, sem Vinho. Decisão sua. | Vermelho, âmbar e azul são dos estados de prazo, e o Vinho ficaria perto do fatal. Verde é o do WhatsApp. | Vinho; as cores antigas. |
| A cor de destaque guarda o id da opção, com um valor por tema. | O petróleo tem um valor no claro e outro no escuro; o hexadecimal único de antes não servia. | Um hexadecimal só. |
| A escolha antiga (`myplan-accent`) é descartada, e volta o petróleo. | As opções antigas (violeta, azul, verde-água, rosa) não existem mais. | Mapear para a mais parecida. |
| Bandeiras de prioridade em cores neutras: média em `ink-muted`, alta na cor de destaque, urgente em `ink`. | A conferência no navegador mostrou âmbar e azul sem palavra. O manual reserva essas cores aos estados de prazo. | Manter as cores de estado nas prioridades. |
| Prazo interno vencido em `interno`, e não em `fatal`. | Vermelho é só do prazo fatal vencido ou que vence hoje. | Vermelho para qualquer data vencida. |
| Selo com "Cumprido" para prazo concluído. | O manual põe `no-prazo` para "em dia ou cumprido", e a palavra é obrigatória. | "No prazo" também para concluído. |
| Datas da interface em `dd/mm` (`dd/mm/aaaa` quando o ano muda); "qua, 02/12/2026" na memória e no selo. | Seção Voz e tom do manual e o exemplo MemoriaCalculo. | Manter "28 de nov". |
| Nanobot: `TEMPESTIVO_MCP_URL`, `TEMPESTIVO_MCP_TOKEN` e `"tempestivo"` em `mcpServers`, sem guia de migração. Decisão sua. | Nenhuma instância está no ar. | Manter os nomes antigos. |
| `supabase/config.toml` continua com `project_id = "myplan"`. Decisão sua. | Ele dá nome aos contêineres e volumes locais; trocar apagaria o banco local de teste. | Trocar e perder o banco local. |
| Confirmação "Responda *sim* para registrar.", com o *sim* entre asteriscos, e o manual ajustado. Decisão sua. | O WhatsApp mostra em negrito. | Texto simples. |
| D-1 do lembrete diz "Prazo fatal na segunda, 25/01", e não "amanhã". | O D-1 é o dia útil anterior: na sexta, ele aponta para segunda. | "Amanhã vence...", como no exemplo do manual. |
| A confirmação da intimação diz "Vou lembrar em 26/11, 30/11 e no dia." e não repete o aviso; o aviso continua na prévia e no campo `aviso`. | Segue o exemplo MensagemAgente do manual. | Repetir o aviso. |
| `apple-icon` gerado pelo Next a partir do `icon.svg`, com fundo petróleo inteiro. | Sem arquivo binário no repositório; o iOS mascara os cantos. | PNG exportado à mão. |
| O projeto não tinha manifest, e não foi criado. | Você pediu "se o projeto tiver". | Criar um. |
| Relatórios das etapas 1 a 4 e comentários das migrações ficam com o nome antigo. | São histórico; não se editam migrações já aplicadas. | Reescrever. |
| Variáveis da Vercel intocadas. | Pedido seu. O app lê `MYPLAN_FUSO_HORARIO` como alternativa, então a produção segue igual. | Trocar para `TEMPESTIVO_FUSO_HORARIO` agora. |

## Mudanças de comportamento

- **Visual:**
  - fundo verde-acinzentado claro (`surface`) e cartões brancos com borda, sem sombra;
  - petróleo nos botões, links e item ativo;
  - títulos em Bricolage Grotesque, texto em IBM Plex Sans e dados em IBM Plex Mono;
  - o símbolo "t" no menu e no ícone da aba.
- **Prazos:**
  - selo com a palavra do estado e os dias até o fatal;
  - o vencimento grifado em amarelo marca-texto na janela da tarefa;
  - o aviso de validação numa caixa âmbar;
  - datas em `dd/mm`.
- **Cor de destaque:** quem tinha escolhido violeta, azul, verde-água ou rosa volta para o petróleo. As novas opções são Petróleo, Grafite e Ameixa.
- **Exportação:** o arquivo passa a se chamar `tempestivo-AAAA-MM-DD.json`. Arquivos `myplan-...json` continuam sendo importados.
- **Agente:**
  - responde com datas como "vence terça, 01/12";
  - pede "Responda *sim* para registrar.";
  - nos erros, oferece o cadastro;
  - na confirmação, diz quando vai lembrar;
  - os lembretes dizem "Prazo fatal na sexta, 22/01: ..." e "Vence hoje o prazo fatal: ...";
  - o servidor se apresenta como `tempestivo`.
- **Tokens:** os novos começam com `tempestivo_`, e os antigos continuam funcionando.
- **Modo local:** os dados de `myplan:v2` passam para `tempestivo:v2` sem perda.

## Banco

Sem mudanças: nenhuma migração, tabela, coluna, política de RLS ou grant. O `supabase/config.toml` mantém `project_id = "myplan"`.

## Testes

- **Antes:** 269 testes em 18 arquivos (a `main` depois da etapa 4).
- **Depois:** 326 testes em 20 arquivos.
- **Novos:**
  - `src/lib/contraste.test.ts` (48 testes):
    - o `globals.css` tem exatamente as cores do `tokens.json` nos dois temas;
    - 4,5:1 em todas as combinações de texto que o manual descreve, nos dois temas, inclusive o hover;
    - Petróleo é a primeira opção e usa os valores do `tokens.json`;
    - cada opção de destaque passa de 4,5:1 como texto, sob o texto claro ou escuro e sobre o próprio fundo suave;
    - nenhuma opção é cor de estado.
  - `src/data/local/chave-navegador.test.ts` (4 testes):
    - a chave nova;
    - a migração da antiga sem perda;
    - a chave antiga intacta se a cópia falhar;
    - a nova vale quando existem as duas.
  - `tokens.test.ts`: token `myplan_` antigo valendo, token novo com `tempestivo_` e prefixos desconhecidos recusados.
  - `ambiente.test.ts`: `TEMPESTIVO_FUSO_HORARIO` tem prioridade, `MYPLAN_FUSO_HORARIO` continua aceito e um fuso inválido dá erro.
  - `datas.test.ts`: datas com o dia da semana e `dd/mm`.
  - `prazos.test.ts`: situação e selo do prazo.
- **Ajustados:**
  - mensagens do agente com a voz nova, em `ferramentas.test.ts`, `ferramentas-juridicas.test.ts` e `supabase/testes/agente-banco-local.test.ts`;
  - textos dos lembretes em `services/prazos.test.ts`;
  - `formatarData` e `corDoPrazo` em `quadro.test.ts`;
  - `serverInfo` em `mcp/route.test.ts`.
- **Resultado do `npm run verificar`:** passou (typecheck, 326 testes e build).
- **Banco local (`npm run test:banco-local`):** 48 de 48, depois de `db reset`.
- **Contraste medido nos tokens (mínimo 4,5:1):**

  | Combinação | Claro | Escuro |
  |---|---|---|
  | `ink` sobre `surface` | 15,42 | 16,37 |
  | `ink-muted` sobre `surface` | 6,09 | 8,55 |
  | `petroleo` sobre `surface-raised` | 9,95 | 6,81 |
  | `fatal` sobre `fatal-soft` | 5,55 | 6,99 |
  | `interno` sobre `interno-soft` | 5,22 | 7,89 |
  | `no-prazo` sobre `no-prazo-soft` | 5,44 | 7,56 |
  | `on-marca-texto` sobre `marca-texto` | 10,54 | 9,11 |
  | Grafite sobre `surface-raised` | 9,31 | 9,19 |
  | Ameixa sobre `surface-raised` | 8,81 | 7,89 |

- **Navegador:** Chrome sem interface sobre o build de produção, em modo local. Foram abertos `/hoje`, `/`, `/prazos`, o quadro de "Reclamação trabalhista" e a janela do prazo "Rol de testemunhas", nos temas claro e escuro: 10 capturas, olhadas uma a uma, e nenhum erro de JavaScript.
  - Fundo `#F5F6F3` no claro e `#0E1514` no escuro, os títulos em Bricolage Grotesque e o logotipo nas 10.
  - A janela do prazo mostra os selos e o vencimento grifado com marca-texto.
  - A conferência mostrou dois defeitos, já corrigidos e conferidos numa segunda rodada:
    - no cartão do quadro, "fatal 27/01" saía do cartão;
    - as bandeiras de prioridade usavam as cores de estado sem palavra.

## Como conferir à mão

1. Rode `npm run dev`. Sem Supabase, apague `NEXT_PUBLIC_SUPABASE_*` do `.env.local` para o modo local.
2. Em **Hoje**, **Processos**, **Prazos e tarefas** e num quadro, confira:
   - o símbolo e "tempestivo" no menu;
   - o fundo verde-acinzentado;
   - os títulos em Bricolage.
3. Abra "Rol de testemunhas", na Reclamação trabalhista. Confira:
   - "PRAZO FATAL" grifado em amarelo;
   - a memória em fonte mono;
   - o aviso na caixa âmbar;
   - o selo "NO PRAZO" com os dias.
4. Em **Configurações**, troque o tema e a cor de destaque (Petróleo, Grafite, Ameixa).
5. Num navegador que usava o app antes, confira que os dados continuam lá: a chave `myplan:v2` vira `tempestivo:v2`.
6. No agente, depois de publicar, mande uma intimação. A prévia deve dizer "vence terça, 01/12 (...). Responda *sim* para registrar.", e o *sim* aparece em negrito no WhatsApp.
7. Gere um token novo em Configurações > Agente: ele começa com `tempestivo_`.

## Fora do escopo e pendências

- **Domínio:** o app continua em `myplan-ashy.vercel.app`. A troca está registrada na proposta, junto com `NEXT_PUBLIC_APP_URL`, as Redirect URLs do Supabase e o `TEMPESTIVO_MCP_URL` das instâncias.
- **Vercel:** as variáveis não mudaram; produção segue com `MYPLAN_FUSO_HORARIO`, que continua aceito. Se quiser, troque depois para `TEMPESTIVO_FUSO_HORARIO`.
- **Logotipo em curvas:** o manual pede que um designer converta o logotipo completo em curvas antes de imprimir em grande escala.
- **Foto do WhatsApp:** o WhatsApp pede PNG ou JPG. O `agente/README.md` diz para exportar o símbolo em 640x640.
- **`supabase/config.toml`:** mantém `project_id = "myplan"`.
- **Histórico:** os relatórios das etapas 1 a 4, os nomes e comentários das migrações e o `0002_design_myplan.sql` continuam com o nome antigo.

## Riscos e dúvidas para a próxima etapa

**Riscos**
- **As fontes vêm do Google no build.** O `next/font/google` baixa as fontes durante o `next build` e as serve do próprio app depois. Um build sem internet falha; na Vercel e nesta máquina funcionou.
- **A cor de destaque escolhida antes se perde.** Quem tinha escolhido outra cor volta ao petróleo; não há como guardar a antiga.
- **Lembretes automáticos já criados mantêm o texto antigo.** Eles são refeitos com o texto novo só quando a tarefa muda de prazo, tipo, título ou conclusão.
- **Não houve revisão de design.** A aplicação seguiu o manual e os exemplos; uma passada de um designer pelas telas reais pode pedir ajustes finos de espaçamento.

**Dúvidas**
1. Quer trocar `MYPLAN_FUSO_HORARIO` por `TEMPESTIVO_FUSO_HORARIO` na Vercel agora, ou junto com a troca de domínio?
2. Para o domínio, já há um endereço escolhido? Ele entra no `NEXT_PUBLIC_APP_URL`, no Supabase e no agente.

## Commits

| Hash | Mensagem |
|---|---|
| `a3d76fe` | Adiciona a marca Tempestivo em docs/marca e atualiza a regra do nome |
| `fe38afc` | Adiciona datas com dia da semana e a situação do prazo ao domínio |
| `254ff26` | Mantém a compatibilidade com os nomes antigos: tokens, fuso e modo local |
| `fb49225` | Troca a paleta pelos tokens da marca Tempestivo |
| `9ec8c1d` | Troca o Inter pelas fontes da marca: Bricolage Grotesque, IBM Plex Sans e IBM Plex Mono |
| `14a93c2` | Aplica o logotipo e o ícone do Tempestivo |
| `af87594` | Mostra os estados de prazo, a memória e o aviso como no manual da marca |
| `349936e` | Troca o nome do produto para Tempestivo no app e no servidor MCP |
| `7aed8a0` | Ajusta a voz do agente à seção Voz e tom do manual da marca |
| `f29e4e7` | Atualiza docs e modelos do agente para o Tempestivo |
| `0d33a89` | Ajusta o cartão do quadro e as cores que não são de estado |

O commit deste relatório entra depois dos listados acima.
