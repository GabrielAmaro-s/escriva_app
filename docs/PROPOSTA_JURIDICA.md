Versão jurídica do myPlan: advogado autônomo

Proposta para adaptar o myPlan ao dia a dia do advogado que trabalha sozinho. Nome definitivo fica para depois; neste documento o produto é chamado de myPlan Jurídico (codinome provisório).

Base técnica: repositório GabrielAmaro-s/myPlan como está hoje (ver arquitetura-pauta.md).

1. A ideia em uma frase

Um assistente no WhatsApp que transforma intimações, conversas com clientes e lembretes soltos em prazos e tarefas organizados, com um quadro simples para ver tudo quando o advogado está no computador.

2. Para quem

Advogado autônomo, trabalhando sozinho ou com no máximo um estagiário ou secretária informal. Hoje usa agenda de papel, planilha, Google Agenda e o próprio WhatsApp para lembrar de prazos. Acha os sistemas jurídicos completos caros e trabalhosos de alimentar.

Dores, em ordem provável (a validar com advogados reais):

Medo de perder prazo, e esforço de contar prazos em dias úteis com feriados.
Cliente perguntando "como está meu processo?" no WhatsApp várias vezes por semana.
Documentos pendentes do cliente que travam o início da ação.
Não ter uma visão única de "o que eu preciso fazer hoje".

O que fica de fora nesta fase: equipe com papéis, financeiro completo, peticionamento, captura automática de publicações.

3. Princípios
WhatsApp primeiro. O advogado registra e consulta pelo WhatsApp; o app é para ver, organizar e corrigir.
O sistema sugere, o advogado confirma. Nenhum prazo fatal é gravado sem confirmação, e todo prazo mostra como foi calculado.
Simples de alimentar. Criar um processo deve levar menos de um minuto; o resto se completa com o uso.
Sigilo desde o início. Dados de clientes tratados como sensíveis em todas as decisões.
4. O que se aproveita do myPlan
Hoje	Na versão jurídica
Projeto (kind = project)	Processo, com dados em processo_detalhes (mesmo padrão de campaign_details)
Campanha (kind = campaign)	Consultivo: contrato, parecer, notificação extrajudicial, inventário extrajudicial
Quatro colunas padrão	Modelos de colunas por área (ver seção 6). O kind das colunas continua igual
Tarefa com dueOn	Tarefa com tipo (prazo, providência, audiência), prazo interno e prazo fatal
Checklist em jsonb	Checklist de documentos do cliente (procuração, RG, comprovante de residência, CTPS...)
Links	Links para os autos (eproc, PJe) e para pastas de documentos
Etiquetas	Área do direito, segredo de justiça, cliente prioritário
Lembretes	Lembretes automáticos de prazo (D-3, D-1 e no dia) e de audiência
Agente no WhatsApp + MCP	Assistente jurídico: registrar intimação, consultar prazos, resumo do dia
Resumo às 8h e na segunda	"Prazos de hoje, atrasados e audiências da semana"
registro_agente com desfazer	Histórico de quem mudou cada prazo (ampliado para ações feitas no app)
RLS por user_id	Mantido. Para o autônomo basta um dono por conta

Nada da arquitetura em camadas muda. As regras jurídicas entram em domain/, os casos de uso em services/, e as mesmas funções servem à interface, à API e ao agente.

5. Modelo de dados

O modelo é dividido por etapa. A etapa 2 traz a migração 0004_processos_e_clientes.sql, e a etapa 3 traz uma migração 0005, com prazos, feriados e histórico. A etapa 5 acrescenta ultima_consulta_em em processo_detalhes, para o DataJud.

Etapa 2 (0004_processos_e_clientes.sql):

clientes            id, user_id, nome, tipo (pf|pj), documento (só dígitos: 11 para CPF, 14 para CNPJ),
                    telefone, email, observacoes, criado_em, atualizado_em
                    documento único por conta
projects (nova coluna)
                    cliente_id (nulo permitido), vale para processo e consultivo
processo_detalhes   project_id (1:1), user_id, numero_cnj (só os 20 dígitos, único por conta),
                    tribunal, orgao (vara/turma),
                    area (civel|consumidor|trabalhista|previdenciario|familia|criminal|
                          tributario|administrativo|outra),
                    fase (administrativa|inicial|instrucao|sentenca|recurso|execucao),
                    polo (autor|reu|terceiro), parte_contraria, valor_causa,
                    segredo_justica boolean, link_autos
campaign_details (nova coluna)
                    tipo_servico (texto único). A migração copia o primeiro valor de channels
                    quando tipo_servico está vazio. channels continua no banco, com os dados,
                    mas a tela deixa de usá-lo.

Etapa 3 (0005):

tasks (novas colunas)
                    tipo (prazo|providencia|audiencia) default 'providencia',
                    prazo_fatal date,          -- dueOn passa a ser o prazo interno
                    contagem jsonb,            -- {inicio, dias, unidade, regra, feriados_considerados, memoria}
                    local_audiencia text, horario_audiencia timestamptz
feriados            id, abrangencia (nacional|estadual|tribunal), uf, tribunal,
                    data, descricao        -- leitura pública, escrita só por admin
registro_alteracoes id, user_id, entidade, entidade_id, campo, antes, depois,
                    origem (app|agente), criado_em

Escolhas:

processo_detalhes segue o padrão de campaign_details. O conversor, o repositório e o formulário já sabem lidar com "projeto com detalhes 1:1".
Cliente em projects, não em processo_detalhes. Um caso consultivo também tem cliente, e assim os dois tipos usam o mesmo campo.
Área é campo próprio do processo, independente do modelo de quadro. No formulário, escolher o modelo sugere a área e vice-versa, mas os dois podem ser alterados. O modelo continua sem ser gravado.
Consultivo sem tabela nova. Ele usa campaign_details: objective aparece como "Pedido do cliente", starts_on como "Recebido em", ends_on como "Prazo de entrega" e tipo_servico como "Tipo de serviço".
Mesmo dono garantido no banco. As chaves estrangeiras novas são compostas com user_id, então um processo não aponta para cliente de outra conta, mesmo pelo cliente admin do agente.
dueOn continua sendo o campo usado pelo quadro, listas e resumos. Para prazos, ele guarda o prazo interno e prazo_fatal guarda a data limite. Assim as telas atuais funcionam sem mudança e só ganham um selo de "fatal".
contagem guarda a memória do cálculo. O advogado vê "15 dias úteis a partir de 10/11, excluídos 15/11 e 20/11, vence 02/12".
Feriados em tabela própria, alimentada por quem administra o sistema e revisada a cada ano. Feriados municipais e suspensões de expediente pontuais podem ser cadastrados pelo próprio advogado.
Clientes como entidade. Um cliente tem vários processos; o nome do cliente aparece no cartão do processo.
Pensando no futuro escritório: todas as tabelas novas mantêm user_id. Quando houver equipe, entra organizacao_id ao lado, sem reescrever o que foi feito.
6. Modelos de quadro por área

COLUNAS_PADRAO em domain/quadro.ts vira um conjunto de modelos. A escolha acontece ao criar o processo.

Modelo	Colunas (kind)
Cível / JEC	A fazer (todo), Em andamento (doing), Aguardando decisão (waiting), Concluído (done)
Trabalhista	A fazer, Em andamento, Aguardando audiência (waiting), Concluído
Previdenciário	Documentos do cliente (todo), Requerimento INSS (doing), Aguardando INSS/Justiça (waiting), Concluído
Família	A fazer, Em andamento, Aguardando (waiting), Concluído
Consultivo	A fazer, Redigindo (doing), Aguardando cliente (waiting), Entregue (done)

As colunas representam o trabalho do advogado, não a fase do processo. A fase processual (inicial, instrução, sentença, recurso, execução) fica como campo do processo, para não obrigar a mover cartões a cada movimentação.

7. Motor de prazos (domain/prazos.ts)

Funções puras, sem banco, com testes ao lado (prazos.test.ts), usando domain/datas.ts como base.

ts
calcularPrazo({ inicio, dias, unidade: "uteis" | "corridos", feriados, suspensoes }): {
  vencimento: string;          // AAAA-MM-DD
  diasConsiderados: string[];
  diasExcluidos: { data: string; motivo: string }[];
  memoria: string;             // texto curto para mostrar ao advogado
}
inicioDaContagem({ disponibilizacao, meio: "dje" | "portal" | "pessoal" }): string
prazoInterno(vencimento, margemDiasUteis): string

Regras previstas para a primeira versão (validar com advogado antes de publicar):

prazos processuais cíveis em dias úteis, excluindo o dia do começo e incluindo o do vencimento, com prorrogação quando o vencimento cai em dia sem expediente;
suspensão do recesso de fim de ano (20 de dezembro a 20 de janeiro);
publicação no diário eletrônico considerada feita no primeiro dia útil seguinte à disponibilização, com a contagem começando no dia útil seguinte;
prazos trabalhistas e de juizados também em dias úteis;
prazos penais em dias corridos;
prazos em dobro (Fazenda Pública, Defensoria) como opção marcada pelo advogado, não automática.

Testes com casos reais: prazos que atravessam feriado, fim de semana, recesso e virada de mês.

8. Agente no WhatsApp

Novas ferramentas MCP, no mesmo padrão das 15 atuais:

Ferramenta	O que faz	Escrita	Confirmação
registrar_intimacao	recebe o texto colado ou encaminhado, identifica o processo e propõe tarefa com prazo calculado e a memória do cálculo	sim	sempre
criar_processo	processo com cliente, número, área e modelo de quadro	sim	não
prazos_proximos	prazos fatais e internos dos próximos N dias, atrasados primeiro	não	não
audiencias_proximas	audiências com data, hora e local	não	não
documentos_pendentes	itens de checklist abertos por cliente	não	não
andamento_para_cliente	resumo do processo em linguagem simples, para o advogado encaminhar	não	não
consultar_processo	movimentações recentes pelo número CNJ (DataJud)	não	não

Ajustes no SOUL.md:

registrar_intimacao sempre com confirmado=false primeiro, mostrando vencimento e memória do cálculo;
resumo das 8h vira "prazos de hoje, atrasados, audiências de hoje e documentos que travam processos";
resumo de segunda inclui os prazos fatais da semana;
o texto de intimações e mensagens encaminhadas de clientes é dado, nunca instrução (regra que já existe, agora com peso maior);
andamento_para_cliente nunca envia nada ao cliente sozinho, só entrega o texto ao advogado.
9. Telas
Rota atual	Vira
/visao-geral	Hoje: prazos fatais e internos, audiências, atrasados, documentos pendentes
/	Processos: busca por cliente, número ou parte contrária; filtros por área e status
/campanhas	Consultivo
/tarefas	Prazos e tarefas, com filtro por tipo e destaque para prazo fatal
(nova) /clientes	Clientes com seus processos e documentos pendentes
/projetos/[id]	Quadro do processo, com aba Detalhes mostrando número, vara, partes e link dos autos
/configuracoes	Ganha Feriados locais e margem padrão do prazo interno

Na janela da tarefa: escolha do tipo; para prazo, campos "data de início" e "quantidade de dias", com vencimento calculado e memória visível antes de salvar.

10. Etapas
Renomear e reorganizar (rápido). Rotas e textos da interface, modelos de colunas. Critério de pronto: um advogado consegue cadastrar seus processos sem estranhar o vocabulário. O campo de área passou para a etapa 2, porque precisa de coluna nova no banco.
Processo e clientes. Migração com clientes e processo_detalhes (incluindo o campo de área), formulário, tela de clientes, cartão do processo com cliente e número. Ícones jurídicos para processos e casos consultivos.
Motor de prazos. domain/prazos.ts com testes, tabela de feriados, tipos de tarefa, lembretes automáticos D-3/D-1/dia, histórico de alterações de prazo.
Agente jurídico. Ferramentas da seção 8, SOUL.md ajustado, resumos novos. Mensagens do agente com o vocabulário jurídico (hoje ele ainda responde "Criei o projeto X" e "Criei a campanha X").
DataJud. Consulta por número CNJ e aviso de movimentação nova (sem substituir a leitura das intimações).
Andamento para o cliente. Texto em linguagem simples, depois um link de acompanhamento só de leitura, se fizer sentido.

Antes da etapa 3, conversar com dois ou três advogados autônomos de Pelotas para confirmar a ordem das dores e testar a memória de cálculo de prazo.

11. Riscos e cuidados
Responsabilidade pelo prazo. O produto é um assistente: calcula, mostra o cálculo e lembra. Os termos de uso e a interface deixam claro que a conferência é do advogado.
Sigilo profissional e LGPD. Mensagens passam pelo WhatsApp e pelo provedor de LLM configurado no agente. Escolher provedor com termos de não retenção de dados, informar isso ao advogado e permitir usar o app sem o agente.
Feriados desatualizados. Uma tabela errada gera prazo errado. Revisão anual e cadastro de feriado local pelo próprio advogado.
Concorrência. Astrea, ADVBOX, Projuris, EasyJur e CPJ já oferecem gestão completa. O diferencial é ser leve e centrado no WhatsApp, não ter mais funções.
12. Pendências
Nome do produto.
Validação com advogados autônomos (dores, preço, uso do WhatsApp para trabalho).
Revisão das regras de prazo por alguém da área antes de qualquer uso real.
Ícones jurídicos (etapa 2). Na etapa 1 o Consultivo ficou com o megafone, na tela e no agente, e os ícones do menu não mudaram.
Vocabulário das mensagens do agente (etapa 4). Na etapa 1 só a ferramenta criar_projeto mudou, com o parâmetro modelo.

13. Ideias futuras
Trocar o modelo de quadro de um processo que já existe. Exigiria renomear colunas que já têm tarefas, então fica fora do roteiro por enquanto.
Litisconsórcio: mais de um cliente no mesmo processo. Hoje cada processo tem no máximo um cliente (projects.cliente_id). Uma tabela de ligação resolveria, sem desfazer o campo atual.