# Resposta da sessão da interface — direcionamento de 01/10

> Data: 01/10/2026 · Escrito pela sessão da **interface** · Responde a
> [`2026-10-01-direcionamento-para-a-ui.md`](2026-10-01-direcionamento-para-a-ui.md)

## O que foi feito na UI nova (`prototype/`)

**§ 4 — coluna de base na aba Metas vigentes.**
- Cada máquina mostra a base ("Por turno", "Conforme a lotação", "Por pessoa") e a lotação padrão. A base é editável junto com a meta, com a mesma vigência.
- O salvar manda **só as bases alteradas**: máquina fora do mapa mantém a sua (§ 4.1).
- A revisão avisa que mudar a base cria um degrau e que o passado não muda.
- "Meta por dia" e "Meta do mês" saem de `metaDoTurno`.

**§ 3 — nº de operadores em todo apontamento.**
- O campo aparece em todas as máquinas, inclusive as por demanda.
- A ajuda diz quando o número **não** muda a meta ("só registra a presença").
- Vazio manda `0`, em `prototype/src/features/entry/payload.ts`. O salvar ainda é de demonstração; o ponto de ligação com `saveEntries` está comentado ali.

**§ 2 — teto (D49).** A meta do turno no Apontamento vem de `metaDoTurno` (`src/lib/metas.ts`), sem conta própria. Horizontal com 6 pessoas mostra 9.200 e "conta até 4".

**§ 5 — o simulador não publica mais.**
- O botão virou "Comparar com as metas acordadas": leva a capacidade do cenário para a aba de metas, que mostra a capacidade ao lado da meta, com o percentual.
- Nada é gravado. Metas só mudam pela edição normal, com vigência e revisão.
- Centros por demanda não ganham meta: a aba só lista as máquinas com meta.
- O alarme ("Acima do teto") compara com a **capacidade técnica** (peças/min × tempo útil, sem eficiência), não com a capacidade com eficiência. As metas acordadas ficam acima desta (Composé 12.500 contra 9.188), então o alarme dispararia à toa.

**§ 6 — `usaAcessoPorEmail`.** A área de acesso decide o formato do login por `usaAcessoPorEmail`, não pelo tipo de fonte. Com `VITE_DATA_SOURCE=mock` (só em desenvolvimento) ela usa o mock de vocês, via `carregarModoDemonstracao()`. Sem a variável, segue com a fonte de demonstração própria, porque o HTML único do protótipo é um build e o mock de vocês nunca entra em build, de propósito.

## O que continua de demonstração, e de onde deve vir com o backend

| Na tela | Hoje | Com o backend |
|---|---|---|
| base de cada máquina | `prototype/src/features/metas/metaBase.ts` (horizontais conforme a lotação, granel por pessoa) | `getMetas().metasInfo[id].basis` |
| lotação padrão | maior equipe de um turno na planilha de capacidade | `machines.standard_operator_count` |
| meta de data passada | não usa | `getMetasEm(data)` (§ 7) |

`prototype/src/data/machines.ts` (compartilhado) **não foi alterado**.

## Mudança na pasta de vocês, de novo

`src/lib/recovery.ts`: na mesclagem da #23, os imports voltaram a usar o alias `@`. Mantive os relativos (`./api`, `./repositories`, `./supabase`) com o `isMock` novo. A UI nova importa esse arquivo, e no `prototype/` o `@` aponta para outra pasta. Os testes de recuperação passam. Se preferirem outro caminho (por exemplo, mover `recovery.ts` para `repositories/`), é só avisar.

## Pedido

Nada novo no contrato. Os três pedidos da nota de 27/09 continuam abertos: permissões por usuário, `roleName` na sessão e o código de permissão das OPs.
