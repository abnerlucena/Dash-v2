# Ata de Mudanças do Schema

Toda mudança no banco de dados é registrada aqui, da mais recente para a mais antiga.
Formato de cada entrada:

```
## [versão] — dd/mm/aaaa — Título curto
- Status: Desenhado | Implementado | Em produção
- Commit/PR: <hash curto ou link do PR>
- Migration: supabase/migrations/<arquivo>.sql (quando houver)
- Decisões: Dxx, Dyy
### Adicionado / Alterado / Removido
- ...
### Impacto no frontend
- ...
```

---

## [0.17.1] — 26/09/2026 — Recuperação de senha por e-mail
- Status: **Implementado** no app. **Falta a configuração no painel do Supabase** (só o dono do projeto pode fazer) — ver "O que ainda falta" abaixo.
- Commit/PR: branch `claude/ui-oficial-transicao`
- Migration: **nenhuma — o schema não mudou.** A versão sobe só para registrar a mudança de configuração do projeto; quem conferir o banco não vai achar diferença nenhuma em relação à 0.17.0.
- Decisões: D45 (nova), D44.1 (item 4 — era o único bloqueio para usar o sistema)

### O que mudou
Quem esquecia a senha no modo Supabase não tinha saída: a tela dizia "fale com o
administrador", e o administrador também não podia fazer nada — o Supabase Auth
guarda só o hash da senha. Agora existe recuperação por e-mail, usando o que o
Supabase Auth já oferece (`resetPasswordForEmail` + `updateUser`): **sem tabela,
função ou coluna nova**.

### Impacto no frontend
- `src/lib/repositories/types.ts` — a interface de dados ganha `requestPasswordReset` e `setNewPassword`.
- `src/lib/repositories/supabase/auth.ts` — implementa as duas.
- `src/lib/repositories/gas.ts` — responde com "fale com o administrador": no Apps Script não há e-mail.
- `src/pages/LoginPage.tsx` — o cartão passa a ter quatro telas (entrar, criar conta, pedir o e-mail, definir a senha nova) e um link "Recuperar por e-mail" que só aparece no modo Supabase.
- `src/lib/recovery.ts` (novo) + `src/main.tsx` — tratam a chegada pelo link antes de a tela montar. O app usa `HashRouter`, e o token do Supabase vem no hash, que é onde mora a rota: sem isso o link cairia na página "não encontrada". Testes em `src/test/recovery.test.ts`.

### O que ainda falta (painel do Supabase, não versionável)
1. **Authentication → URL Configuration:** incluir em *Site URL* e *Redirect URLs* os endereços do app (`http://localhost:8080/Dash-v2/*` e a URL publicada). Fora da lista, o Supabase devolve o link **sem** token e a tela mostra "o link expirou ou já foi usado".
2. **Authentication → Emails → SMTP próprio:** o e-mail embutido do Supabase é de teste — poucos envios por hora e, em projetos novos, entrega só para os endereços da equipe do projeto. **Enquanto não houver SMTP, a recuperação não serve para a fábrica.**
3. Opcional: traduzir o template *Reset Password* para português.

---

## [0.17.0] — 26/09/2026 — Histórico carregado
- Status: **Implementado** — aplicado no Supabase (projeto de testes) em 26/09/2026. O histórico real está no banco.
- Commit/PR: PR #15
- Migrations: `20260926120000_carga_e_reversao_da_importacao.sql`, `20260926130000_permissoes_novas_alcancam_usuarios.sql`
- Testes: 01 (24/24), 02 (23/23), 03 (9/9), 04 (12/12), 05 (11/11)
- Decisões: D35, D22, D09, D08

### O que entrou no banco
| | |
|---|---|
| Apontamentos | **2.507**, todos marcados com o lote |
| Ordens | **2.508** (2 de retrabalho), todas com o número `IMPORTADO` |
| Peças | **17.627.977** |
| Paradas de máquina | 4, com origem `spreadsheet` |
| Período | 20/12/2025 a 21/09/2026 |

Os 842 apontamentos de demonstração foram removidos antes (`99_remover_demo.sql`),
porque colidiam em 491 chaves com o histórico real.

### Corrigido: permissão nova não alcançava quem já estava aprovado
A 0.14.0 concedeu `import.review` e `import.manage` aos **papéis**, o que
parecia bastar. Mas `user_permissions` é uma **tabela**, não uma view: quando
alguém é aprovado, as permissões do papel são copiadas para ele. Os 5 usuários
do banco ficaram com zero permissões de importação e ninguém conseguiria rodar
a carga.

A cópia existe de propósito — é ela que permite dar ou tirar uma permissão de
**uma** pessoa sem mexer no papel. O preço é que toda permissão nova precisa
ser distribuída a quem já existe. Nasce daí a função
`sincronizar_permissoes_dos_papeis()`, para não ser preciso lembrar disso na
próxima vez.

### Quem pode carregar
`pode_importar()`: quem tem `import.manage`, **ou** o dono do banco quando
ainda não há ninguém logado. Sem a segunda parte haveria um nó — um sistema
recém-instalado não tem usuário nenhum, e seria preciso ter dados para criar o
usuário que carrega os dados. Mesmo caminho que a `bootstrap_admin` já usava.
Quem entra pelo app nunca é o dono, então a exigência de permissão continua
valendo para todo mundo.

### Dois testes ajustados (nenhum era regressão)
- `Admin identifica crachá 201` comparava com **18 permissões** escritas na mão; as duas novas de importação levaram o Admin a 20. Passou a comparar com o que o papel realmente tem.
- `apagar lote leva as linhas junto` contava a tabela inteira de preparo, que agora tem 6.859 linhas reais. Passou a contar só o lote do próprio teste.

### Como desfazer
`select public.reverter_lote_importacao('<lote>')` apaga os 2.507 apontamentos,
as ordens (em cascata) e as 4 paradas, e devolve a área de preparo ao estado
de conferência. **Nada apontado por pessoa é tocado** — é para isso que existe
a marca `import_batch_id`.

## [0.16.0] — 26/09/2026 — Carga e reversão da importação
- Status: **Implementado** — aplicado em 26/09/2026
- Commit/PR: PR #15
- Migrations: `20260926110000_meta_retroativa.sql`, `20260926120000_carga_e_reversao_da_importacao.sql`
- Testes: `supabase/tests/05_carga_importacao.sql` — 11 casos, 11 passando
- Decisões: D35 (itens 6, 7 e 12), D09, D08

Passo 3 de 4 da importação.

### Adicionado
- `carregar_lote_importacao(lote)` — transforma a área de preparo em produção, tudo ou nada. Exige `import.manage`.
- `reverter_lote_importacao(lote)` — desfaz o lote sem tocar no que foi apontado à mão.
- `planilha_retroativa` como quarta origem de meta: a **primeira** meta conhecida do centro, puxada para trás. São 89 apontamentos que antes caíam na meta de hoje — a A Granél em dezembro passa a ser medida por 15.000, que era a meta da época, e não por 25.000.

### Alterado
- `machine_downtimes.source` passa a aceitar `spreadsheet`. Troca que só amplia; `manual` e `sfm` continuam valendo.

### Como o apontamento importado nasce
- **Sem autor.** Ninguém o apontou. Pela regra da 0.10.3, apontamento sem autor só pode ser alterado por quem tem permissão de editar qualquer apontamento — o desejado para dado histórico.
- **Com a origem na planilha** em `source_ref` (ex.: `JUN 26!F12`) e a marca do lote em `import_batch_id`.
- **Com ordem `IMPORTADO`**, que não é uma OP de verdade: a planilha nunca registrou número de OP e não vai registrar até o sistema entrar em produção (D35 item 12).

### O que o ensaio produziu
| | |
|---|---|
| Apontamentos | 2.507 |
| Ordens | 2.508, sendo 2 de retrabalho |
| Peças | 17.627.977 |
| Paradas de máquina | 4 |

Os 2.507 saem de 2.508 linhas da preparo menos uma agrupada: em 02/09 a
Horizontal N°1 tem produção e retrabalho no mesmo turno, e isso vira **um
apontamento com duas ordens** (D09), não dois apontamentos.

### Bloqueio conhecido antes de carregar de verdade
Os 842 apontamentos de demonstração ocupam de 21/08 a 19/09 e colidem em
**491** chaves com o histórico real. É preciso rodar
`supabase/seed/99_remover_demo.sql` antes da carga.

## [0.15.0] — 26/09/2026 — A meta na área de preparo
- Status: **Implementado** — aplicada no Supabase (projeto de testes) em 26/09/2026
- Commit/PR: PR #15
- Migration: `supabase/migrations/20260926100000_meta_na_area_de_preparo.sql`
- Decisões: D35 (item 9), D08

Parte do passo 3 da importação. Cada apontamento guarda a meta que valia no
seu dia (D08), e o importado não é exceção — mas a planilha só traz meta em
**37%** das linhas, e só para **8 das 23 colunas**.

### Adicionado
- `import_rows.target_quantity` e `import_rows.target_source`, com índice por lote e origem.

### A regra de três níveis (decidida em 26/09/2026)
| Origem | Apontamentos | O que significa |
|---|---|---|
| `planilha` | 927 | a meta escrita naquela linha |
| `planilha_arrastada` | 685 | a última meta conhecida do centro, arrastada para a frente (D35 item 9) |
| `meta_de_hoje` | 896 | a planilha nunca trouxe meta para este centro |

O nível 3 foi escolhido pelo usuário **sabendo do custo**: meses antigos passam
a ser julgados por uma meta que ainda não existia na época. Por isso a origem
fica registrada — sem ela, daqui a seis meses ninguém saberia separar o que a
planilha dizia do que foi emprestado de hoje.

### Um erro de agrupamento, encontrado e corrigido
A primeira versão do extrator atribuía metas à máquina errada: a **Rebitagem
Pinos** recebia 20.000 (a meta do Kit Parafuso) e as **Conjuntos** recebiam
7.000 (a das Vertical Placas). Teria feito a Rebitagem Pinos aparecer com 0,05%
de atingimento.

A causa: a planilha usa **dois padrões** para a coluna "<== META". Nas
embalagens a linha 4 nomeia um grupo e a meta vale para o grupo inteiro
(CONJUNTOS, HORIZONTAIS, PLACA + SUPORTE, MÓDULOS, A GRANEL); nas montagens
cada máquina tem a sua própria coluna de meta ao lado, e a linha 4 dela é o
próprio "<== META". O extrator tratava tudo como o primeiro caso.

Depois da correção, os 8 centros com meta na planilha são exatamente os que uma
análise independente tinha encontrado, e `927 + 685 = 1.612` bate com a
contagem feita por fora. Conjuntos, Rebitagem Pinos, Kit 1 Parafuso, Máquina
Interruptor e Manual Interruptor voltaram a não ter meta nenhuma — que é a
verdade.

## [0.14.0] — 25/09/2026 — Área de preparo da importação
- Status: **Implementado** — aplicada no Supabase (projeto de testes) em 26/09/2026, e já carregada com o histórico extraído da planilha (6.859 linhas na preparo; nada virou produção ainda)
- Commit/PR: PR #15
- Migration: `supabase/migrations/20260925130000_area_de_preparo_importacao.sql`
- Testes: `supabase/tests/04_importacao.sql` — 12 casos, 12 passando
- Decisões: D35 (itens 3, 4, 6 e 7)

**Passo 1 de 4** da importação do histórico da planilha. Cria o lugar onde os
dados ficam para conferência **antes** de virarem produção. A tabela nasce
vazia: esta migration não lê planilha nenhuma.

### Por que uma área de preparo
Gravar direto na produção tiraria quatro coisas: a conferência do gestor antes
de o número virar oficial, a rastreabilidade de cada valor até a célula de
origem, a possibilidade de desfazer um lote inteiro sem tocar no que a equipe
apontou à mão, e a garantia de que rodar a extração de novo não duplica nada.

### Adicionado
- **`import_batches`** — uma rodada de importação. É a unidade que se carrega e se desfaz. Estados: `draft` (extraído, em conferência) → `loaded` → `reverted`; `failed` guarda uma carga que deu errado.
- **`import_rows`** — uma linha por célula da planilha que significa alguma coisa, com a origem (`source_sheet`, `source_cell`, `raw_value`) e a interpretação lado a lado, para a conferência poder discordar. `kind` diz no que a célula vira: `production`, `rework`, `downtime`, `note` ou `discard`.
- **`production_records.import_batch_id`** e **`production_records.source_ref`** — a marca que separa o que veio da planilha do que uma pessoa apontou. Sem ela não há como desfazer a importação com segurança. Nulo = apontado à mão, que é o caso dos 842 registros atuais.
- **Duas permissões**, separadas de propósito para quem confere não precisar poder carregar: `import.review` (gestor e admin) e `import.manage` (só admin).
- Três índices em `import_rows` (por status, por tipo e para a conferência) e um índice parcial em `production_records`, que só cobre o que veio de importação.

### Regras que o banco impõe
- Uma célula da planilha **só pode aparecer uma vez no mesmo lote** — é o que impede a extração de contar o mesmo número duas vezes.
- Linha que vira produção **precisa** de máquina, data, turno, quantidade e tipo de trabalho.
- Linha descartada **precisa** de motivo escrito.
- Apagar o lote **leva as linhas junto**: um lote pela metade seria pior do que nenhum lote.

### Removido
- Nada.

### Impacto no frontend
- **Nenhum.** A área de preparo não aparece em tela nenhuma e é invisível para operador, preparador, distribuidor e TV — testado.

### Descoberto nos testes
A conta **Admin das fixtures é compartilhada**, e `has_permission` só concede
permissão a conta compartilhada quando há alguém identificado na sessão. O
primeiro teste falhava por isso, não por erro da migration. O arquivo passou a
promover uma conta normal a admin, e a razão está comentada lá.

## [0.13.0] — 25/09/2026 — As metas reais
- Status: **Implementado** — aplicada no Supabase (projeto de testes) em 25/09/2026
- Commit/PR: PR #15
- Migration: `supabase/migrations/20260925120000_metas_reais.sql`
- Seed: `supabase/seed/01_estrutural.sql` — bloco de metas reescrito
- Testes: 01 (24/24), 02 (23/23), 03 (9/9)
- Decisões: D38, D39, D13

Parte **3 de 3** da adequação ao desenho real da fábrica. Fecha o estado
transitório deixado pela 0.12.0.

### Adicionado
- **21 degraus novos** na linha do tempo de metas, com vigência de hoje: 12 com as metas reais e 9 com zero (o décimo centro por demanda já estava zerado, e a guarda corretamente não criou degrau à toa).

| Centro | Meta por turno |
|---|---|
| Embaladora Horizontal N°1 e N°2 | 10.000 |
| Embaladora 4x2 Suportes/Placas N°1 e N°2 | 7.500 |
| Embaladora Vertical Módulos N°1 e N°2 | 13.000 |
| Embaladora Vertical Conjuntos N°1 e N°2 | 5.000 |
| Bancada Embalagem A Granél | **25.000 por pessoa** |
| Máquina de Tomadas Composé – AUMAQ | 12.500 |
| Máquina de Plugue Slin – AUMAQ | 6.500 |
| Máquina de Interruptores Composé N°1 | 4.500 |

### Alterado
- Nada. **Nenhuma meta foi sobrescrita**: cada valor novo é um degrau com a data em que passa a valer. Os 16 valores de reserva antigos (150 a 600) continuam na tabela como histórico — é o que impede o passado de ser reescrito. [D13]
- `machine_targets` passa de 18 para 39 linhas; `current_machine_targets` mostra os 22 centros ativos.

### Removido
- Nada. Nenhum apontamento tocado: cada um guarda a meta que valia no seu dia.

### Testes ajustados (três estavam presos a dados do seed antigo)
Nenhum era regressão — todos assumiam o cadastro de 18 máquinas:
- `máquina duplicada recusada` tentava criar `'horizontal 1'`, nome que deixou de existir. Passou a usar um centro atual em minúsculas, o que também prova que a proteção ignora maiúsculas (D02).
- `metas: só a que mudou` contava com a meta 500 do seed. Passou a definir valores conhecidos antes de testar.
- `op1 lê máquinas e metas vigentes` tinha `count(*) = 18` fixo. Passou a conferir o que realmente importa: a view devolve **uma linha por máquina com meta**, sem duplicar.

### Impacto no frontend
- As metas nas telas passam a ser as reais. A diferença é grande: a Horizontal 1 sai de 500 para 10.000.
- **A Granél ainda não é calculada certo.** A base `per_operator` está gravada, mas o cálculo de atingimento continua tratando a meta como fixa do turno. Enquanto isso não for implementado, ela aparece com meta 25.000 em vez de 25.000 × operadores. Pendência conhecida, não é regressão.

### O que ainda falta
Os **degraus do passado**. A planilha de produção mostra metas menores antes (horizontais 8.000, placas 7.000, a granel 15.000). Sem eles, os meses antigos seriam medidos com a meta de hoje. Entram junto com a importação do histórico (D35).

## [0.12.0] — 25/09/2026 — Os 22 centros de trabalho reais
- Status: **Implementado** — aplicada no Supabase (projeto de testes) em 25/09/2026
- Commit/PR: PR #15
- Migration: `supabase/migrations/20260925110000_centros_de_trabalho_reais.sql`
- Seed: `supabase/seed/01_estrutural.sql` — bloco de máquinas reescrito
- Decisões: D37, D38 (só a marca "tem meta"), D40, D41, D42, D43

Parte **2 de 3** da adequação ao desenho real da fábrica. Não altera schema:
preenche os campos criados na 0.11.0 e acerta o cadastro de centros.

### Alterado
- **Turnos** ganham horário e tempo útil: T1 04:55–14:18 (558 bruto / 493 útil), T2 14:18–23:24 (546 / 481), T3 23:24–05:00 (336 / 271). Horário e tempo útil **não fecham por subtração** de propósito — no T1, 04:55 às 05:00 é entrada e preparação. [D42]
- **17 centros renomeados no lugar**, preservando o `id` e portanto o histórico de apontamentos. Dois deles seguem a D43: `MONTAGEM DIVERSOS` → `BANCADA N°3 - DIVERSOS` é o id 15, e `BANCADA N°4 - DIVERSOS` é o id 11.
- Todos os centros ganham **processo**, **peças por minuto**, **eficiência** e **lotação** (a do 1º turno).
- **`has_target`** passa a refletir a D38: 12 centros cobrados por meta, 10 por demanda (todos em montagem).
- `FECHAMENTO TECLA INTERRUPTORES` (id 18) fica **inativo** — o centro foi renomeado e readequado na fábrica. Nunca apagado: o histórico da planilha aponta para este id. Não havia apontamento para mover (zero registros). [D43]

### Adicionado
- **5 centros que existiam na fábrica e nunca foram cadastrados:** Embaladora Vertical Conjuntos N°1 e N°2, Máquina de Plugue Slin – AUMAQ, Bancada N°5 – Eletrônicos e Prensa Tox.
- **7 centros planejados** (`status = 'planned'`), previstos ou comprados e sem funcionamento real. Ficam fora da tela de apontamento e de todos os indicadores. [D41]

### Removido
- Nada. Nenhuma máquina apagada, nenhum apontamento tocado, nenhuma meta alterada.

### Como fica
| | |
|---|---|
| Centros ativos | **22** — 13 montagem + 9 embalagem |
| Cobrados por meta | 12 |
| Por demanda | 10 (todos em montagem) |
| Planejados | 7 |
| Inativos | 1 |

### Impacto no frontend
- **Os nomes das máquinas mudam nas telas.** É a mudança mais visível: quem estava acostumado com "HORIZONTAL 1" passa a ver "EMBALADORA HORIZONTAL N°1". Os nomes agora são os que a fábrica usa.
- A lista de apontamento passa de 18 para 22 opções; os 7 planejados **não** aparecem.
- Os 10 centros por demanda saem do cálculo de atingimento e continuam somando na produção total.

### Estado transitório (some com a parte 3)
Três centros novos que são cobrados por meta — Conjuntos N°1, Conjuntos N°2 e Plugue Slin — ficam **com `has_target` e sem meta** até a parte 3 rodar. Os outros nove seguem com as metas de reserva antigas. Rodar a parte 3 em seguida.

### Cuidado de ordem, resolvido
A migration é uma **transformação guardada**: só age se os nomes do legado estiverem presentes. Num projeto novo, quem cria os 30 centros já com o nome certo é o seed. Sem essa guarda, um projeto novo rodando o consolidado **e** o seed terminaria com 30 máquinas erradas. O seed também passou a checar nome além de id, para não esbarrar no índice de nome único quando rodado depois da migration.

Testado em transação desfeita: migration + seed **três vezes seguidas** dão sempre 30 centros (22 ativos, 7 planejados, 1 inativo), com 842 apontamentos e 18 metas intactos e nenhum nome duplicado.

## [0.11.0] — 25/09/2026 — Processo, capacidade, tempo de turno e base da meta
- Status: **Implementado** — aplicada no Supabase (projeto de testes) em 25/09/2026. Dados intactos: 18 máquinas, 18 metas, 842 apontamentos. Suítes 01 (24/24), 02 (23/23) e 03 (9/9) passando.
- Commit/PR: PR #15
- Migration: `supabase/migrations/20260925100000_capacity_process_and_target_basis.sql`
- Testes: `supabase/tests/03_capacidade.sql` — 9 casos, 9 passando
- Decisões: D37, D39, D40, D41, D42

Parte **1 de 3** da adequação ao desenho real da fábrica de Itajaí
(`cadernos/07-mapa-da-fabrica.pdf`). Esta parte só cria campos: não altera
nenhum dado existente. A parte 2 traz os 22 centros de trabalho e a parte 3 as
metas reais.

### Adicionado
- `machines.process` — `assembly` | `packaging`. Aceita nulo por enquanto; a parte 2 preenche. [D37]
- `machines.pieces_per_minute` e `machines.efficiency` — da planilha de capacidade, usados **só como alarme** de meta impossível, nunca para calcular a meta. [D40]
- `machines.started_on` — data de entrada em operação; turnos anteriores a ela não são cobrados da máquina. [D41, D35]
- `shifts.gross_minutes` e `shifts.useful_minutes` — o tempo que realmente produz (T1 558/493, T2 546/481, T3 336/271). Os valores entram na parte 2. [D42]
- `machine_targets.basis` — `per_shift` (padrão) | `per_operator`, para a meta da Bancada A Granel, que é por pessoa. [D39]

### Alterado
- `machines_status_check` passa a aceitar **`planned`** (máquina prevista que ainda não existe na fábrica). É uma troca que só amplia: os quatro valores anteriores continuam válidos e nenhuma linha existente é afetada. [D41]
- Nova restrição `shifts_useful_within_gross`: o tempo útil não pode passar do bruto. Turnos com os campos vazios passam normalmente.
- View `current_machine_targets` passa a expor `basis` (coluna acrescentada no fim, para não mudar a ordem das existentes). [D39]

### Removido
- Nada.

### Impacto no frontend
- **Nenhum agora.** Todas as colunas são opcionais ou têm valor padrão; as 18 metas existentes passaram automaticamente a `per_shift` e continuam se comportando como antes.
- A tela de máquinas ganhará os campos de processo, capacidade e data de entrada quando as partes 2 e 3 entrarem.
- Quando a meta por operador for usada de verdade, o cálculo de atingimento deixa de ser comparação direta: `meta efetiva = quantity_per_shift × operadores do apontamento`, caindo na lotação padrão da máquina quando o apontamento não informar. Ainda **não implementado**.

### Corrigido junto
- `_consolidado.sql` deixava de ser idempotente: rodá-lo num banco com a 0013 aplicada falhava com `cannot drop columns from view`, porque o `create or replace` da 0009 tentava remover a coluna `basis`. Agora a view é derrubada antes de ser recriada (nada depende dela). Verificado rodando o consolidado inteiro em transação desfeita.
- `src/lib/database.types.ts` regerado do banco: 22 linhas acrescentadas, nenhuma removida. `tsc --noEmit` limpo e 9/9 testes do app passando.

### Observação encontrada nos testes
Alterar a `basis` de uma meta **já vigente** é recusado pelo gatilho da D15 ("metas que já entraram em vigor não podem ser alteradas"). A parte 3 terá de inserir um **degrau novo** com a base correta — que é como a linha do tempo de metas deve funcionar mesmo (D13, D34).

## [0.10.3] — 21/09/2026 — Correção: apontamento sem autor

- **Status:** Implementado no Supabase (projeto de testes) em 21/09/2026
- **Commit/PR:** branch `claude/supabase-fase-c-noite` (PR #15)
- **Migration:** `supabase/migrations/20260921101000_fix_edit_rules_null_author.sql`
- **Decisões:** D24

### Corrigido
- `can_edit_production_record` e `can_delete_production_record` devolviam "desconhecido" (`NULL`) em vez de "não" quando o apontamento não tem autor (`created_by` vazio). Como o teste das funções de gravação era "se NÃO pode, recuse", um usuário só com `production.edit_own` conseguia **acrescentar ordens em apontamento sem autor** — por exemplo os de demonstração e, no futuro, os migrados da planilha.
- Agora o resultado passa por `coalesce(..., false)`: apontamento sem autor só é editável/apagável com `production.edit` / `production.delete`.

### Verificação no banco
- Novo teste em `supabase/tests/01_funcoes.sql` ("op1 NÃO completa apontamento sem autor"): **falhava antes** da correção ("deixou!") e passa depois; a gestora continua conseguindo.
- Suítes completas: 24/24 (funções) e 23/23 (RLS). `npm run test:integration`: 7/7. Execução revogada de `anon` mantida.
- Testes SQL ajustados para não depender de o banco estar vazio (agora existe o seed de demonstração).

### Impacto no frontend
- Nenhum na tela; o operador passa a receber a mensagem de "sem permissão" nesse caso.

---

## [0.10.2] — 21/09/2026 — Ver os próprios apontamentos depende de permissão

- **Status:** Implementado no Supabase (projeto de testes) em 21/09/2026
- **Commit/PR:** branch `claude/supabase-fase-c-noite` (PR #15)
- **Migration:** `supabase/migrations/20260921100000_own_records_by_permission.sql`
- **Decisões:** D33 (confirmada), D22, D24

### Alterado
- Política `production_records_select`: a leitura dos próprios apontamentos passa de "qualquer usuário ativo" para "quem tem `production.edit_own`" (via `alter policy`, sem apagar nada). Ligada à permissão, e não ao nome do perfil, para respeitar os ajustes individuais de permissão (D22).
- Com os perfis de fábrica nada muda na prática: só o Operador depende desta regra.

### Verificação no banco
- Novo teste em `supabase/tests/02_rls.sql`: sem `production.edit_own`, o operador deixa de ver os próprios apontamentos.

### Impacto no frontend
- Nenhum.

---

## [0.10.1] — 20/09/2026 — Dados iniciais e script consolidado

- **Status:** Implementado no Supabase em 20/09/2026
- **Commit/PR:** branch `claude/supabase-fase-c-noite`
- **Migration:** nenhuma nova (sem mudança estrutural). Arquivos: `supabase/seed/01_estrutural.sql`, `supabase/seed/90_demo_REMOVER.sql`, `supabase/seed/99_remover_demo.sql`, `supabase/migrations/_consolidado.sql`
- **Decisões:** D13, D28

### Adicionado
- **Seed estrutural (real):** 7 perfis, 18 permissões, 69 ligações perfil × permissão (matriz da seção 8), 18 máquinas com os ids do legado (sequência de ids ajustada para 19+), 18 metas vigentes a partir de 20/09/2026 (valores de `MACHINES_DEFAULT` — conferir com a planilha).
- **Seed de demonstração (fictício, marcado `[DEMO]`):** 842 apontamentos (832 normais + 10 de hora extra no TURNO 3), 1.801 ordens, 1 dia anulado (TURNO 2) e 1 feriado. Carregado com a auditoria desligada só durante a carga, para não deixar dados fictícios no log imutável.
- **Remoção do demo:** `99_remover_demo.sql` (apaga só o que começa com `[DEMO]`).
- **`_consolidado.sql`:** todas as migrations num arquivo idempotente, para colar no SQL Editor.

### Verificação no banco
- Seed estrutural e demo rodados duas vezes: a segunda execução inseriu 0 linhas.
- Contagens por perfil conferem com a matriz (operador 2, preparador 6, distribuidor 9, técnico 15, gestor/admin 18, TV 1).
- `_consolidado.sql` executado sobre o banco já completo: sem erro e sem alterar nada (28 políticas, 842 apontamentos, 3 turnos mantidos).
- Demo: atingimento médio 87,2%; 16 apontamentos em dia anulado (fora da meta); 0 linhas de auditoria geradas.

### Impacto no frontend
- Com a fonte `supabase`, o dashboard passa a ter dados para exibir.

---

## [0.10.0] — 20/09/2026 — Segurança: políticas de acesso (RLS)

- **Status:** Implementado no Supabase em 20/09/2026
- **Commit/PR:** branch `claude/supabase-fase-c-noite`
- **Migration:** `supabase/migrations/20260920170000_enable_rls_policies.sql`
- **Decisões:** D19, D22, D23, D25, D26; D33 (nova, provisória)

### Adicionado
- 28 políticas RLS em 16 tabelas (todas as de `public`). Resumo na seção 7 da referência técnica.
- Leitura de produção: `history.view`, `dashboard.view`, `tv_mode.view` **ou** autor do apontamento (D33).
- Cadastros básicos (turnos, máquinas, metas, calendário, catálogo) legíveis por qualquer usuário **ativo**; pendentes e bloqueados não leem nada além do próprio perfil.
- `notifications`: além da política por linha, privilégio de UPDATE restrito à coluna `read_at`.
- `anon` (visitante não logado): todos os privilégios de tabela e view revogados — segunda tranca além do RLS.
- Testes de verificação versionados em `supabase/tests/` (usuários fictícios, sempre com `rollback`).

### Verificação no banco (22 testes, em transação desfeita)
- Operador vê só os próprios apontamentos/ordens; outro operador não vê; conta TV vê pela permissão `tv_mode.view`.
- Recusados: gravação direta em `production_records`, UPDATE em máquina/perfil sem permissão (0 linhas), autoconcessão de permissão, reescrita do texto de notificação, leitura por `anon`.
- Gestora vê todos os perfis, auditoria e o aviso de novo cadastro; marca como lido.
- Conferência final: **16 tabelas em `public`, 0 sem RLS**.

### Impacto no frontend
- Usuário pendente precisa de uma tela "aguardando aprovação" (ele não enxerga dados).
- O app só funciona logado: não há leitura anônima.

---

## [0.9.0] — 20/09/2026 — Views e funções de regra de negócio

- **Status:** Implementado no Supabase em 20/09/2026
- **Commit/PR:** branch `claude/supabase-fase-c-noite`
- **Migration:** `supabase/migrations/20260920160000_create_views_functions.sql`
- **Decisões:** D08, D10, D11, D12, D16, D22, D23, D24, D27; D30, D31, D32 (novas, provisórias)

### Adicionado
- Views (`security_invoker = true`): `production_summary` e `current_machine_targets`.
- `production_summary` ganhou colunas além do desenho: `shift_name`, `machine_name`, `order_count`, `is_excluded_day` (dia/turno anulado, D16) e `counts_toward_target` (= `work_mode = 'regular'` e dia não anulado). O frontend usa `counts_toward_target` em vez de repetir a regra.
- Funções de apoio: `is_active_user`, `has_permission`, `my_permissions`, `machine_target_on`, `list_profile_names`, `can_edit_production_record`, `can_delete_production_record`, `insert_production_orders` (interna).
- Funções RPC: `save_production_record`, `update_production_record`, `delete_production_record`, `bulk_update_production_records`, `bulk_delete_production_records`, `create_machine`, `save_machine_targets` (nova, para a tela de Metas), `approve_user`, `identify_shared_session`.
- `bootstrap_admin(email)` — ativa o primeiro gestor; só o dono do banco executa (SQL Editor).
- Direito de execução: retirado de `public`/`anon`, concedido só a `authenticated`.

### Verificação no banco (22 testes, em transação desfeita)
- Operador cria apontamento e completa o próprio (ordens acrescentadas); hora extra vira linha separada com `counts_toward_target = false`.
- Recusados com mensagem em português: operador mexendo no apontamento de outro, operador em ação em massa, operador alterando meta, usuário pendente apontando, crachá inexistente, colisão em ação em massa (nada alterado), meta no passado, máquina duplicada, `anon` chamando RPC.
- Conta Admin: sem crachá = 0 permissões; após crachá = 18; outra sessão da mesma conta = 0.
- Metas: só grava a máquina que mudou; correção no mesmo dia atualiza em vez de duplicar.

### Impacto no frontend
- Toda escrita de produção passa pelas RPCs; o app não grava direto nas tabelas.
- Mensagens de erro já vêm em português do banco.

---

## [0.8.0] — 20/09/2026 — Notificações e log de auditoria

- **Status:** Implementado no Supabase em 20/09/2026
- **Commit/PR:** branch `claude/supabase-fase-c-noite`
- **Migration:** `supabase/migrations/20260920105000_create_notifications_audit.sql`
- **Decisões:** D23, D25, D26

### Adicionado
- `notifications` (índice parcial de não lidas + novo índice `(related_table, related_id)`), publicada no Realtime (`supabase_realtime`).
- `audit_logs` com índices `(occurred_at)`, `(table_name, record_id)`, `(actor_id)`.
- Função `current_identified_user_id()` — pessoa identificada por crachá na sessão atual da conta compartilhada.
- Gatilhos: `audit_row_change` em `production_records`, `production_orders`, `machines`, `machine_targets`, `calendar_events`, `calendar_event_shifts`, `profiles`, `user_permissions`; `notify_approvers` e `resolve_approval_notifications` em `profiles`.
- **Novo, além do desenho:** gatilho `prevent_audit_log_changes` (e `prevent_audit_log_truncate`) — recusa UPDATE, DELETE e TRUNCATE em `audit_logs` até para o dono do banco. Garante no banco a frase "nem o Admin consegue apagar esse registro".
- `audit_row_change` ignora UPDATE que não mudou nada.

### Verificação no banco
- Rodada duas vezes sem erro. Simulação de requisição da API (usuário e IP nos cabeçalhos): cadastro gerou aviso para a gestora; ao aprovar, o aviso foi marcado como lido; log com autor e IP `200.1.2.3` (primeiro IP do `x-forwarded-for`).
- Recusados: DELETE e TRUNCATE em `audit_logs`.

### Impacto no frontend
- Sininho de notificações pode assinar o Realtime da tabela (ainda não implementado no app).

---

## [0.7.0] — 20/09/2026 — Calendário

- **Status:** Implementado no Supabase em 20/09/2026
- **Commit/PR:** branch `claude/supabase-fase-c-noite`
- **Migration:** `supabase/migrations/20260920104000_create_calendar.sql`
- **Decisões:** D16, D17, D18

### Adicionado
- `calendar_events` (RLS ligado) com índice `(event_date)` e UQ parcial `calendar_events_brasil_api_date_key (event_date) WHERE source = 'brasil_api'`.
- `calendar_event_shifts` (PK `(event_id, shift_id)`, `ON DELETE CASCADE`, índice `(shift_id)`).
- Regra extra: `description` não pode ser vazia; `created_by` com `default auth.uid()`.
- A importação automática da BrasilAPI (D18) **não** foi implementada nesta versão — só a estrutura que a torna idempotente.

### Verificação no banco
- Rodada duas vezes sem erro. Dois eventos manuais no mesmo dia (um só do TURNO 2, outro do dia inteiro): OK.
- Recusados: dois feriados importados na mesma data, tipo legado `feriado`, descrição em branco.

### Impacto no frontend
- `Holiday.type`: `feriado` ↔ `holiday`, `dia_anulado` ↔ `excluded_day` (adaptador). Eventos manuais do app entram com `scope = 'company'` até a tela ganhar esse campo (pendência).

---

## [0.6.0] — 20/09/2026 — Produção: apontamentos, ordens e paradas

- **Status:** Implementado no Supabase em 20/09/2026
- **Commit/PR:** branch `claude/supabase-fase-c-noite`
- **Migration:** `supabase/migrations/20260920103000_create_production.sql`
- **Decisões:** D05, D08, D09, D10, D11, D12, D27

### Adicionado
- `production_records` com `work_mode` (`regular`/`overtime`, default `regular`) e UQ `production_records_unique_entry (machine_id, production_date, shift_id, work_mode)` — implementa a revisão de D10 feita por D27.
- `production_orders` (`ON DELETE CASCADE` a partir do apontamento) e `machine_downtimes` (sem uso, para o SFM).
- Índices: `production_records (production_date)`, `(shift_id)`, `(created_by)` (novo, para a regra de 24 h); `production_orders (production_record_id)`, `(order_number)`; `machine_downtimes (machine_id, started_at)`.
- Regra extra: `notes` do apontamento com no máximo 500 caracteres (mesmo limite da tela atual).

### Alterado em relação ao desenho
- O índice `(machine_id, production_date)` **não** foi criado: a UQ acima começa pelas mesmas colunas e já atende a busca. Um índice separado seria duplicado (espaço e escrita a mais sem ganho).

### Verificação no banco
- Rodada duas vezes sem erro. Normal + hora extra no mesmo turno coexistem; OP `000001004521` mantém os zeros; apagar o apontamento apaga as ordens.
- Recusados: segundo apontamento `regular` igual, `work_mode = 'extra'`, turno 9, OP com quantidade 0, parada terminando antes de começar.

### Impacto no frontend
- `producao` deixa de ser coluna: é a soma das ordens (view `production_summary`, 0.9.0).
- Tela de apontamento precisa da marcação "hora extra" (D27).

---

## [0.5.0] — 20/09/2026 — Máquinas e histórico de metas

- **Status:** Implementado no Supabase em 20/09/2026
- **Commit/PR:** branch `claude/supabase-fase-c-noite`
- **Migration:** `supabase/migrations/20260920102000_create_machines.sql`
- **Decisões:** D01, D02, D05, D12, D13, D14, D15; D31 (referenciada, registrada na 0.9.0)

### Adicionado
- Tabelas `machines` e `machine_targets`, RLS ligado.
- Índice único `machines_name_lower_key` em `lower(name)` [D02]; UQ `(machine_id, valid_from)` em `machine_targets`.
- Gatilhos: `set_updated_at` (machines), `set_machine_status_updated_at` (novo: grava `status_updated_at` no cadastro e em cada troca de status), `validate_target_valid_from` (INSERT **e** UPDATE: recusa vigência no passado e alteração de meta já vigente).
- `created_by` com `default auth.uid()` (preenchido automaticamente com o usuário logado).

### Verificação no banco
- Rodada duas vezes sem erro. Cadastro de máquina + meta de hoje: OK.
- Recusados: nome repetido com outra caixa ("Teste X"/"TESTE x"), status legado `ativo`, meta com vigência em 16/09 (mensagem em português), meta negativa, id manual sem `OVERRIDING SYSTEM VALUE`.
- Confirmado o fuso: com o servidor já em 21/09 (UTC), o gatilho considerou "hoje" = 20/09 (Brasília).

### Impacto no frontend
- Status passa de `ativo`/`inativo` para `active`/`inactive`/`maintenance`/`preventive_maintenance` (o adaptador converte).
- `defaultMeta` deixa de existir: a meta vem de `machine_targets`.

---

## [0.4.0] — 20/09/2026 — Pessoas: perfis, permissões individuais e conta compartilhada

- **Status:** Implementado no Supabase em 20/09/2026
- **Commit/PR:** branch `claude/supabase-fase-c-noite`
- **Migration:** `supabase/migrations/20260920101000_create_profiles.sql`
- **Decisões:** D19, D20, D21, D22, D23; D29 (nova, provisória)

### Adicionado
- Tabelas `profiles`, `user_permissions`, `shared_account_sessions` (RLS ligado; políticas na 0.10.0).
- Função/gatilho genérico `set_updated_at` (ligado em `profiles`; as próximas tabelas com `updated_at` reutilizam).
- Função/gatilho `handle_new_user` em `auth.users`: cria o `profile` `pending` a partir de `full_name`, `badge_number` e `account_type` (opcional) enviados no cadastro.
- Índices: `profiles (status)`, `profiles (role_id)`, `user_permissions (permission_code)`, `shared_account_sessions (account_id)` e `(identified_user_id)`.
- Regras extras: `full_name` e `badge_number` não podem ser texto vazio.

### Verificação no banco
- Migration rodada duas vezes sem erro.
- Cadastro com crachá → perfil `pending`, `personal`, sem perfil-modelo. Conta `shared` sem crachá → aceita.
- Recusados: cadastro pessoal sem crachá (mensagem "O nº do crachá é obrigatório para contas pessoais.") e crachá duplicado.
- `set_updated_at` sobrescreve `updated_at` em UPDATE. Testes feitos em transação desfeita (nenhum usuário ficou no banco).

### Impacto no frontend
- A tela de cadastro do modo Supabase precisa enviar `full_name` e `badge_number` em `options.data`.
- Contas criadas pelo painel do Supabase (sem metadados) são recusadas — ver D29.

---

## [0.3.0] — 20/09/2026 — Catálogo de acesso (perfis-modelo e permissões)

- **Status:** Implementado no Supabase em 20/09/2026
- **Commit/PR:** branch `claude/supabase-fase-c-noite`
- **Migration:** `supabase/migrations/20260920100000_create_access_catalog.sql`
- **Decisões:** D20, D22; D28 (nova, provisória)

### Adicionado
- Tabelas `roles`, `permissions` e `role_permissions`, todas com RLS ligado (políticas na 0.10.0).
- Regras `CHECK` extras, não previstas no desenho original: `roles.code` só com letras minúsculas e `_`; `permissions.code` no formato `area.acao`; `roles.name` não vazio.
- Índice `role_permissions (permission_code)` para a consulta inversa.
- As linhas do catálogo (7 perfis, 18 permissões) ficam no seed estrutural, não na migration.

### Antes desta versão (D28)
- O banco configurado estava com o schema `public` vazio. As migrations de `shifts` (0.2.0 e 0.2.1) foram aplicadas **sem alteração** neste projeto em 20/09/2026, antes da 0.3.0. Verificado: 3 turnos, RLS ligado, constraints idênticas à migration.

### Verificação no banco
- Migration rodada duas vezes seguidas sem erro (idempotente).
- Recusados como esperado: `roles.code = 'Operador X'`, `permissions.code = 'semponto'`, `role_permissions` com perfil inexistente.

### Impacto no frontend
- Nenhum ainda.

---

## [0.2.2] — 16/09/2026 — Desenho: modo de trabalho (hora extra)

- **Status:** Desenhado (a tabela `production_records` ainda não existe no banco)
- **Commit/PR:** branch `claude/supabase-db-schema-setup-793635`
- **Migration:** nenhuma (mudança de desenho, aplicada quando a tabela for criada)
- **Decisões:** D27 (nova); D10 alterada

### Alterado
- `production_records` ganha `work_mode` (`regular`/`overtime`, default `regular`).
- Unicidade de D10 passa de `(machine_id, production_date, shift_id)` para `(machine_id, production_date, shift_id, work_mode)`, para que trabalho normal e hora extra do mesmo turno coexistam.

### Impacto no frontend
- Tela de apontamento precisa de uma marcação "é hora extra".
- Gráficos de atingimento de meta devem considerar apenas `work_mode = 'regular'`; a produção total continua somando tudo.

---

## [0.2.1] — 16/09/2026 — Carga inicial dos turnos

- **Status:** Implementado no Supabase em 16/09/2026
- **Commit/PR:** branch `claude/supabase-db-schema-setup-793635`
- **Migration:** `supabase/migrations/20260916090000_seed_shifts.sql`
- **Decisões:** D06 (complemento de 16/09/2026)

### Adicionado
- Linhas TURNO 1, TURNO 2 e TURNO 3, todos ativos. O TURNO 3 ainda não é turno regular: hoje recebe apenas hora extra de madrugada, marcada com `work_mode = 'overtime'` e portanto fora do cálculo de meta [D27].
- Horários deixados vazios: são descritivos e não entram em nenhuma regra — o turno de um apontamento vem sempre do `shift_id` informado, nunca do relógio.
- `on conflict (id) do nothing`: rodar a migration duas vezes não duplica nem falha (idempotência).

### Impacto no frontend
- Nenhum ainda.

---

## [0.2.0] — 15/09/2026 — Tabela de turnos

- **Status:** Implementado no Supabase em 16/09/2026 (projeto WEG-ITJ-Tomadas)
- **Commit/PR:** branch `claude/supabase-db-schema-setup-793635`
- **Migration:** `supabase/migrations/20260915120000_create_shifts.sql`
- **Decisões:** D06; D25 passa de "Assumida" para "Aprovada"

### Adicionado
- Tabela `shifts` com RLS habilitado (sem políticas: nenhum acesso pelo frontend até a migration de segurança).
- Regra `CHECK` impedindo nome de turno vazio.

### Impacto no frontend
- Nenhum ainda (o frontend continua usando o Google Apps Script).

---

## [0.1.0] — 14/09/2026 — Desenho inicial do schema

- **Status:** Desenhado (não implementado)
- **Commit/PR:** branch `claude/supabase-db-schema-setup-793635` (commit "docs(database): documentação inicial do schema v0.1.0")
- **Migration:** nenhuma ainda
- **Decisões:** D01–D26

### Adicionado
- Tabelas de produção: `machines`, `shifts`, `production_records`, `production_orders`, `machine_downtimes`.
- Metas e calendário: `machine_targets`, `calendar_events`, `calendar_event_shifts`.
- Pessoas e acesso: `profiles`, `roles`, `permissions`, `role_permissions`, `user_permissions`, `shared_account_sessions`.
- Comunicação e rastreabilidade: `notifications`, `audit_logs`.
- Views: `production_summary`, `current_machine_targets`.

### Removido (em relação ao Google Sheets)
- `Sessions`, `InviteCodes`, colunas de senha e bloqueio de `Usuarios` → Supabase Auth / aprovação do gestor.
- `machineName` em Producao e Metas, `producao` e `defaultMeta` → derivados por relacionamento ou view.
- Máquina 19 "RETRABALHO GERAL".

### Impacto no frontend (quando a troca acontecer)
- Substituir `api()` do Apps Script pelo cliente Supabase.
- Gráficos passam a usar `good_quantity` para meta (corrige inflação por retrabalho).
- Novas telas: aprovação de usuários com tabela de permissões, identificação na conta Admin, campo de operadores, histórico de metas, turnos afetados por evento.
