# Validação da contagem de prazos

Este documento é para conferir, com advogados, se o sistema conta os prazos do jeito certo. São 10 casos com datas reais do calendário de 2026 e 2027. Para cada um, o sistema mostra o vencimento e a "memória do cálculo", que é o texto que o advogado vai ver na tela.

**Como responder:** em cada caso, marque **Certo** ou **Errado**. Se estiver errado, escreva o vencimento correto e o motivo. Se a resposta depender de alguma coisa (tribunal, tipo de ato, comarca), anote também.

**O princípio do sistema:** um feriado ou uma suspensão a mais empurra o vencimento para depois do real e pode fazer o advogado perder o prazo. Por isso, quando há dúvida, o sistema **não** tira o dia da contagem, e entre duas leituras possíveis fica com a que vence antes. Se em algum caso o vencimento correto for **mais cedo** que o do sistema, isso é o mais grave, e vale destacar.

Feriados que o sistema já considera:

- **Nacionais:** 01/01, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 20/11 (Consciência Negra) e 25/12; Carnaval (segunda e terça), Sexta-feira Santa e Corpus Christi.
- **TJRS:** só a Data Magna do RS (20/09). Os demais feriados forenses do TJRS ainda não foram carregados, porque o ato do tribunal não foi conferido.
- **TRT4 e TRF4:** quarta e quinta da Semana Santa, 11/08, 01/11, 08/12 e o recesso de 20/12 a 06/01 (Lei 5.010/1966, art. 62). No TRT4 também a Data Magna. No TRF4, o Dia do Servidor de 30/10/2026.
- **Recesso de 20/12 a 20/01:** suspende os prazos cíveis (CPC, art. 220), trabalhistas (CLT, art. 775-A) e penais (CPP, art. 798-A).

---

## Caso 1. Prazo cível com feriado nacional e virada de mês

- **Intimação:** publicação no DJe do TJRS, disponibilizada em **09/11/2026** (segunda).
- **Prazo:** 15 dias úteis (contestação, CPC).
- **Vencimento calculado:** **02/12/2026** (quarta).
- **Memória do cálculo:**
  > 15 dias úteis, Cível (CPC). Disponibilizado no DJe em 09/11/2026, publicado em 10/11/2026. A contagem começa em 11/11/2026. Fora da contagem, além dos fins de semana: 20/11 (Consciência Negra). Vence em 02/12/2026.
- Observação: o 15/11 de 2026 cai num domingo, por isso não aparece na lista.

[ ] Certo  [ ] Errado. Vencimento correto: ____/____/______ Motivo: ______________________________

## Caso 2. Carnaval e Quarta-feira de Cinzas

- **Intimação:** publicação no DJe do TJRS, disponibilizada em **13/02/2026** (sexta, antes do Carnaval).
- **Prazo:** 5 dias úteis (embargos de declaração, CPC).
- **Vencimento calculado:** **25/02/2026** (quarta).
- **Memória do cálculo:**
  > 5 dias úteis, Cível (CPC). Disponibilizado no DJe em 13/02/2026, publicado em 18/02/2026. A contagem começa em 19/02/2026. Vence em 25/02/2026.
- **Ponto a decidir:** o sistema trata a Quarta-feira de Cinzas (18/02) como dia normal. Se o TJRS abre só ao meio-dia nesse dia, ele seria de expediente reduzido (CPC, art. 224, § 1º): como é o dia da publicação, o começo passaria para 19/02 e o prazo venceria em **26/02/2026**. Sem um ato do tribunal, o sistema não carrega a Quarta-feira de Cinzas. O advogado pode cadastrá-la como "expediente reduzido" nas Configurações.

[ ] Certo  [ ] Errado. Vencimento correto: ____/____/______ Motivo: ______________________________
A Quarta-feira de Cinzas no TJRS é: [ ] dia normal  [ ] expediente reduzido  [ ] sem expediente

## Caso 3. Semana Santa na Justiça Federal

- **Intimação:** ciência pelo portal (eproc) do TRF4 em **30/03/2026** (segunda).
- **Prazo:** 15 dias úteis (cível, CPC).
- **Vencimento calculado:** **24/04/2026** (sexta).
- **Memória do cálculo:**
  > 15 dias úteis, Cível (CPC). Ciência pelo portal em 30/03/2026. A contagem começa em 31/03/2026. Fora da contagem, além dos fins de semana: 01/04 a 02/04 (Semana Santa), 03/04 (Sexta-feira Santa), 21/04 (Tiradentes). Vence em 24/04/2026.
- Se fosse no TJRS, a quarta e a quinta da Semana Santa contariam, e o vencimento seria 22/04/2026.

[ ] Certo  [ ] Errado. Vencimento correto: ____/____/______ Motivo: ______________________________

## Caso 4. Prazo trabalhista atravessando o recesso

- **Intimação:** ciência pelo portal (PJe) do TRT4 em **15/12/2026** (terça).
- **Prazo:** 8 dias úteis (recurso ordinário, CLT).
- **Vencimento calculado:** **27/01/2027** (quarta).
- **Memória do cálculo:**
  > 8 dias úteis, Trabalhista (CLT). Ciência pelo portal em 15/12/2026. A contagem começa em 16/12/2026. Fora da contagem, além dos fins de semana: 20/12 a 20/01 (recesso de 20/12 a 20/01). Vence em 27/01/2027.

[ ] Certo  [ ] Errado. Vencimento correto: ____/____/______ Motivo: ______________________________

## Caso 5. Prazo cível atravessando o recesso

- **Intimação:** intimação pessoal no TJRS em **15/12/2026** (terça).
- **Prazo:** 15 dias úteis (CPC).
- **Vencimento calculado:** **05/02/2027** (sexta).
- **Memória do cálculo:**
  > 15 dias úteis, Cível (CPC). Intimação pessoal em 15/12/2026. A contagem começa em 16/12/2026. Fora da contagem, além dos fins de semana: 20/12 a 20/01 (recesso de 20/12 a 20/01). Vence em 05/02/2027.
- **Ponto a confirmar:** na intimação pessoal, o sistema usa como dia do começo a data informada pelo advogado. Pelo CPC (art. 231), o termo inicial costuma ser a juntada do mandado ou do aviso de recebimento. A tela pede "Intimado em", e o advogado precisa informar a data que conta.

[ ] Certo  [ ] Errado. Vencimento correto: ____/____/______ Motivo: ______________________________

## Caso 6. Feriado só do TJRS (Data Magna, 20/09)

- **Intimação:** publicação no DJe disponibilizada em **16/09/2027** (quinta). O mesmo caso em dois tribunais.
- **Prazo:** 5 dias úteis (cível, CPC).
- **Vencimento calculado no TJRS:** **27/09/2027** (segunda).
  > 5 dias úteis, Cível (CPC). Disponibilizado no DJe em 16/09/2027, publicado em 17/09/2027. A contagem começa em 21/09/2027. Fora da contagem, além dos fins de semana: 20/09 (Data Magna do Rio Grande do Sul). Vence em 27/09/2027.
- **Vencimento calculado no TRF4:** **24/09/2027** (sexta).
  > 5 dias úteis, Cível (CPC). Disponibilizado no DJe em 16/09/2027, publicado em 17/09/2027. A contagem começa em 20/09/2027. Vence em 24/09/2027.
- **Por que o TRF4 conta o 20/09:** o TRF4 cobre RS, SC e PR, e a Data Magna só vale no RS. Para não dar um dia a mais a quem atua em SC ou PR, o sistema não carrega a data para o TRF4. **O advogado do RS que atua na Justiça Federal pode cadastrar o 20/09 como feriado local**, só para o TRF4, em Configurações > Prazos > Feriados locais.

[ ] Certo  [ ] Errado. Vencimento correto (TJRS): ____/____/______ (TRF4 no RS): ____/____/______ Motivo: ______________

## Caso 7. Prazo penal com intimação na sexta-feira

- **Intimação:** intimação pessoal em **06/11/2026** (sexta), TJRS.
- **Prazo:** 5 dias corridos (apelação, CPP).
- **Vencimento calculado:** **13/11/2026** (sexta).
- **Memória do cálculo:**
  > 5 dias corridos, Penal (CPP). Intimação pessoal em 06/11/2026. A contagem começa em 09/11/2026. Vence em 13/11/2026.
- Regra usada: intimação na sexta faz o prazo começar na segunda (Súmula 310 do STF). Depois disso, sábados, domingos e feriados contam, e só o vencimento passa para o dia útil seguinte quando cai em dia sem expediente.

[ ] Certo  [ ] Errado. Vencimento correto: ____/____/______ Motivo: ______________________________

## Caso 8. Prazo penal no recesso, com e sem réu preso

- **Intimação:** intimação pessoal em **15/12/2026** (terça), TJRS.
- **Prazo:** 5 dias corridos (CPP).
- **Sem réu preso (regra geral do art. 798-A do CPP):** vence em **21/01/2027** (quinta).
  > 5 dias corridos, Penal (CPP). Intimação pessoal em 15/12/2026. A contagem começa em 16/12/2026. Fora da contagem: 20/12 a 20/01 (recesso de 20/12 a 20/01). Vence em 21/01/2027.
- **Com réu preso, Maria da Penha ou medida urgente (exceções do art. 798-A, marcadas pelo advogado):** vence em **21/12/2026** (segunda).
  > 5 dias corridos, Penal (CPP). Intimação pessoal em 15/12/2026. A contagem começa em 16/12/2026. O último dia caiu em 20/12 (fim de semana) e passou para o dia útil seguinte. Sem a suspensão do recesso, por exceção marcada. Vence em 21/12/2026.

[ ] Certo  [ ] Errado. Vencimento correto (sem réu preso): ____/____/______ (com réu preso): ____/____/______

## Caso 9. Sistema do tribunal fora do ar no último dia

- **Intimação:** ciência pelo portal (eproc) do TJRS em **05/11/2026** (quinta).
- **Prazo:** 3 dias úteis (cível).
- **Situação:** o advogado cadastrou o dia **10/11/2026** como "expediente reduzido ou sistema fora do ar" (eproc indisponível).
- **Vencimento calculado:** **11/11/2026** (quarta).
- **Memória do cálculo:**
  > 3 dias úteis, Cível (CPC). Ciência pelo portal em 05/11/2026. A contagem começa em 06/11/2026. O último dia caiu em 10/11 (expediente reduzido: eproc fora do ar) e passou para o dia útil seguinte. Vence em 11/11/2026.
- Regra usada (CPC, art. 224, § 1º): um dia de expediente reduzido ou de indisponibilidade conta normalmente no meio do prazo. Se for o dia do começo ou o do vencimento, o prazo passa para o dia útil seguinte. Sem a indisponibilidade, o vencimento seria 10/11/2026.

[ ] Certo  [ ] Errado. Vencimento correto: ____/____/______ Motivo: ______________________________

## Caso 10. Prazo em dobro (Fazenda Pública) na Justiça Federal, atravessando dezembro

- **Intimação:** publicação no DJe do TRF4, disponibilizada em **09/11/2026** (segunda).
- **Prazo:** 15 dias úteis em dobro, ou seja, 30 dias úteis (CPC, art. 183). O dobro é marcado pelo advogado, não é automático.
- **Vencimento calculado:** **26/01/2027** (terça).
- **Memória do cálculo:**
  > 15 dias úteis em dobro (30 dias), Cível (CPC). Disponibilizado no DJe em 09/11/2026, publicado em 10/11/2026. A contagem começa em 11/11/2026. Fora da contagem, além dos fins de semana: 20/11 (Consciência Negra), 08/12 (Nossa Senhora da Conceição), 20/12 a 20/01 (recesso de 20/12 a 20/01). Vence em 26/01/2027.

[ ] Certo  [ ] Errado. Vencimento correto: ____/____/______ Motivo: ______________________________

---

## Perguntas em aberto

1. **Juizados especiais e recesso.** Hoje o sistema **não** suspende os prazos dos juizados de 20/12 a 20/01 (a suspensão pode ser ligada em cada prazo). Os juizados do TJRS suspendem os prazos no recesso? [ ] Sim [ ] Não [ ] Depende: ____________
2. **Publicação no DJe durante o recesso.** Se a disponibilização acontece em 21/12, o sistema considera a publicação em 22/12 e começa a contar em 21/01. O certo é começar em 21/01 ou em 22/01? ____________
3. **Feriados forenses do TJRS.** Quais dias, além dos nacionais e do 20/09, o TJRS fecha (ou suspende os prazos) em 2026 e 2027? Há um ato que liste todos? ____________
4. **Margem do prazo interno.** Dois dias úteis antes do vencimento é uma boa margem padrão? ____________
5. **Lembretes.** Três dias úteis antes, um dia útil antes e no dia, às 9h, contados do prazo fatal. Está bom? ____________

Quem respondeu: ______________________ OAB: ____________ Data: ____/____/______
