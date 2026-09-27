# Nota de trabalho — Ligar a UI de `prototype/` ao banco

> Data: 27/09/2026 · Autor: Claude Code · Branch: `claude/ui-oficial-transicao`
> Escrita pelo lado do **banco**, em resposta ao resumo do lado da **interface**.
> Comparação feita contra `origin/main` (PR #22 mesclada) e contra as migrations
> em `supabase/migrations/` — **não** contra o `_consolidado.sql`, ver o aviso no
> fim. Nota de trabalho registra um momento; a fonte da verdade continua sendo
> [`02-referencia-tecnica.md`](../02-referencia-tecnica.md) e
> [`03-decisoes.md`](../03-decisoes.md).

## 1. O banco mudou desde a PR #22

O resumo da interface partia de "o banco não foi alterado nesta rodada". Isso
valia para a `main`; três commits estavam num branch à parte e agora convivem com
a UI nova no mesmo lugar:

| Schema | O que entrou | Decisão |
|---|---|---|
| — | Recuperação de senha por e-mail (Supabase Auth) | D45 |
| `0.18.0` | A meta **por operador** entra no cálculo (migration 0021) | D46 |
| `0.19.0` | **Três bases** de meta + `save_machine_targets` preserva a base (migration 0022) | D47 |

**As duas migrations ainda não foram aplicadas no Supabase.** A sessão que as
escreveu rodava num contêiner na nuvem, e de lá não há caminho até o banco: a
política de rede do ambiente nega o host do projeto no 443, e o pooler resolve
IPv4 mas tem o TCP 5432 descartado em silêncio. Aplicar pelo SQL Editor, **nesta
ordem**:
`20260927100000_meta_por_operador.sql`, depois
`20260927110000_meta_depende_da_lotacao.sql`. Cada uma traz no fim a consulta de
conferência. Enquanto não forem aplicadas, o app se comporta como antes.

## 2. O que o adaptador já pode ler hoje

| Contrato da UI | De onde vem | Situação |
|---|---|---|
| `Machine` (id, name, hasTarget) | `machines` + `current_machine_targets` | pronto |
| `ProductionOrder` (apontamento) | `production_summary` + `production_orders` | pronto |
| `META_CHANGES`, `metaPerShift(id, data)` | `machine_targets` — degraus com vigência | pronto (D13) |
| `DATA_START` / `DATA_END` | `min/max(production_date)` | uma consulta |
| Dias úteis | `calendar_events` — feriado e dia anulado, por turno | existe; a UI ainda usa seg–sex |
| Lotação do posto | `machines.standard_operator_count` | pronto |
| Minutos de turno | `shifts.gross_minutes` / `useful_minutes` | pronto (D42) |

## 3. A meta não é um número plano — e é aqui que a UI nova erra hoje

A UI calcula `target = perShift × regime × dias_úteis`. Cinco regras do banco
ficam de fora:

1. **A base da meta** (D39, D46, D47). A meta cadastrada pode ser lida de três
   formas:

   | Base | O número é | Meta do turno | Onde |
   |---|---|---|---|
   | `per_shift` | a meta do turno | o próprio número | padrão; o ritmo é da máquina |
   | `per_shift_prorated` | a meta com a **lotação padrão** | número × pessoas ÷ lotação padrão | Embaladoras Horizontais N°1 e N°2 |
   | `per_operator` | a meta de **cada pessoa** | número × pessoas | Bancada A Granél |

   Multiplicar a meta cadastrada de A Granél pelos turnos e dias **reintroduz o
   bug que a 0.18.0 consertou**: três pessoas na bancada apareciam como 300% de
   atingimento.

2. **A meta é congelada em cada apontamento** (D08): cada linha guarda a meta e a
   base do seu dia. Meta de um período é **soma**, nunca multiplicação.
3. **Dia anulado e feriado** ficam fora (D16).
4. **Hora extra** fica fora do cálculo de meta (D27).
5. **Degraus de meta**: a meta muda no meio do mês, e o passado continua com a
   meta da época (D13).

**O que o adaptador deve fazer:** somar `effective_target` de
`production_summary`, filtrando `counts_toward_target`. A view já resolve a base,
a lotação, a hora extra e o dia anulado. Atingimento do período:

```
sum(good_quantity) / sum(effective_target)  where counts_toward_target
```

Nunca `perShift × regime × dias`.

A tela de **apontamento** precisa pedir o **nº de operadores** — e só nos dois
postos onde a lotação muda a meta (`per_shift_prorated` e `per_operator`). Nos
outros, perguntar não muda nada e só ocupa quem está apontando. A UI de `src/` já
faz isso, com a conta à vista (`10.000 com 4 · 3 pessoas no turno`); a conta em si
está em `src/lib/metas.ts`, com teste em `src/test/metas.test.ts`.

A tela de **metas** precisa dizer como o número é lido: as etiquetas em uso são
**por pessoa** e **conforme a lotação**.

## 4. As sete lacunas do resumo, conferidas

| # | Lacuna | Veredito |
|---|---|---|
| 1 | `material_code` / `material_description` | **Correto.** `production_orders` só tem `order_number` |
| 2 | `rework_reason` | **Correto.** O banco só tem `is_rework` |
| 3 | OP como entidade + conversa | **Correto.** Não existe nenhuma tabela de OP nem de mensagens |
| 4 | Minutos produtivos | **Parcial.** `shifts.useful_minutes`/`gross_minutes` (D42) e `machine_downtimes` já existem. Falta só o minuto **por OP** — decisão: gravar por OP, ou derivar do turno menos paradas |
| 5 | `line` e `regime` | **Parcial.** `machines.process` só tem `assembly`/`packaging`, e A Granél está como `packaging` — "Granel" pode ser agrupamento de tela, sem coluna nova. Já o **regime de turnos por centro** (2 ou 3) não existe mesmo |
| 6 | Retrabalho conta como produção? | **Correto, e é o mais perigoso.** A UI soma retrabalho na produção; a D11 diz que produção é só a boa. Decisão do gestor **antes** de ligar, senão os números divergem da planilha |
| 7 | Hora extra | **Não bate.** No banco `overtime` é `work_mode` do apontamento, independente do turno; o T3 pode ser turno normal (D42). Amarrar "T3 = hora extra" na tela vai divergir |

## 5. O que o resumo não menciona

- **A UI nova não tem área de acesso.** Nenhuma feature de `prototype/` cobre
  login, recuperação de senha (D45), cadastro e aprovação (D19–D23), crachá da
  conta compartilhada (D23), permissões, usuários, notificações ou auditoria. Sem
  permissões a UI nova não vai para a fábrica, e isso é mais trabalho do que as
  lacunas 1 a 5 juntas. O que já existe pronto para reaproveitar:
  `dataSource.auth`, `my_permissions()` e o `AuthContext`.
- **Adaptador novo × reuso da camada existente.** A D44 decidiu que
  `src/lib/repositories/` é o que fica e é para dentro da UI nova que ele vai. Um
  cliente e um adaptador novos dentro de `prototype/` duplicariam auth, RLS,
  adaptadores e tipos. Complica que o alias `@` de `prototype/vite.config.ts`
  aponta só para `prototype/src`: reaproveitar exige um segundo alias, ou mover a
  camada para uma pasta compartilhada. **Decidir antes de escrever o adaptador.**
- **Escrita não é só inserir:** `save_production_record` **completa** o
  apontamento que já existe (D10, D30), e as regras de edição de 24 h valem (D24).
- **Detalhes que aparecem na primeira tela ligada:** os ids da UI são texto
  (`m1`, `e9`) e no banco são inteiros, com nomes diferentes; e os 2.507
  apontamentos importados não têm autor nem número de OP real (vêm como
  `IMPORTADO`), o que Histórico e OPs vão exibir.

## 6. Ordem sugerida

1. **Aplicar 0021 e 0022** no Supabase, nessa ordem.
2. **Decidir o retrabalho** (lacuna 6) e fechar o **contrato da meta** (seção 3).
   As duas mudam números na tela; decidir depois custa retrabalho de verdade.
3. **Decidir reuso × duplicação** da camada de dados (seção 5).
4. Tipos gerados (`supabase gen types typescript`) e adaptador de leitura:
   Dashboard, Histórico e Relatórios.
5. Migrations das lacunas 1 e 2 (material e motivo de retrabalho).
6. Tabela de OP e mensagens (lacuna 3) — liga OPs, Feedbacks e Modo TV.
7. Escrita: apontamento e correções do Histórico.
8. Área de acesso na UI nova.

## 7. Dois avisos de terreno

- **`supabase/migrations/_consolidado.sql` está desatualizado** (parou na
  `0.13.0`, faltam seis migrations) e o cabeçalho dele diz "não editar à mão" sem
  existir script que o gere. O levantamento de lacunas foi feito lendo esse
  arquivo; para as sete lacunas as conclusões continuam valendo, mas ele não
  serve mais como fonte da verdade. Ou se gera, ou se aposenta.
- **Pendências operacionais** (não são código, e nenhuma é de quem programa):
  liberar as URLs do app em *Authentication → URL Configuration* e configurar
  **SMTP próprio** no Supabase, sem o que a recuperação de senha não entrega
  e-mail; e conferir a **lotação padrão de A Granél**, hoje cadastrada como 1
  pessoa — é o número que o sistema usa quando ninguém informa.
