# Importação do histórico da planilha

Traz para o banco os nove meses de produção que estão na planilha
`ITAJAI - CONTROLE DE PRODUÇÃO 2026.xlsx` (20/12/2025 a 21/09/2026).

Decisões: **D35** e seus complementos D35.1 (devolutivas do gestor), D35.2 e
D35.3 (cruzamento coluna a coluna), em [`../../docs/database/03-decisoes.md`](../../docs/database/03-decisoes.md).

## Os quatro passos

| Passo | O quê | Onde |
|---|---|---|
| 1 | Área de preparo no banco | migration `20260925130000_area_de_preparo_importacao.sql` |
| 2 | Extrair a planilha para a área de preparo | `extrair.cjs` + `mapa.cjs` |
| 3 | Carregar da preparo para a produção | a fazer |
| 4 | Conferência mês a mês | a fazer |

## Por que nada vai direto para a produção

A área de preparo existe para o gestor poder **conferir antes** de qualquer
número virar oficial. Cada linha guarda de qual célula da planilha veio, com o
conteúdo original ao lado da interpretação — então uma divergência sempre pode
ser rastreada até a origem, e a conferência pode discordar.

Além disso: um lote inteiro pode ser desfeito sem tocar no que a equipe
apontou à mão, e rodar a extração de novo não duplica nada.

## Os dois arquivos

**`mapa.cjs`** é onde estão as decisões, em forma de dado: qual coluna da
planilha vira qual centro de trabalho, a data de entrada em operação de cada
um, como ler os rótulos de turno, e o que fazer com as células que têm texto
no lugar de número. Quem quiser conferir uma decisão lê esse arquivo, sem
precisar entender código.

**`extrair.cjs`** é só a mecânica: lê a planilha e aplica o mapa. Ele **não se
conecta ao banco** — o repositório é público e não guarda credencial nenhuma.
A saída é um arquivo `.sql` que alguém roda onde quiser.

## Como rodar

```bash
npm install --no-save exceljs
node supabase/import/extrair.cjs "caminho/para/ITAJAI - CONTROLE DE PRODUÇÃO 2026.xlsx"
```

Gera `supabase/import/preparo.sql` (não versionado — é derivado da planilha) e
imprime um resumo. Depois, rode esse SQL no banco; ele vem dentro de uma
transação, então dá para conferir e desistir com `rollback`.

O id do lote é derivado do nome e do tamanho do arquivo: rodar de novo produz
o mesmo id, e carregar duas vezes é impossível — a chave `(lote, aba, célula)`
recusa a segunda.

## O que a extração produziu (planilha de 21/09/2026)

| | |
|---|---|
| Linhas na área de preparo | 6.859 |
| Apontamentos | 2.506 — **17.618.667 peças** |
| Retrabalhos | 2 |
| Paradas de máquina | 4 |
| Observações sem quantidade | 1 |
| Descartados, com motivo | 4.346 |
| Colunas sem destino | **0** |

Os 4.346 descartes são todos zeros, e o motivo fica registrado em cada um:
zero **anterior** à entrada em operação significa que a máquina não estava em
Itajaí; zero **posterior** significa turno sem produção, sem motivo informado
pela planilha.

**Por que os zeros posteriores não viram parada de máquina** (como a D36
propõe): uma célula zerada não informa motivo nenhum, e criar centenas de
paradas "sem motivo" encheria o sistema de registros que não explicam nada.
Como as linhas ficam na área de preparo com o motivo do descarte, o dado não
se perde — se a D36 for implementada, é só reprocessar a mesma área de preparo.

## Um caso que parece erro e não é

Em 02/09 a Embaladora Horizontal N°1 tem duas linhas para o mesmo dia e turno:
a produção normal (célula `E8`) e um retrabalho (`AB8`, 4.800 peças). Não é
duplicata — é **um apontamento com duas ordens**, uma normal e uma marcada
como retrabalho, que é exatamente como o banco modela isso.
