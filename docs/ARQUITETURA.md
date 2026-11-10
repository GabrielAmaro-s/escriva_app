Escriva: arquitetura

A Escriva é a assessora no WhatsApp que não deixa o advogado autônomo perder prazo, com um app para ver e organizar processos, prazos e clientes (ver PROPOSTA_JURIDICA.md). Nasceu do myPlan, um gerenciador pessoal de projetos e campanhas, e o código ainda guarda essa base. Um quadro Kanban por projeto, pensado para uma pessoa só, com um agente pessoal (nanobot) que cria tarefas e lembretes pelo WhatsApp.

Vocabulário: no código e no banco os nomes continuam projeto (kind = project) e campanha (kind = campaign). Na interface, projeto aparece como processo e campanha como caso consultivo.

1. Proposta de arquitetura

Cada camada só conversa com a de baixo:

Interface (app/ + components/)      páginas, componentes visuais, drag and drop
        │
Estado da tela (hooks/)             useProjetos, useTarefas, useLembretes: atualização otimista e desfazer
        │
Casos de uso (services/)            projetos, tarefas, lembretes, tokens, importação, agente
        │                           (a interface, a API e o servidor MCP chamam estas funções)
Regras de domínio (domain/)         tipos, progresso, posições, regra "Concluído = concluída", datas com fuso,
                                    motor de prazos (feriados, contagem, prazo interno, lembretes)
        │
Acesso a dados (data/)              interface Repositorio
        ├── http/                   navegador com Supabase: chama as rotas /api
        ├── supabase/               servidor: Postgres + RLS (cliente da sessão) ou admin filtrado (agente)
        └── local/                  localStorage, para usar sem backend
Navegador ──(cookies)──> /api/*      ──> services ──> Repositório Supabase (sessão, RLS)
nanobot ──(Bearer)──>    /api/mcp    ──> services/agente ──> criarRepositorioDoAgente(userId)
                                                              (cliente admin com user_id forçado)

Decisões principais:

Next.js App Router, telas como Client Components. O app é muito interativo (arrastar, editar no lugar), então o estado fica no navegador com atualização otimista.
Com Supabase, o navegador grava pela API. obterRepositorio() devolve o repositório HTTP (data/http/repositorio-http.ts), que chama as rotas /api. As rotas rodam no servidor com o cliente da sessão (obterRepositorioDoUsuario) e respeitam o RLS. Sem Supabase, o app continua no repositório local do navegador.
Repositório como contrato. data/repositorio.ts define todas as operações. São quatro usos: local, Supabase (sessão), Supabase (agente) e HTTP.
Atualização otimista. Toda ação aparece na hora. Se a gravação falhar, a tela volta ao estado anterior e um aviso explica o erro. Edições em sequência numa tarefa são agrupadas numa única gravação.
Posições fracionárias. Mover um cartão grava só aquele cartão, com a posição no meio dos vizinhos.
Agente com o mesmo código. O servidor MCP chama os mesmos services/ e o mesmo Repositorio, com um cliente admin que força user_id em toda consulta.
Variáveis de ambiente

src/config/ambiente.ts valida com zod as variáveis públicas (NEXT_PUBLIC_*). src/config/ambiente-servidor.ts (com server-only) valida as de servidor. Sem URL e chave do Supabase, modoLocal = true, e isso não é erro. Em produção com Supabase, faltar NEXT_PUBLIC_APP_URL, SUPABASE_SECRET_KEY ou MCP_SEGREDO_TOKENS gera erro em português na inicialização (src/instrumentation.ts). A lista completa está no .env.example.

2. Páginas, rotas e componentes

O visual segue a marca Escriva, em docs/marca/ (MANUAL_DA_MARCA.md e tokens.json):
- cores: os tokens do tokens.json, com os mesmos nomes de variável, no src/app/globals.css, nos temas claro e escuro; o teste src/lib/contraste.test.ts confere o CSS contra o tokens.json e mede 4,5:1 em todo texto;
- cor de destaque em Configurações: Petróleo (padrão, a cor da marca), Grafite ou Ameixa, cada uma com um valor por tema (src/lib/aparencia.ts, guardada em tempestivo-destaque, chave da marca anterior);
- fontes pelo next/font/google: Bricolage Grotesque nos títulos e no logotipo, IBM Plex Sans no texto e IBM Plex Mono (classe dado) em número CNJ, vencimentos, valores e memória do cálculo;
- logotipo: src/components/layout/logotipo.tsx (símbolo oficial e o nome em Bricolage 600); src/app/icon.svg e src/app/apple-icon.tsx;
- estados de prazo: src/components/ui/prazo.tsx (SeloPrazo, MemoriaCalculo com o vencimento grifado em marca-texto, AvisoValidacao em interno sobre interno-soft), a partir de situacaoDoPrazo e seloDoPrazo em domain/prazos.ts;
- ícones Phosphor e modo escuro.

Rota	Tela
/hoje	Hoje: números do momento (inclui prazos fatais em 7 dias), próximos lembretes, próximos prazos e documentos pendentes do cliente
/	Processos: busca por nome, cliente, número ou parte contrária, filtros por status e por área, cartões com cliente e número
/consultivo	Consultivo: casos consultivos em lista, com cliente, tipo de serviço, pedido do cliente, prazo de entrega e entregas
/prazos	Prazos e tarefas: todas as tarefas abertas ou concluídas, ordenadas por prazo, com filtro por tipo e selo de prazo fatal
/clientes	Clientes: busca por nome, CPF ou CNPJ; cadastro, edição e exclusão (com Desfazer); casos de cada cliente
/configuracoes	Aparência, Prazos (margem do prazo interno e feriados locais), Dados (exportar e importar) e Agente (estado, tokens, atividade)
/projetos/[id]	Quadro Kanban, com a aba Detalhes (?aba=detalhes) e a tarefa aberta (?tarefa=<id>)
/login	Entrada por link mágico (só com Supabase)

As rotas antigas /visao-geral, /campanhas e /tarefas redirecionam (307) para /hoje, /consultivo e /prazos, em next.config.ts. /projetos/[id] não mudou, porque o agente manda links nesse formato.

No Consultivo, a tela usa objective como "Pedido do cliente", starts_on como "Recebido em", ends_on como "Prazo de entrega" e tipo_servico como "Tipo de serviço" (sugestões: Contrato, Parecer, Notificação extrajudicial, Inventário extrajudicial). channels continua guardado, mas sai da tela.

No formulário de processo, o cliente é escolhido pelo nome; um nome que não existe cadastra o cliente ao salvar. Modelo de quadro e área se sugerem um ao outro até a pessoa escolher os dois. Os dados menos usados do processo (tribunal, vara, polo, parte contrária, fase, valor, link dos autos, segredo de justiça) ficam num bloco recolhível.
Rotas de servidor (src/app/api)

Todas, menos saude e mcp, exigem login (cookies) e respondem 401 sem ele. Entradas validadas com zod (api/esquemas.ts) e erros em JSON { erro }. Dado inválido (ErroDeValidacao) responde 400. CPF/CNPJ ou número de processo repetido na conta (ErroDeConflito) responde 409, com "Já existe um cliente com esse CPF/CNPJ." ou "Já existe um processo com esse número.".

Rota	Métodos	Faz
/api/saude	GET	{ ok, modoLocal, banco: "ok" | "erro" }
/api/projetos	GET, POST	listar, criar (com colunas)
/api/projetos/[id]	PATCH, DELETE	atualizar (inclui arquivar), excluir
/api/projetos/[id]/quadro	GET	colunas, tarefas e etiquetas do projeto
/api/espaco-de-trabalho	GET	colunas, tarefas e etiquetas de todos os projetos
/api/tarefas, /api/tarefas/[id]	POST, PATCH, DELETE	tarefas
/api/etiquetas, /api/etiquetas/[id]	POST, DELETE	etiquetas
/api/lembretes, /api/lembretes/[id]	GET, POST, PATCH, DELETE	lembretes (remarcar volta para pendente)
/api/importar	POST	importa um arquivo exportado para a conta logada
/api/clientes, /api/clientes/[id]	GET, POST, PATCH, DELETE	clientes
/api/feriados, /api/feriados/[id]	GET, POST, DELETE	carga dos tribunais (só leitura) e feriados locais; repetido responde 409
/api/preferencias	GET, PATCH	margem padrão do prazo interno
/api/tarefas/[id]/alteracoes	GET	histórico do prazo interno e do prazo fatal
/api/agente/tokens	GET, POST	listar e gerar token (o texto puro só aparece aqui)
/api/agente/tokens/[id]	DELETE	revogar
/api/agente/registro	GET	20 últimas ações do agente
/api/agente/registro/[id]/desfazer	POST	reverte uma ação
/api/agente/estado	GET	ativo ou sem sinal, pelo último heartbeat
/api/mcp	GET, POST	servidor MCP (ver seção 4)

O src/proxy.ts renova a sessão e redireciona as páginas para /login, mas não redireciona /api/*. Também ignora /api/mcp e /api/saude.

Componentes
src/components/
├── layout/      estrutura-app (menu lateral; vira gaveta abaixo de 820px), menu-lateral, logotipo
├── projects/    tela-projetos, cartao-projeto, formulario-projeto, interface-projeto
├── campaigns/   tela-consultivo
├── clients/     tela-clientes, formulario-cliente
├── board/       tela-quadro, quadro-kanban (DndContext), coluna-quadro, cartao-tarefa (sino
│                quando há lembrete, selo de prazo fatal, horário da audiência), aba-detalhes
├── tasks/       janela-tarefa (com campo Lembrete feito à mão), secao-prazo (tipo, calculadora
│                com memória e aviso, audiência, histórico), lista-tarefas, lista-lembretes,
│                tela-hoje, tela-prazos
├── settings/    tela-configuracoes, linha-configuracao, secao-prazos, secao-dados, secao-agente
└── ui/          pecas, botao, campo, janela, menu-contexto, aviso, prazo (selo, memória e aviso de prazo)
Nomes no código

Funções, hooks, componentes, tipos e variáveis estão em português (criarTarefa, useTarefas, CartaoProjeto, Tarefa). Ficam como estão: nomes exigidos pelo framework (page.tsx, route.ts, GET, proxy), as tabelas e colunas que já existiam e os campos das entidades antigas (title, dueOn, projectId...), que espelham essas colunas e o formato já salvo no navegador. As tabelas novas têm colunas em português (texto, quando, criado_em).

Camada	Arquivos
domain/	tipos.ts, quadro.ts (modelos de quadro, posições, regra de Concluído, datas), projeto.ts (progresso, busca e filtros, validação), cliente.ts (CPF, CNPJ também alfanumérico, validação), processo.ts (número CNJ, áreas, fases, polos, sugestão entre área e modelo), erros.ts (ErroDeConflito, ErroDeValidacao), lembrete.ts (status ativos, validação, situação do agente), datas.ts (fuso IANA), prazos.ts (feriados nacionais, calendário por tribunal, contagem, memória, prazo interno, lembretes automáticos, ajuste ao tipo da tarefa, AVISO_CONTAGEM_EM_VALIDACAO)
data/	repositorio.ts, index.ts (obterRepositorio), http/repositorio-http.ts, local/repositorio-local.ts, local/exemplo.ts, local/feriados-tribunais.ts (a mesma carga da 0005, conferida por teste), supabase/repositorio-supabase.ts, supabase/conversores.ts, supabase/erros.ts (23505, 23503 e os checks de tasks em mensagens claras), supabase/cliente.ts, supabase/servidor.ts, supabase/admin.ts, supabase/usuario-servidor.ts, supabase/contexto-agente.ts
services/	projetos.ts, clientes.ts, tarefas.ts, prazos.ts (calcular, alterarTarefa, lembretes automáticos, feriados locais, preferências), lembretes.ts, tokens.ts, desfazer.ts, importacao.ts, agente/ (ferramentas, executor e auxiliares)
hooks/	use-projetos.tsx, use-clientes.tsx, use-tarefas.ts, use-lembretes.tsx, use-prazos.ts, use-usuario-atual.ts
3. Modelo de dados

Migrações em supabase/migrations, aplicadas com npm run db:migrar (Supabase CLI):

0001_init.sql: modelo inicial;
0002_design_myplan.sql: ícone, prazo do projeto e nova paleta;
0003_agente_e_lembretes.sql: lembretes e tabelas do agente;
0004_processos_e_clientes.sql: clientes, detalhes do processo, cliente_id em projects e tipo_servico no consultivo;
0005_prazos_e_feriados.sql: tipo da tarefa, prazo fatal, contagem e audiência em tasks; feriados; registro_alteracoes; lembretes.automatico; preferencias.
projects            id, user_id, name, description, kind (project|campaign),
                    status (active|paused|done), color, icon, due_on, position, archived_at,
                    cliente_id (nulo permitido)                 único (id, user_id)
campaign_details    project_id (1:1), objective, starts_on, ends_on, channels text[], deliverables jsonb,
                    tipo_servico
clientes            id, user_id, nome, tipo (pf|pj), documento, telefone, email, observacoes,
                    criado_em, atualizado_em (gatilho set_atualizado_em)
                    único (user_id, documento) quando há documento
processo_detalhes   project_id (1:1), user_id, numero_cnj, tribunal, orgao, area, fase, polo,
                    parte_contraria, valor_causa numeric(14,2), segredo_justica, link_autos
                    único (user_id, numero_cnj) quando há número
board_columns       id, project_id, title, kind (todo|doing|waiting|done), position
labels              id, project_id, name, color
tasks               id, project_id, column_id, title, description, due_on, priority, label_ids uuid[],
                    checklist jsonb (itens com doCliente opcional), links jsonb, completed, completed_at, position,
                    tipo (prazo|providencia|audiencia), prazo_fatal (só prazo), contagem jsonb,
                    local_audiencia, horario_audiencia (só audiência)
project_task_counts (view) project_id, task_count, done_count, user_id

lembretes           id, user_id, tarefa_id (cascade), projeto_id (cascade), texto, quando timestamptz,
                    status (pendente|agendado|enviado|cancelado), origem (app|agente),
                    agendado_em, enviado_em, automatico (d-3|d-1|dia), criado_em
                    índice (user_id, status, quando); um automático ativo de cada tipo por tarefa
tokens_agente       id, user_id, nome, hash (único, HMAC-SHA256 com MCP_SEGREDO_TOKENS),
                    escopo (leitura|escrita), expira_em, ultimo_uso_em, revogado_em, criado_em
registro_agente     id, user_id, token_id, ferramenta, entrada jsonb, resultado jsonb, sucesso,
                    desfazer jsonb, desfeito_em, criado_em
heartbeats_agente   user_id (pk), ultimo_em

feriados            id, user_id (nulo na carga geral), tribunal, data, ate, tipo (feriado|suspensao|
                    expediente_reduzido), descricao, fonte        único (user_id, tribunal, data)
registro_alteracoes id, user_id, entidade, entidade_id, campo (due_on|prazo_fatal), antes, depois,
                    origem (app|agente), criado_em
preferencias        user_id (pk), margem_prazo_interno (0 a 30, padrão 2), atualizado_em

Escolhas:

Colunas são linhas no banco, não um enum fixo. O campo kind diz o papel de cada coluna.
Modelos de quadro (domain/quadro.ts, MODELOS_DE_QUADRO): Cível/JEC, Trabalhista, Previdenciário, Família e Consultivo. Todos têm uma coluna de cada kind (todo, doing, waiting, done), só os títulos mudam. O modelo é escolhido ao criar e só decide as colunas criadas; ele não fica gravado. Sem escolha, criarProjeto usa Cível/JEC para projeto e Consultivo para campanha.
Checklist, links e entregas em jsonb. São listas pequenas que sempre se leem junto com a tarefa.
Etiquetas por projeto, aplicadas via label_ids.
RLS em todas as tabelas: cada linha tem user_id preenchido com auth.uid() e só o dono lê ou escreve. A 0003 também dá grant explícito ao papel authenticated, porque projetos novos do Supabase podem não expor tabelas novas sozinhos.
Lembrete "ativo" é pendente (o agente ainda não agendou) ou agendado (já tem cron). Remarcar no app volta para pendente. O agente confere quando_esperado antes de enviar, então um horário antigo não dispara mensagem.
Token em texto puro só existe na resposta de criação. Revogar não apaga: o histórico continua ligado a ele.
desfeito_em (coluna extra em registro_agente) evita desfazer a mesma ação duas vezes.
Mesmo dono garantido no banco: projects.cliente_id e processo_detalhes.project_id são chaves compostas com user_id, porque uma chave estrangeira não passa pelo RLS. Excluir o cliente zera só cliente_id (on delete set null (cliente_id), Postgres 15 ou mais novo).
documento sem pontuação: 11 dígitos para CPF; 14 caracteres para CNPJ, os 12 primeiros podendo ter letras (CNPJ alfanumérico, desde julho de 2026). numero_cnj guarda só os 20 dígitos. A formatação fica em domain/.
Processos antigos não ganham linha em processo_detalhes; o app trata a ausência como "sem detalhes". Campanhas antigas recebem tipo_servico a partir do primeiro valor de channels (na migração e, no modo local, ao ler).
O modo local reproduz as garantias do banco: CPF/CNPJ e número únicos, cliente precisa existir, excluir o cliente deixa os casos sem cliente.
Prazos (etapa 3): dueOn continua sendo o campo das telas; num prazo, guarda o prazo interno, e prazo_fatal guarda a data limite. Prazo fatal só no tipo prazo, local e horário só na audiência (checks na 0005); trocar o tipo limpa os outros campos na mesma gravação (ajustarAlteracaoAoTipo). Feriados nacionais ficam em domain/prazos.ts; a tabela feriados tem a carga geral por tribunal (TJRS, TRT4, TRF4), que todos leem, e os feriados locais de cada pessoa. Na dúvida, um feriado não entra, porque um dia a mais empurra o vencimento para depois do real.
Histórico de prazos: o gatilho tasks_registrar_prazo (security definer) grava em registro_alteracoes cada mudança de due_on e prazo_fatal, com origem agente quando vem da chave de serviço. O app e o agente só leem; authenticated não tem insert, update nem delete na tabela.
Lembretes automáticos (D-3 e D-1 em dias com expediente, e no dia, às 9h; na audiência, no dia, 2 h antes) são linhas de lembretes com automatico preenchido. services/prazos.ts os recria quando o prazo fatal, o horário, o tipo, o título ou a conclusão mudam. Se uma tarefa é concluída por outro caminho (o agente, por exemplo), lembretesProximos cancela o automático em vez de devolvê-lo.
As tabelas novas da 0005 começam com revoke all de anon e authenticated, porque o Supabase dá todos os privilégios por padrão nas tabelas novas.
4. Servidor MCP e agente

src/app/api/mcp/route.ts usa mcp-handler 2.x com @modelcontextprotocol/server 2.x e zod 4. É Streamable HTTP sem estado e exporta GET e POST.

Autenticação: Authorization: Bearer tempestivo_.... Tokens antigos, com o prefixo myplan_, continuam valendo. validarToken confere o hash, a revogação e a validade. Token inválido, expirado ou revogado recebe 401 (via withMcpAuth). Cada requisição atualiza ultimo_uso_em.
Isolamento: o token traz o userId. As ferramentas usam criarRepositorioDoAgente(userId), um cliente admin embrulhado que põe user_id = userId em toda leitura, alteração e exclusão, e user_id: userId em toda inserção. O teste contexto-agente.test.ts passa por cada método do repositório e confere que toda gravação em clientes e processo_detalhes leva user_id explícito (no agente, auth.uid() é nulo). A única consulta sem esse filtro é buscarTokenPorHash, que descobre a quem o token pertence. Em feriados, a leitura é user_id nulo (carga geral) ou o do usuário; gravações e exclusões continuam presas ao usuário.
Escopo: o mcp-handler cria um servidor por requisição. O token validado passa para a montagem por AsyncLocalStorage, e um token de leitura só recebe as 7 ferramentas sem escrita.
Registro: toda chamada grava em registro_agente a entrada, o resultado, o sucesso e o desfazer. A tela de Configurações lista e desfaz.
Texto é dado: as descrições das ferramentas são fixas. Títulos, links, textos de lembretes e textos de intimação só aparecem como valores no JSON de resposta, e as instruções do servidor dizem isso ao agente.
Vocabulário: as respostas falam em processo e caso consultivo (tipo "processo" ou "consultivo"); os nomes das ferramentas e das chaves de entrada não mudaram, e as entradas tipo aceitam também "projeto" e "campanha". As tarefas trazem o título real da coluna e o papel (a_fazer, em_andamento, aguardando, concluido), que continua sendo o código de entrada do mover_tarefa.
Segredo de justiça: nas ferramentas jurídicas, processo com segredo_justica aparece só com nome e número (sem parte contrária, cliente, órgão nem texto da intimação). A descrição da tarefa continua guardando o texto original.
Arquivos: services/agente/definicao.ts (tipo Ferramenta, definir e esquemas comuns), ferramentas.ts (catálogo) e ferramentas-juridicas.ts (as quatro da etapa 4 e documentos_pendentes).
Ferramenta	O que faz	Escrita	Confirmação
listar_projetos	processos e casos consultivos com status, número, área e progresso	não	não
ver_quadro	colunas, tarefas e etiquetas (por id ou nome aproximado)	não	não
buscar_tarefas	filtro por texto, processo, prioridade, etiqueta, prazo	não	não
resumir_projeto	progresso, atrasos, próximas entregas, coluna de espera pelo título real	não	não
lembretes_proximos	pendentes das próximas N horas; atualiza o heartbeat	não	não
prazos_proximos	prazos abertos com fatal ou interno até hoje + N dias, atrasados primeiro, em todos os casos não arquivados (status quando não é ativo)	não	não
audiencias_proximas	audiências de hoje até hoje + N dias, com hora e local	não	não
documentos_pendentes	documentos do cliente ainda não entregues (checklist com doCliente), por cliente; segredo de justiça num grupo próprio, sem o cliente	não	não
criar_tarefas	uma ou várias (até MCP_LIMITE_ITENS_POR_PEDIDO)	sim	não
atualizar_tarefa	título, descrição, prazo, prioridade, etiquetas	sim	não
mover_tarefa	troca de coluna com a regra de Concluído	sim	não
adicionar_checklist	subtarefas	sim	não
criar_lembrete	lembrete com data e hora, origem = agente	sim	não
marcar_lembrete	agendado ou enviado (com quando_esperado)	sim	não
criar_projeto	caso consultivo ou processo simples, com as colunas do modelo de quadro (consultivo só para caso consultivo)	sim	não
criar_processo	processo com nome, número CNJ, área, órgão, modelo e cliente (cadastrado pelo nome se não existir)	sim	não
sugerir_prioridades	propõe prioridades e ordem pelo prazo	sim	sim
concluir_em_lote	fecha várias tarefas	sim	sim
excluir_tarefa	remove uma tarefa ou um lembrete	sim	sim
registrar_intimacao	calcula o prazo da intimação (processo pelo número CNJ ou nome) e, com o "sim" e o prazo_fatal_esperado da prévia, cria o prazo com lembretes automáticos; pede a regra quando o processo não deixa claro se é vara comum ou juizado	sim	sim

Com confirmação, confirmado=false (o padrão) só devolve a prévia e a pergunta, e confirmado=true aplica. Em registrar_intimacao, confirmado=true também exige prazo_fatal_esperado igual ao da prévia; se o recálculo mudar, volta uma prévia nova e nada é criado (o mesmo princípio do quando_esperado dos lembretes). Regra de contagem que o processo permite afirmar (regraSeguraDoProcesso): penal e trabalhista pela área, juizado quando o órgão diz Juizado, cível na família; nos outros casos a ferramenta pergunta "vara comum ou juizado?". As respostas de escrita trazem uma mensagem curta para o WhatsApp e o link (NEXT_PUBLIC_APP_URL/projetos/<id>?tarefa=<id>). Datas de prazo usam AAAA-MM-DD. Horários usam ISO no fuso TEMPESTIVO_FUSO_HORARIO (ou MYPLAN_FUSO_HORARIO).

O agente (nanobot numa VPS, WhatsApp) está documentado em agente/README.md.

5. Testes

npm test roda o vitest:

domain/: modelos de quadro, posições, regra de Concluído, alternar conclusão, validação de projeto e campanha, CPF e CNPJ (inclusive alfanumérico), número CNJ, área e modelo, busca de processos e clientes, datas, períodos e fuso, documentos pendentes;
motor de prazos (prazos.test.ts): Páscoa e feriados móveis, tribunal pelo número CNJ, dias úteis com Carnaval, Semana Santa, Corpus Christi, fim de semana, virada de mês, recesso e feriado só do TJRS, feriados e suspensões locais, expediente reduzido, dias corridos (Súmula 310, art. 798-A e exceção), DJe e portal, dobro, memória, prazo interno e lembretes;
services de prazos: cálculo pelo tribunal e pela margem, lembretes automáticos (criar, trocar, concluir, reabrir, audiência, concluída pelo agente), troca de tipo numa gravação só, histórico, feriados locais, preferências e desfazer do agente;
carga de feriados do modo local igual à da 0005;
importação: o quadro "Cobrança de aluguéis" do exemplo é reproduzido campo a campo, com cliente e detalhes; arquivo antigo continua aceito; cliente com o mesmo CPF/CNPJ é reaproveitado; tipo, prazo fatal, contagem, audiência, documento do cliente e feriados locais vão e voltam;
erros do banco: 23505 e 23503 viram mensagens claras;
ambiente;
tokens e lembretes;
filtro de usuário do repositório do agente;
integração navegador → API → serviços, inclusive clientes, prazos, feriados e preferências, 409 para repetidos e 400 para inválidos;
as 20 ferramentas com o repositório em memória, inclusive intimação de processo não cadastrado, número CNJ fora da conta, confirmação negada, prazo que atravessa o recesso, regra pela área e segredo de justiça;
a rota MCP de verdade (401, escopo e chamada).

npm run test:banco-local (opcional, fora do npm test) roda supabase/testes contra o Supabase local: migrações do zero, RLS com dois usuários, chaves compostas com a chave de serviço, exclusão de cliente, feriados (RLS com dois usuários e sem login), histórico gravado só pelo gatilho, lembretes automáticos, preferências e o repositório do app e do agente contra o banco. Precisa de npx supabase start; o script só aceita URL local.
6. Etapas de desenvolvimento
Base (feito). Next.js, Tailwind 4, tema claro/escuro, camada de dados com Supabase e modo local.
Meus projetos (feito). Cartões, criar, editar, arquivar, restaurar, excluir, filtros, campanhas.
Quadro Kanban (feito). Quatro colunas, arrastar, criação rápida, janela da tarefa.
Novo design (feito). Visão geral, Campanhas, Tarefas e Configurações; desfazer exclusões; cor de destaque.
Polimento. Reordenar projetos na página inicial, busca rápida (Ctrl+K), atalhos de teclado no quadro.
Dados confiáveis (feito). Testes de domain/, exportar JSON, importar do navegador para a conta.
Agente (feito). API no servidor, tokens, registro, lembretes, servidor MCP e configuração do nanobot.
Marca Tempestivo (feito, sem migração). Nome, logotipo, cores, tipografia, estados de prazo e voz do agente, pela marca em docs/marca/. Compatibilidade: tokens myplan_, MYPLAN_FUSO_HORARIO e a chave myplan:v2 do navegador continuam aceitos. Relatório em docs/relatorios/marca-tempestivo.md.
Marca Escriva (feito, sem migração). O nome Tempestivo foi descartado em 10/11/2026 (já existe tempestivo.com.br no mesmo nicho). Nome, logotipo, ícones, serverInfo do MCP e voz do agente, que fala de si no feminino. Continuam com o nome antigo: o prefixo tempestivo_ dos tokens, as variáveis TEMPESTIVO_*, as chaves do navegador, o projeto da Vercel e o domínio. Relatório em docs/relatorios/marca-escriva.md.
Versão jurídica, etapa 4 (feito, sem migração). Agente jurídico enxuto para o piloto: registrar_intimacao, criar_processo, prazos_proximos, audiencias_proximas, vocabulário jurídico, SOUL.md novo e uma instância do nanobot por advogado na mesma VPS.
Versão jurídica, etapa 3 (feito, migração 0005 aplicada em 09/11/2026). Motor de prazos, feriados por tribunal e locais, tipos de tarefa, prazo fatal, lembretes automáticos, histórico de prazos e documentos do cliente. A contagem está em validação com advogados (docs/validacao-prazos.md).
Versão jurídica, etapa 2 (feito, migração 0004 aplicada em 09/11/2026). Clientes, detalhes do processo, consultivo com tipo de serviço, ícones jurídicos.
Versão jurídica, etapa 1 (feito). Vocabulário jurídico na interface, rotas /hoje, /consultivo e /prazos, modelos de quadro por área e dados de exemplo jurídicos. As próximas etapas estão em PROPOSTA_JURIDICA.md.