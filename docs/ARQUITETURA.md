myPlan: arquitetura

Gerenciador pessoal de projetos e campanhas, em adaptação para advogados autônomos (ver PROPOSTA_JURIDICA.md). Um quadro Kanban por projeto, pensado para uma pessoa só, com um agente pessoal (nanobot) que cria tarefas e lembretes pelo WhatsApp.

Vocabulário: no código e no banco os nomes continuam projeto (kind = project) e campanha (kind = campaign). Na interface, projeto aparece como processo e campanha como caso consultivo.

1. Proposta de arquitetura

Cada camada só conversa com a de baixo:

Interface (app/ + components/)      páginas, componentes visuais, drag and drop
        │
Estado da tela (hooks/)             useProjetos, useTarefas, useLembretes: atualização otimista e desfazer
        │
Casos de uso (services/)            projetos, tarefas, lembretes, tokens, importação, agente
        │                           (a interface, a API e o servidor MCP chamam estas funções)
Regras de domínio (domain/)         tipos, progresso, posições, regra "Concluído = concluída", datas com fuso
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

O visual segue o protótipo myPlan_standalone.html: fonte Inter, ícones Phosphor, cor de destaque configurável (violeta por padrão) e modo escuro.

Rota	Tela
/hoje	Hoje: números do momento, próximos lembretes e próximos prazos
/	Processos: busca por nome, cliente, número ou parte contrária, filtros por status e por área, cartões com cliente e número
/consultivo	Consultivo: casos consultivos em lista, com cliente, tipo de serviço, pedido do cliente, prazo de entrega e entregas
/prazos	Prazos e tarefas: todas as tarefas abertas ou concluídas, ordenadas por prazo
/clientes	Clientes: busca por nome, CPF ou CNPJ; cadastro, edição e exclusão (com Desfazer); casos de cada cliente
/configuracoes	Aparência, Dados (exportar e importar) e Agente (estado, tokens, atividade)
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
/api/agente/tokens	GET, POST	listar e gerar token (o texto puro só aparece aqui)
/api/agente/tokens/[id]	DELETE	revogar
/api/agente/registro	GET	20 últimas ações do agente
/api/agente/registro/[id]/desfazer	POST	reverte uma ação
/api/agente/estado	GET	ativo ou sem sinal, pelo último heartbeat
/api/mcp	GET, POST	servidor MCP (ver seção 4)

O src/proxy.ts renova a sessão e redireciona as páginas para /login, mas não redireciona /api/*. Também ignora /api/mcp e /api/saude.

Componentes
src/components/
├── layout/      estrutura-app (menu lateral; vira gaveta abaixo de 820px), menu-lateral
├── projects/    tela-projetos, cartao-projeto, formulario-projeto, interface-projeto
├── campaigns/   tela-consultivo
├── clients/     tela-clientes, formulario-cliente
├── board/       tela-quadro, quadro-kanban (DndContext), coluna-quadro, cartao-tarefa (sino
│                quando há lembrete), aba-detalhes
├── tasks/       janela-tarefa (com campo Lembrete), lista-tarefas, lista-lembretes,
│                tela-hoje, tela-prazos
├── settings/    tela-configuracoes, linha-configuracao, secao-dados, secao-agente
└── ui/          pecas, botao, campo, janela, menu-contexto, aviso
Nomes no código

Funções, hooks, componentes, tipos e variáveis estão em português (criarTarefa, useTarefas, CartaoProjeto, Tarefa). Ficam como estão: nomes exigidos pelo framework (page.tsx, route.ts, GET, proxy), as tabelas e colunas que já existiam e os campos das entidades antigas (title, dueOn, projectId...), que espelham essas colunas e o formato já salvo no navegador. As tabelas novas têm colunas em português (texto, quando, criado_em).

Camada	Arquivos
domain/	tipos.ts, quadro.ts (modelos de quadro, posições, regra de Concluído, datas), projeto.ts (progresso, busca e filtros, validação), cliente.ts (CPF, CNPJ também alfanumérico, validação), processo.ts (número CNJ, áreas, fases, polos, sugestão entre área e modelo), erros.ts (ErroDeConflito, ErroDeValidacao), lembrete.ts (status ativos, validação, situação do agente), datas.ts (fuso IANA)
data/	repositorio.ts, index.ts (obterRepositorio), http/repositorio-http.ts, local/repositorio-local.ts, local/exemplo.ts, supabase/repositorio-supabase.ts, supabase/conversores.ts, supabase/erros.ts (23505 e 23503 em mensagens claras), supabase/cliente.ts, supabase/servidor.ts, supabase/admin.ts, supabase/usuario-servidor.ts, supabase/contexto-agente.ts
services/	projetos.ts, clientes.ts, tarefas.ts, lembretes.ts, tokens.ts, desfazer.ts, importacao.ts, agente/ (ferramentas, executor e auxiliares)
hooks/	use-projetos.tsx, use-clientes.tsx, use-tarefas.ts, use-lembretes.tsx, use-usuario-atual.ts
3. Modelo de dados

Migrações em supabase/migrations, aplicadas com npm run db:migrar (Supabase CLI):

0001_init.sql: modelo inicial;
0002_design_myplan.sql: ícone, prazo do projeto e nova paleta;
0003_agente_e_lembretes.sql: lembretes e tabelas do agente;
0004_processos_e_clientes.sql: clientes, detalhes do processo, cliente_id em projects e tipo_servico no consultivo.
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
                    checklist jsonb, links jsonb, completed, completed_at, position
project_task_counts (view) project_id, task_count, done_count, user_id

lembretes           id, user_id, tarefa_id (cascade), projeto_id (cascade), texto, quando timestamptz,
                    status (pendente|agendado|enviado|cancelado), origem (app|agente),
                    agendado_em, enviado_em, criado_em        índice (user_id, status, quando)
tokens_agente       id, user_id, nome, hash (único, HMAC-SHA256 com MCP_SEGREDO_TOKENS),
                    escopo (leitura|escrita), expira_em, ultimo_uso_em, revogado_em, criado_em
registro_agente     id, user_id, token_id, ferramenta, entrada jsonb, resultado jsonb, sucesso,
                    desfazer jsonb, desfeito_em, criado_em
heartbeats_agente   user_id (pk), ultimo_em

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
4. Servidor MCP e agente

src/app/api/mcp/route.ts usa mcp-handler 2.x com @modelcontextprotocol/server 2.x e zod 4. É Streamable HTTP sem estado e exporta GET e POST.

Autenticação: Authorization: Bearer myplan_.... validarToken confere o hash, a revogação e a validade. Token inválido, expirado ou revogado recebe 401 (via withMcpAuth). Cada requisição atualiza ultimo_uso_em.
Isolamento: o token traz o userId. As ferramentas usam criarRepositorioDoAgente(userId), um cliente admin embrulhado que põe user_id = userId em toda leitura, alteração e exclusão, e user_id: userId em toda inserção. O teste contexto-agente.test.ts passa por cada método do repositório e confere que toda gravação em clientes e processo_detalhes leva user_id explícito (no agente, auth.uid() é nulo). A única consulta sem esse filtro é buscarTokenPorHash, que descobre a quem o token pertence.
Escopo: o mcp-handler cria um servidor por requisição. O token validado passa para a montagem por AsyncLocalStorage, e um token de leitura só recebe as 5 ferramentas sem escrita.
Registro: toda chamada grava em registro_agente a entrada, o resultado, o sucesso e o desfazer. A tela de Configurações lista e desfaz.
Texto é dado: as descrições das ferramentas são fixas. Títulos, links e textos de lembretes só aparecem como valores no JSON de resposta, e as instruções do servidor dizem isso ao agente.
Ferramenta	O que faz	Escrita	Confirmação
listar_projetos	projetos e campanhas com status e progresso	não	não
ver_quadro	colunas, tarefas e etiquetas (por id ou nome aproximado)	não	não
buscar_tarefas	filtro por texto, projeto, prioridade, etiqueta, prazo	não	não
resumir_projeto	progresso, atrasos, próximas entregas, Aguardando	não	não
lembretes_proximos	pendentes das próximas N horas; atualiza o heartbeat	não	não
criar_tarefas	uma ou várias (até MCP_LIMITE_ITENS_POR_PEDIDO)	sim	não
atualizar_tarefa	título, descrição, prazo, prioridade, etiquetas	sim	não
mover_tarefa	troca de coluna com a regra de Concluído	sim	não
adicionar_checklist	subtarefas	sim	não
criar_lembrete	lembrete com data e hora, origem = agente	sim	não
marcar_lembrete	agendado ou enviado (com quando_esperado)	sim	não
criar_projeto	projeto ou campanha com as colunas do modelo de quadro (parâmetro opcional modelo; consultivo só para campanha)	sim	não
sugerir_prioridades	propõe prioridades e ordem pelo prazo	sim	sim
concluir_em_lote	fecha várias tarefas	sim	sim
excluir_tarefa	remove uma tarefa ou um lembrete	sim	sim

Com confirmação, confirmado=false (o padrão) só devolve a prévia e a pergunta, e confirmado=true aplica. As respostas de escrita trazem uma mensagem curta para o WhatsApp e o link (NEXT_PUBLIC_APP_URL/projetos/<id>?tarefa=<id>). Datas de prazo usam AAAA-MM-DD. Horários usam ISO no fuso MYPLAN_FUSO_HORARIO.

O agente (nanobot numa VPS, WhatsApp) está documentado em agente/README.md.

5. Testes

npm test roda o vitest:

domain/: modelos de quadro, posições, regra de Concluído, alternar conclusão, validação de projeto e campanha, CPF e CNPJ (inclusive alfanumérico), número CNJ, área e modelo, busca de processos e clientes, datas, períodos e fuso;
importação: o quadro "Cobrança de aluguéis" do exemplo é reproduzido campo a campo, com cliente e detalhes; arquivo antigo continua aceito; cliente com o mesmo CPF/CNPJ é reaproveitado;
erros do banco: 23505 e 23503 viram mensagens claras;
ambiente;
tokens e lembretes;
filtro de usuário do repositório do agente;
integração navegador → API → serviços, inclusive clientes, 409 para repetidos e 400 para inválidos;
as 15 ferramentas com o repositório em memória;
a rota MCP de verdade (401, escopo e chamada).

npm run test:banco-local (opcional, fora do npm test) roda supabase/testes contra o Supabase local: migrações do zero, RLS com dois usuários, chaves compostas com a chave de serviço, exclusão de cliente e o repositório do app e do agente contra o banco. Precisa de npx supabase start; o script só aceita URL local.
6. Etapas de desenvolvimento
Base (feito). Next.js, Tailwind 4, tema claro/escuro, camada de dados com Supabase e modo local.
Meus projetos (feito). Cartões, criar, editar, arquivar, restaurar, excluir, filtros, campanhas.
Quadro Kanban (feito). Quatro colunas, arrastar, criação rápida, janela da tarefa.
Novo design (feito). Visão geral, Campanhas, Tarefas e Configurações; desfazer exclusões; cor de destaque.
Polimento. Reordenar projetos na página inicial, busca rápida (Ctrl+K), atalhos de teclado no quadro.
Dados confiáveis (feito). Testes de domain/, exportar JSON, importar do navegador para a conta.
Agente (feito). API no servidor, tokens, registro, lembretes, servidor MCP e configuração do nanobot.
Versão jurídica, etapa 2 (feito, migração 0004 ainda não aplicada). Clientes, detalhes do processo, consultivo com tipo de serviço, ícones jurídicos.
Versão jurídica, etapa 1 (feito). Vocabulário jurídico na interface, rotas /hoje, /consultivo e /prazos, modelos de quadro por área e dados de exemplo jurídicos. As próximas etapas estão em PROPOSTA_JURIDICA.md.