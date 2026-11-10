Tempestivo é o assistente no WhatsApp que não deixa o advogado autônomo perder prazo. Ele recebe a intimação, calcula o vencimento mostrando como chegou na data, só grava depois do "sim", lembra antes do vencimento e manda toda manhã o que vence e as audiências do dia.

Este manual vale para o app, o agente no WhatsApp, o site e qualquer peça de divulgação.

## Essência

- **Promessa:** nenhum prazo passa em branco.
- **Para quem:** o advogado que trabalha sozinho, sem equipe e sem sistema caro, e que já vive no WhatsApp.
- **Como entrega:** na conversa, sem precisar abrir um sistema; com o cálculo à vista; pedindo confirmação antes de gravar.
- **Personalidade:** um colega de escritório atento. Preciso, calmo e breve. Nunca alarmista, nunca informal demais.

### O nome

"Tempestivo" é o termo técnico para o ato praticado dentro do prazo. É a palavra que o advogado usa quando o recurso foi aceito a tempo, e é exatamente o que o produto entrega.

- Em texto corrido, escreva **Tempestivo**, com inicial maiúscula.
- No logotipo, o nome aparece em minúsculas: **tempestivo**.
- Não abrevie, não use "Tempestivo App" nem "TPV", e não flexione ("Tempestiva" é outra palavra).

## Voz e tom

O Tempestivo escreve como fala com um advogado ocupado no meio do dia: frases curtas, a informação mais importante primeiro, termos jurídicos corretos e nada de juridiquês decorativo.

**Regras**

- Comece pelo que importa: o processo, o prazo e a data. Explicação vem depois, se vier.
- Use os termos certos: prazo fatal, prazo interno, intimação, disponibilização, dias úteis. Não invente sinônimos ("data limite final").
- Datas sempre no formato `dd/mm` dentro do mesmo ano, e `dd/mm/aaaa` quando mudar de ano. Dias da semana ajudam: "sexta, 22/01".
- Trate o advogado por "você". Sem "Dr." nem "prezado".
- O Tempestivo calcula e lembra; quem decide é o advogado. Nunca escreva "garantido", "sem erro" ou "pode confiar". Escreva "confira o vencimento".
- Peça confirmação com uma pergunta fechada: "Responda *sim* para registrar." Nas mensagens do WhatsApp, o *sim* vai entre asteriscos simples, que o WhatsApp mostra em negrito. Em outras peças (site, app), use negrito normal.
- Erros dizem o que aconteceu e o que fazer: "Não achei esse número na sua conta. Quer que eu cadastre o processo?"
- Sem emoji, sem exclamação em sequência e sem travessão. Use ponto e vírgula.
- Segredo de justiça: nas mensagens, só o nome e o número do processo, nunca a parte contrária.

**Exemplos**

| Situação | Assim | Assim não |
|---|---|---|
| Prévia de intimação | Prazo de 15 dias úteis em Cobrança de aluguéis: vence quarta, 02/12 (prazo interno 30/11). Responda *sim* para registrar. | Olá, Dr.! Identifiquei uma nova intimação e calculei o prazo para você! 🎉 |
| Resumo das 8h | Hoje: 1 prazo vence (Contestação, Reclamação trabalhista) e 1 audiência às 14h na Vara do Trabalho. Nada atrasado. | Bom dia!!! Aqui está o seu resumo diário completo de atividades. |
| Lembrete D-1 | Amanhã vence o prazo fatal de Recurso em Aposentadoria por idade. | ATENÇÃO!!! PRAZO VENCENDO!!! |
| Dúvida na regra | Esse processo corre na vara comum ou no juizado? A contagem muda no recesso. | Não foi possível determinar o rito processual. |

## Cores

O Tempestivo é sóbrio por padrão e usa cor para dizer alguma coisa.

- Fundo de tela em `surface`; cartões e janelas em `surface-raised`, separados por borda `line`, sem sombra.
- Texto em `ink`; metadados em `ink-muted`.
- `petroleo` é a cor da marca: símbolo, botão principal, links e item ativo do menu. Texto sobre ele em `on-petroleo`.
- `marca-texto` é o grifo do vencimento. Use só como fundo atrás da data que importa, com texto `on-marca-texto`, uma vez por bloco. Nunca em botões, títulos ou áreas grandes. Ele imita o marca-texto amarelo que o advogado passa na data da intimação impressa.
- Os estados do prazo usam três cores, sempre com uma palavra junto:
  - `fatal` e `fatal-soft`: prazo fatal vencido ou que vence hoje;
  - `interno` e `interno-soft`: prazo interno vencido, ainda dentro do fatal;
  - `no-prazo` e `no-prazo-soft`: prazo em dia ou cumprido. É azul, e não verde, para quem não distingue vermelho e verde.
- O foco do teclado usa `foco`, 2px sólido com 2px de afastamento.
- Não use degradês. Não use o verde do WhatsApp como cor da marca.

Todo texto atinge pelo menos 4,5:1 de contraste nos dois temas, nas combinações descritas em cada cor.

## Tipografia

- **Bricolage Grotesque** (`display`, `titulo`, `subtitulo`) para títulos e para o logotipo. Ela tem personalidade sem perder a seriedade; use com moderação, nunca em texto corrido.
- **IBM Plex Sans** (`corpo`, `corpo-pequeno`, `rotulo`) para todo o resto.
- **IBM Plex Mono** (`dado`, `memoria`) para o que o advogado confere dígito a dígito: número CNJ, datas de vencimento, valores e a memória do cálculo. Números alinhados evitam erro de leitura.
- Rótulos em maiúsculas com `rotulo` e um pouco de espaçamento entre letras.
- As três famílias vêm do Google Fonts. Fora da web, use as mesmas famílias instaladas.

## Espaço e forma

- Espaçamento em múltiplos de 4px, de `space-1` a `space-12`. Margem lateral mínima de `space-4` no celular.
- Cantos: `radius-sm` em selos e campos, `radius-md` em botões e cartões, `radius-lg` em balões e janelas. O quadrado do símbolo usa a mesma proporção de `radius-lg`.
- Sombra só em janelas que flutuam (`shadow-janela`). Cartões são separados por borda.

## Logotipo

O símbolo é um "t" minúsculo dentro de um quadrado de cantos arredondados, com um ponto em `marca-texto` no fim da barra: o prazo cumprido, marcado. O logotipo completo é o símbolo seguido do nome **tempestivo** em Bricolage Grotesque 600.

- **Arquivos:** `tempestivo-simbolo.svg` (cores da marca, para fundos claros), `tempestivo-simbolo-escuro.svg` (para fundos escuros) e `tempestivo-simbolo-mono.svg` (uma cor, para carimbo, papel timbrado e gravação).
- **Área de proteção:** em volta do logotipo, deixe livre pelo menos a altura do ponto amarelo multiplicada por dois.
- **Tamanho mínimo:** símbolo com 24px na tela e 8mm impresso. Abaixo disso, use só o símbolo, sem o nome.
- **Não faça:** trocar as cores do símbolo, girar, esticar, contornar, aplicar sombra, colocar sobre foto sem área de cor sólida, ou mudar a fonte do nome.
- O nome do logotipo ainda é composto com a fonte. Antes de imprimir em grande escala, um designer deve converter o logotipo completo em curvas.

## Iconografia

- Ícones do conjunto **Phosphor**, peso regular, o mesmo que o app já usa. Tamanho 20px na interface e 16px dentro de selos.
- Ícones de referência: balança para processo, maleta para caso consultivo, pessoas para clientes, sol para Hoje, calendário para prazos.
- Ícone sozinho só quando o significado é óbvio; nos estados de prazo, ícone sempre acompanha a palavra.
- Sem emoji na interface e nas mensagens.

## Aplicações

- **WhatsApp:** foto do perfil do agente com `tempestivo-simbolo.svg`. Nome do contato: "Tempestivo". As mensagens seguem a seção Voz e tom.
- **App:** símbolo no menu lateral, nome em `subtitulo`. O aviso de contagem em validação aparece em `interno-soft` com texto `interno`.
- **Peças de divulgação:** fundo `surface` ou `petroleo`, título em `display`, uma data grifada com `marca-texto` como elemento de destaque.
