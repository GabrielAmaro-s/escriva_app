# SeloPrazo

O estado de um prazo, numa palavra e numa cor, ao lado do título da tarefa ou no cartão do processo.

- Estados: **Fatal vencido** e **Vence hoje** em `fatal` sobre `fatal-soft`; **Interno vencido** em `interno` sobre `interno-soft`; **No prazo** em `no-prazo` sobre `no-prazo-soft`.
- Texto em `rotulo`, cantos `radius-sm`, padding `space-1` por `space-2`.
- A palavra é obrigatória: a cor sozinha nunca diz o estado.
- Quem usa fornece o estado e, se quiser, os dias até o fatal ("3 dias").
