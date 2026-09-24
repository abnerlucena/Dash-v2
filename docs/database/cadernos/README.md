# Cadernos do banco de dados

Seis PDFs curtos que explicam o banco **em linguagem comum**, com analogias e
diagramas. São material de leitura, não especificação: quem precisa do detalhe
técnico (nomes de colunas, tipos, índices, políticas) continua em
[`../02-referencia-tecnica.md`](../02-referencia-tecnica.md).

| # | Caderno | Assunto |
|---|---------|---------|
| 1 | [Visão geral](01-visao-geral.pdf) | As quatro áreas do banco e o apontamento no centro |
| 2 | [Máquinas e metas](02-maquinas-e-metas.pdf) | A linha do tempo da meta e por que o passado não é reescrito |
| 3 | [Apontamentos, ordens e turnos](03-apontamentos-ordens-turnos.pdf) | Como a produção é registrada; retrabalho e hora extra |
| 4 | [Calendário e paradas](04-calendario-e-paradas.pdf) | Separar "não rodou" de "rodou mal" |
| 5 | [Pessoas e acesso](05-pessoas-e-acesso.pdf) | Perfis, permissões e cadastro pendente |
| 6 | [Avisos, auditoria e segurança](06-avisos-auditoria-seguranca.pdf) | O registro do que aconteceu e quem fez |

Cada caderno marca com `Já existe` / `A construir` o que está pronto no banco e o
que ainda é decisão em aberto, e tem uma seção honesta sobre limitações.

## Como editar

A fonte é o HTML ao lado do PDF. O estilo (fontes, cores, quebras de página, A4)
é comum e fica em `estilo.css` — mexer nele muda os seis.

Depois de editar, gere os PDFs de novo:

```bash
node docs/database/cadernos/gerar-pdfs.cjs
```

Para gerar só alguns, passe o prefixo do arquivo:

```bash
node docs/database/cadernos/gerar-pdfs.cjs 03 05
```

O script usa o Chromium do Playwright, que já é dependência do projeto
(`npm install`). O rodapé com título e número de página é acrescentado pelo
próprio Chromium na impressão, por isso não aparece no HTML.

## Manutenção

Quando uma decisão em aberto (D34, D35, D36) for implementada, o caderno
correspondente precisa ser atualizado junto — a seção "o que vai mudar" vira
"como funciona".
