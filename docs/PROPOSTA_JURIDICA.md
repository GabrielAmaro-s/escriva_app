Tempestivo: proposta da versão jurídica para o advogado autônomo

Proposta para adaptar o myPlan, o gerenciador de projetos que deu origem ao produto, ao dia a dia do advogado que trabalha sozinho. O produto se chama **Tempestivo** ("tempestivo" é o ato praticado dentro do prazo); a marca está em docs/marca/.

Base técnica: repositório GabrielAmaro-s/tempestivoapp (antes GabrielAmaro-s/myPlan); a arquitetura está em docs/ARQUITETURA.md.

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
Na dúvida, o prazo vence antes. Um feriado ou uma suspensão a mais empurra o vencimento para depois do real e pode fazer o advogado perder o prazo. Por isso, o motor e as cargas de feriados só tiram um dia da contagem quando há base clara, e entre duas leituras possíveis da regra ficam com a que vence antes.
4. O que se aproveita do myPlan (a base do Tempestivo)
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

clientes            id, user_id, nome, tipo (pf|pj), documento (sem pontuação: 11 dígitos para CPF, 14 caracteres
                    para CNPJ, que pode ser alfanumérico),
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
                    prazo_fatal date,          -- só no tipo prazo; dueOn passa a ser o prazo interno
                    contagem jsonb,            -- {inicio, meio, dias, regra, unidade, emDobro, suspenderNoRecesso,
                                               --  tribunal, margem, comeco, vencimento, excluidos, memoria}
                    local_audiencia text, horario_audiencia timestamptz   -- só no tipo audiência
feriados            id, user_id (nulo na carga geral), tribunal (sigla; nulo num feriado local vale para todos),
                    data, ate (períodos), tipo (feriado|suspensao|expediente_reduzido), descricao, fonte
                    -- lê a carga geral e os próprios; grava, altera e exclui só os próprios
registro_alteracoes id, user_id, entidade, entidade_id, campo (due_on|prazo_fatal), antes, depois,
                    origem (app|agente), criado_em   -- gravado só por gatilho; o app só lê
lembretes (nova coluna)
                    automatico (d-3|d-1|dia), para recriar os automáticos sem tocar nos feitos à mão
preferencias        user_id, margem_prazo_interno (padrão 2 dias úteis)

Escolhas:

processo_detalhes segue o padrão de campaign_details. O conversor, o repositório e o formulário já sabem lidar com "projeto com detalhes 1:1".
Cliente em projects, não em processo_detalhes. Um caso consultivo também tem cliente, e assim os dois tipos usam o mesmo campo.
Área é campo próprio do processo, independente do modelo de quadro. No formulário, escolher o modelo sugere a área e vice-versa, mas os dois podem ser alterados. O modelo continua sem ser gravado.
Consultivo sem tabela nova. Ele usa campaign_details: objective aparece como "Pedido do cliente", starts_on como "Recebido em", ends_on como "Prazo de entrega" e tipo_servico como "Tipo de serviço".
Mesmo dono garantido no banco. As chaves estrangeiras novas são compostas com user_id, então um processo não aponta para cliente de outra conta, mesmo pelo cliente admin do agente.
dueOn continua sendo o campo usado pelo quadro, listas e resumos. Para prazos, ele guarda o prazo interno e prazo_fatal guarda a data limite. Assim as telas atuais funcionam sem mudança e só ganham um selo de "fatal".
contagem guarda a memória do cálculo. O advogado vê, por exemplo, "15 dias úteis, Cível (CPC). Disponibilizado no DJe em 09/11/2026, publicado em 10/11/2026. A contagem começa em 11/11/2026. Fora da contagem, além dos fins de semana: 20/11 (Consciência Negra). Vence em 02/12/2026."
Feriados em três camadas (decisão da etapa 3, que substitui a tabela única prevista antes):
os nacionais fixos e os móveis (Carnaval, Sexta-feira Santa e Corpus Christi) são calculados em domain/prazos.ts, sem tabela;
a tabela feriados guarda a carga geral por tribunal (feriados e suspensões), começando por TJRS, TRT4 e TRF4, carregada por migração e revisada a cada ano;
a mesma tabela guarda os feriados locais do advogado, com user_id: municipais, suspensões pontuais e dias de expediente reduzido ou de sistema fora do ar (CPC, art. 224, § 1º). O RLS lê a carga geral e os próprios, e grava só os próprios.
Na carga geral só entra o que tem base clara. A Data Magna do RS (20/09) vale para TJRS e TRT4, mas não para o TRF4, que também cobre SC e PR: o advogado do RS cadastra a data como feriado local.
Documento pendente do cliente é um item de checklist com o campo doCliente, no jsonb, sem migração.
Margem do prazo interno de 2 dias úteis por padrão, ajustável em Configurações e editável em cada prazo.
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
criarCalendario({ feriados, tribunal, suspenderNoRecesso }): Calendario   // nacionais + tribunal + locais
inicioDaContagem({ inicio, meio: "dje" | "portal" | "pessoal", calendario }): { comeco, explicacao }
calcularPrazo({ comeco, dias, unidade: "uteis" | "corridos", calendario }): {
  vencimento: string;          // AAAA-MM-DD
  diasConsiderados: string[];
  diasExcluidos: { data: string; ate?: string; motivo: string }[];
  comecoProrrogado, vencimentoProrrogado;
}
calcularPrazoDaIntimacao(dados, feriados, tribunal): resultado + memoria   // texto para o advogado
prazoInterno(vencimento, margemDiasUteis, calendario): string
datasDosLembretes(prazoFatal, calendario): { "d-3", "d-1", dia }

Regras da primeira versão (implementadas na etapa 3, ainda em validação com advogados; os casos estão em docs/validacao-prazos.md):

prazos processuais cíveis em dias úteis, excluindo o dia do começo e incluindo o do vencimento, com prorrogação quando o vencimento cai em dia sem expediente;
suspensão do recesso de fim de ano (20 de dezembro a 20 de janeiro) no cível (CPC, art. 220), no trabalhista (CLT, art. 775-A) e no penal (CPP, art. 798-A); no penal, as exceções do artigo (réu preso, Maria da Penha, medida urgente) são uma opção marcada pelo advogado;
publicação no diário eletrônico considerada feita no primeiro dia com expediente seguinte à disponibilização, com a contagem começando no dia útil seguinte;
dia de expediente reduzido ou de sistema fora do ar conta normalmente, mas, se for o dia do começo ou o do vencimento, o prazo passa para o dia útil seguinte (CPC, art. 224, § 1º);
prazos trabalhistas e de juizados também em dias úteis; nos juizados, a suspensão do recesso fica desligada por padrão, até a validação;
prazos penais em dias corridos, começando no primeiro dia útil depois da intimação (Súmula 310 do STF);
prazos em dobro (Fazenda Pública, Defensoria) como opção marcada pelo advogado, não automática.

Enquanto a validação não termina, a tela mostra junto de cada cálculo o aviso "Contagem em validação. Confira o vencimento antes de usar.", controlado pela constante AVISO_CONTAGEM_EM_VALIDACAO em domain/prazos.ts.

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
Agente jurídico (versão enxuta para o piloto com 2 ou 3 advogados). Feito: registrar_intimacao, criar_processo, prazos_proximos e audiencias_proximas; mensagens no vocabulário jurídico; SOUL.md com os resumos de prazos e audiências; uma instância do nanobot por advogado na mesma VPS. Ficou para depois: documentos_pendentes, andamento_para_cliente, consultar_processo (DataJud) e um agente que atende vários números.
Depois do piloto, nesta ordem:
1. Campo "rito" (comum|juizado) em processo_detalhes, preenchido uma vez por processo, para o agente parar de perguntar "vara comum ou juizado?". Exige migração. Até lá, a palavra "Vara" no órgão não conta como pista, por causa dos juizados adjuntos em comarcas pequenas e das varas federais com JEF.
2. documentos_pendentes no agente. Os documentos pendentes não entram no resumo das 8h.
DataJud. Consulta por número CNJ e aviso de movimentação nova (sem substituir a leitura das intimações).
Andamento para o cliente. Texto em linguagem simples, depois um link de acompanhamento só de leitura, se fizer sentido.

Antes da etapa 3, conversar com dois ou três advogados autônomos de Pelotas para confirmar a ordem das dores e testar a memória de cálculo de prazo.

11. Riscos e cuidados
Responsabilidade pelo prazo. O produto é um assistente: calcula, mostra o cálculo e lembra. Os termos de uso e a interface deixam claro que a conferência é do advogado.
Sigilo profissional e LGPD. Mensagens passam pelo WhatsApp e pelo provedor de LLM configurado no agente. Escolher provedor com termos de não retenção de dados, informar isso ao advogado e permitir usar o app sem o agente.
Feriados desatualizados. Uma tabela errada gera prazo errado. Revisão anual e cadastro de feriado local pelo próprio advogado.
Concorrência. Astrea, ADVBOX, Projuris, EasyJur e CPJ já oferecem gestão completa. O diferencial é ser leve e centrado no WhatsApp, não ter mais funções.
12. Pendências
Nome do produto: definido, Tempestivo (marca em docs/marca/).
Domínio: o app ainda responde em myplan-ashy.vercel.app. Trocar por um domínio do Tempestivo e, junto, atualizar NEXT_PUBLIC_APP_URL na Vercel, as Redirect URLs do Supabase e o TEMPESTIVO_MCP_URL das instâncias do agente.
Validação com advogados autônomos (dores, preço, uso do WhatsApp para trabalho).
Revisão das regras de prazo por alguém da área antes de qualquer uso real (casos em docs/validacao-prazos.md).
Feriados forenses do TJRS além da Data Magna: carregar só depois de conferir o ato do tribunal (etapa 3 deixou só o 20/09).
Dia do Servidor de 2027 no TRF4 (e no TRT4, se houver): carregar quando o tribunal fixar a data.
Quarta-feira de Cinzas: só entra como expediente reduzido com ato do tribunal; até lá, o advogado pode cadastrá-la como feriado local.
Ícones jurídicos: feitos na etapa 2 (tela) e na etapa 4 (o agente cria processo com a balança e caso consultivo com a maleta).
Vocabulário das mensagens do agente: feito na etapa 4.
Ferramentas do agente que ficaram fora da etapa 4: documentos_pendentes, andamento_para_cliente e consultar_processo (DataJud, etapa 5).
Agente único para vários números: fora do piloto. No piloto, cada advogado tem a própria instância do nanobot.

13. Ideias futuras
Trocar o modelo de quadro de um processo que já existe. Exigiria renomear colunas que já têm tarefas, então fica fora do roteiro por enquanto.
Litisconsórcio: mais de um cliente no mesmo processo. Hoje cada processo tem no máximo um cliente (projects.cliente_id). Uma tabela de ligação resolveria, sem desfazer o campo atual.