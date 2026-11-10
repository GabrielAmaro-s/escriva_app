# Marca Escriva

Branch `marca/escriva`, criada da `main` em `d88c74d`. O nome Tempestivo foi descartado em 10/11/2026, porque já existe tempestivo.com.br no mesmo nicho. A fonte da verdade da marca continua sendo `docs/marca/`, agora com o pacote da Escriva.

## 1. Resumo

O produto passa a se chamar Escriva em tudo o que o usuário vê: a interface, os títulos, os ícones, o logotipo, o servidor MCP, o agente e a documentação atual. A Escriva fala de si no feminino ("Sou a Escriva"). Na mesma branch entra a ferramenta `documentos_pendentes` no agente, que estava na fila pós-piloto e aparece nos materiais de divulgação. Não houve migração. Tokens, variáveis e chaves do navegador continuam com o nome antigo.

## 2. O que mudou

**Marca (`docs/marca/`)**
- `MANUAL_DA_MARCA.md`, `tokens.json` e os logos `escriva-simbolo.svg`, `escriva-simbolo-escuro.svg` e `escriva-simbolo-mono.svg` vêm do pacote da Escriva. Os logos `tempestivo-*` saíram.
- No manual voltou o ajuste do *sim*: nas mensagens do WhatsApp ele vai entre asteriscos simples, na regra e no exemplo da prévia. No site e no app continua o negrito normal.
- `exemplos/` ficou e foi convertido para a Escriva. O pacote não os trazia por um erro de montagem.
  - `Logotipo` usa o nome e os símbolos novos.
  - `MensagemAgente` usa "Escriva" como nome do contato, com o símbolo novo.
  - `SeloPrazo` e `MemoriaCalculo` não tinham marca e ficaram iguais.
- As cores, as fontes e os tokens não mudaram. No `tokens.json` só mudou o `name`.

**Interface**
- `src/components/layout/logotipo.tsx`:
  - `SimboloEscriva` (antes `SimboloTempestivo`) desenha o "e" do pacote nas variantes clara e escura;
  - o nome aparece como "escriva" e o `aria-label` como "Escriva";
  - o logotipo vale para o menu, a barra do celular e o login.
- `src/app/icon.svg` é cópia de `escriva-simbolo.svg`. O `apple-icon.tsx` gera o PNG a partir dele, e só o comentário mudou.
- Títulos e metadados:
  - `src/app/layout.tsx`: `title` e `applicationName` passam a ser "Escriva", e a descrição a "A assessora que…";
  - as páginas Hoje, Prazos, Consultivo, Clientes e Configurações, e o título do quadro, passam a terminar em "| Escriva".
- Textos:
  - Configurações: "…e o agente da Escriva";
  - o aviso da seção do agente;
  - a mensagem de arquivo de outra versão na importação;
  - o arquivo exportado, que passa a se chamar `escriva-AAAA-MM-DD.json`.
- Comentários de marca em `globals.css`, `prazo.tsx` e `contraste.test.ts`.
- `src/lib/aparencia.ts` e `src/data/local/repositorio-local.ts` ganharam um comentário: as chaves continuam com o nome antigo de propósito.

**Agente e MCP**
- `src/app/api/mcp/route.ts`:
  - `serverInfo` passa a ser `{ name: "escriva", version: "0.4.0" }`;
  - as instruções dizem "Ferramentas da Escriva, a assessora jurídica…".
- `agente/nanobot/SOUL.md`:
  - "Você é a **Escriva**, a assessora no WhatsApp…";
  - personalidade de assessora de confiança, como no manual;
  - uma seção sobre o nome: sempre no feminino, pronúncia es-CRI-va, nunca "Escrivá" nem "Escreva";
  - explica que as ferramentas vêm do servidor MCP de nome técnico `tempestivo`, que não deve ser dito à pessoa;
  - uma linha sobre `documentos_pendentes`.
- `USER.md` e `HEARTBEAT.md` deixam de citar o Tempestivo.
- Nas units do systemd mudou só a linha `Description`. No `.env.example` do nanobot mudaram os comentários e a URL de exemplo.
- `src/services/agente/ferramentas.ts`: as descrições de `lembretes_proximos` e `criar_lembrete` deixam de citar o Tempestivo.

**Ferramenta `documentos_pendentes`** (`src/services/agente/ferramentas-juridicas.ts`)
- **O que lista:** os itens de checklist marcados como documento do cliente e não marcados como feitos. Ficam de fora tarefas concluídas e casos arquivados. Usa `documentosPendentes` de `domain/quadro.ts`, a mesma função da tela Hoje.
- **Entrada:** `cliente` e `processo`, os dois opcionais. O processo é aceito pelo nome ou pelo número CNJ. Nome ambíguo ou inexistente vira pergunta.
- **Grupos:** por cliente, em ordem alfabética. "Sem cliente" e "Em segredo de justiça" vêm por último.
- **Mensagem:** por exemplo, "4 documentos pendentes de 3 clientes. Fulano de Tal: Holerites dos últimos 12 meses e CTPS (Reclamação trabalhista). E mais 2 documentos em outros grupos."
- **Segredo de justiça:** o processo aparece com nome e número, sem o cliente e sem o título da tarefa, no grupo "Em segredo de justiça". Ele não entra no filtro por cliente, e a resposta filtrada traz uma observação fixa avisando disso.
- **Catálogo:** a ferramenta é de leitura, então o token de leitura também a enxerga. Passam a ser 20 ferramentas.

**Documentação**
- `README.md`: o título e o texto de abertura, e onde o nome Tempestivo continua e por quê.
- `CLAUDE.md`:
  - a regra da marca: "Escriva", artigo feminino, "escriva" no logotipo, pronúncia, o agente no feminino;
  - a lista do que fica com o nome antigo.
- `docs/ARQUITETURA.md`:
  - o título e o texto de abertura;
  - a ferramenta nova na tabela, com 20 ferramentas;
  - o item "Marca Escriva" nas etapas.
- `docs/PROPOSTA_JURIDICA.md`:
  - a Escriva no título, na introdução e na seção 12;
  - `documentos_pendentes` marcada como feita.
- `agente/README.md` e `docs/agente-google-cloud.md`: o texto, o nome do perfil do WhatsApp (Escriva) e a foto (`escriva-simbolo.svg`).
- `.env.example`: os comentários.

## 3. Decisões tomadas

| Decisão | Motivo | Alternativas descartadas |
|---|---|---|
| Branch `marca/escriva` a partir da `main`. Decisão sua. | A `juridico/etapa-5-captura` não pode ser mergeada antes dos testes de banco. | Partir da branch do DJEN. |
| Os comentários do DJEN ficam para um commit pequeno quando a fatia 1 entrar. Decisão sua. | Eles só existem na `juridico/etapa-5-captura`. | Corrigir lá agora. |
| Manter `docs/marca/exemplos/`, convertidos para a Escriva, e os comentários que apontam para eles. Decisão sua. | O pacote não os trazia por um erro de montagem. | Apagar os exemplos como o pacote fazia. |
| O *sim* entre asteriscos simples no WhatsApp continua no manual. Decisão sua. | O WhatsApp mostra `*sim*` em negrito; `**sim**` aparece com asteriscos sobrando. | O texto do pacote, com `**sim**`. |
| Segredo de justiça em `documentos_pendentes`: nome e número, sem cliente, no grupo "Em segredo de justiça". Decisão sua. | É o mesmo critério das outras ferramentas jurídicas. | Mostrar o processo dentro do grupo do cliente. |
| No grupo em segredo também sai o título da tarefa. | O título pode citar partes. É mais conservador que `prazos_proximos`. | Mostrar o título, como em `prazos_proximos`. |
| Processo em segredo não entra no filtro por cliente, e a resposta traz uma observação fixa. | Filtrar por cliente ligaria o cliente ao processo. A observação é a mesma sempre, então não revela se há algum. | Incluir com um aviso que dependesse do caso. |
| A chave `tempestivo` do servidor MCP no `config.example.json` fica. | Ela dá o prefixo dos nomes das ferramentas no nanobot. Trocar exigiria mexer no config de cada instância da VPS. | Renomear para `escriva`. |
| As chaves do navegador `tempestivo:v2` e `tempestivo-destaque` ficam. | Trocar faria cada navegador perder os dados do modo local e a cor de destaque. | Migrar as chaves de novo, como foi feito com `myplan:v2`. |
| O nome `tempestivo` no `package.json` fica. | Não aparece para ninguém e evita mexer no lockfile. | Renomear. |
| `serverInfo` 0.3.0 para 0.4.0. | Mudaram o nome e o catálogo. | Manter a versão. |
| Nas units do systemd muda só a linha `Description`. | Os nomes das units e dos arquivos estão nos comandos do README e nas VPS. | Renomear as units. |
| Os relatórios antigos ficam como estão. Decisão sua. | São histórico. | Atualizar o nome neles. |

## 4. Mudanças de comportamento

- **Interface:**
  - o app mostra o logotipo "escriva", com o "e" no quadrado petróleo;
  - a aba do navegador mostra "Escriva" e o ícone novo, e o iPhone também mostra o ícone novo;
  - o arquivo exportado se chama `escriva-AAAA-MM-DD.json`. A importação aceita os dois nomes, porque não olha o nome do arquivo.
- **Agente:** a pessoa que conversa no WhatsApp ouve "Sou a Escriva". Isso vale depois de o SOUL.md novo ser copiado para a VPS e o perfil do WhatsApp ser trocado, o que não foi feito.
- **MCP:** o cliente vê `serverInfo.name = "escriva"`. Os tokens continuam os mesmos, e os novos ainda começam com `tempestivo_`.
- **`documentos_pendentes`:** o agente ganha a ferramenta. Ela não entra nos resumos automáticos.
- **O que não muda:** os dados, os tokens, as variáveis e as URLs.

## 5. Banco

Sem mudanças.

## 6. Testes

- **Antes:** 331 testes em 21 arquivos, na `main`. **Depois:** 338 testes em 21 arquivos.
- **Novos, em `ferramentas-juridicas.test.ts` (7):**
  1. agrupamento por cliente em ordem alfabética, com processo e caso consultivo. Ficam de fora documentos entregues e itens que não são do cliente;
  2. tarefa concluída e caso arquivado não entram, e o caso sem cliente vai para o fim;
  3. segredo de justiça: só nome e número, sem cliente nem título, no grupo próprio, e o nome do cliente não aparece em lugar nenhum da resposta;
  4. filtro por cliente, e o processo em segredo fica fora dele;
  5. filtro por processo, pelo nome e pelo número CNJ;
  6. cliente ou processo ambíguo ou inexistente vira pergunta;
  7. lista vazia.
- **Ajustados:**
  - o catálogo passa a ter 20 ferramentas, com `documentos_pendentes` entre as de leitura, em `ferramentas.test.ts` e em `ferramentas-juridicas.test.ts`;
  - `route.test.ts`: o `serverInfo` é `escriva`, e o token de leitura enxerga 8 ferramentas.
- **`npm run verificar`:** passou (typecheck, 338 testes e build).
- **Conferência no navegador:**
  - feita com o build de produção (`next start`) no modo local e o Chrome headless, nos temas claro e escuro;
  - páginas: Hoje, Prazos, Configurações, login e o quadro da Reclamação trabalhista;
  - em todas, o logotipo e o título trazem a Escriva e nenhum texto da página cita o Tempestivo;
  - `/icon.svg` e `/apple-icon` respondem 200 com o símbolo novo;
  - as capturas ficaram fora do repositório.
  - Numa das capturas do quadro no tema escuro, o título ainda estava "Escriva" porque o nome do processo não tinha carregado. Na captura do tema claro ele aparece como "Reclamação trabalhista | Escriva". Esse comportamento não mudou nesta branch.

## 7. Como conferir à mão

1. `npm run dev` e abra `http://localhost:3000`. Confira o logotipo "escriva" no menu, o ícone na aba e o título "Hoje | Escriva".
2. Em Configurações, ligue o modo escuro: o símbolo troca para a variante de fundo escuro. Em seguida exporte os dados: o arquivo vem como `escriva-AAAA-MM-DD.json`.
3. Abra `/login` no modo local e confira o logotipo.
4. Agente, com Supabase:
   - gere um token;
   - chame `initialize` no `/api/mcp`: `serverInfo.name` deve ser `escriva`;
   - marque um item do checklist como documento do cliente e pergunte "que documentos faltam?". A resposta vem agrupada por cliente;
   - marque o processo como segredo de justiça e pergunte de novo: ele aparece em "Em segredo de justiça", sem o cliente.
5. Na VPS, ainda não feito:
   - copie `SOUL.md`, `USER.md` e `HEARTBEAT.md` para cada instância e reinicie;
   - troque o nome do perfil do WhatsApp para Escriva e a foto para `escriva-simbolo.svg` em PNG 640x640;
   - pergunte "quem é você?": a resposta deve ser "Sou a Escriva…".

## 8. Fora do escopo e pendências

- **Domínio e variáveis da Vercel:** não foram trocados nesta etapa, como combinado. O app continua no domínio atual, e o projeto da Vercel continua `tempestivo`.
- **VPS:** o SOUL.md, o USER.md e o HEARTBEAT.md novos e o perfil do WhatsApp não foram instalados. Nada foi feito na VPS.
- **Branch do DJEN:** quando a fatia 1 entrar, falta um commit pequeno para trocar a marca nos comentários e na documentação dela. São `cliente-tempestivo.ts`, `scripts/captura-djen.ts`, as units `tempestivo-djen@` e a seção do DJEN no `agente/README.md`. Os nomes de arquivo e das units podem ficar.
- **Proposta jurídica:** a versão com a sua edição está só na `juridico/etapa-5-captura` (commit `61f166b`) e perdeu a formatação. Esta branch atualizou a versão da `main`, que está formatada. As duas vão conflitar no merge: na resolução, ficam o texto da Escriva e as suas mudanças de conteúdo.
- **`adicionar_checklist`:** a ferramenta do agente ainda não marca um item como documento do cliente. Hoje isso só se faz na tela. Fica para depois, se o piloto pedir.

## 9. Riscos e dúvidas para a próxima etapa

- **Crons antigos dos resumos:** o SOUL.md manda recriar os crons quando a mensagem não cita `prazos_proximos`. As mensagens novas só deixaram de citar o Tempestivo, então os crons antigos continuam valendo. Se algum agente os recriar, o conteúdo é o mesmo.
- **Nome técnico do servidor:** o nanobot continua chamando o servidor de `tempestivo`, e os nomes internos das ferramentas podem trazer esse prefixo. O SOUL.md pede para não dizer esse nome à pessoa, mas vale conferir numa conversa real que a Escriva não o repete.
- **Gênero:** as mensagens das ferramentas são neutras ("Criei", "Registrei", "Vou lembrar"). Se alguma mensagem nova falar de si com adjetivo, ele tem de vir no feminino.
- **Tamanho da mensagem:** com muitos clientes, a mensagem cita só o primeiro grupo e resume o resto em "E mais N documentos". Vale ver com advogados se isso basta no WhatsApp.

## 10. Commits

- `9294c12` Troca o pacote da marca para Escriva
- `43849b6` Leva a marca Escriva para a interface e os ícones
- `2ddba92` Leva a marca Escriva para o agente e o servidor MCP
- `0f6f328` Atualiza a documentação atual para a marca Escriva
- `8633753` Adiciona a ferramenta documentos_pendentes ao agente
- (este relatório) Adiciona o relatório da marca Escriva
