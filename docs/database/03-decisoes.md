# Registro de Decisões (ADR)

Cada decisão registra **o contexto**, **o que foi escolhido**, **as alternativas** e **o custo**.
Decisões não são apagadas: quando revistas, recebem o status `Substituída por Dxx`.

Status possíveis: `Aprovada` · `Assumida` (sem confirmação explícita) · `Substituída` · `Proposta` · `Provisória — confirmar com o usuário` (tomada numa sessão autônoma, sem ninguém para consultar).

| ID | Tema | Status | Data |
|---|---|---|---|
| D01 | Id de máquina gerado pelo banco | Aprovada | 14/09/2026 |
| D02 | Nome de máquina único | Aprovada | 14/09/2026 |
| D03 | Nomes em inglês, `snake_case` | Aprovada | 14/09/2026 |
| D04 | Autoria por id, não por nome | Aprovada | 14/09/2026 |
| D05 | Status de máquina com manutenção; paradas para o SFM | Aprovada | 14/09/2026 |
| D06 | Tabela de turnos | Aprovada | 14/09/2026 |
| D07 | Datas como `date`, exibição dd/mm/aaaa | Aprovada | 14/09/2026 |
| D08 | Meta como snapshot no apontamento | Aprovada | 14/09/2026 |
| D09 | Ordens de produção em tabela própria | Aprovada | 14/09/2026 |
| D10 | Um apontamento por máquina + dia + turno | Aprovada | 14/09/2026 |
| D11 | Retrabalho separado da produção boa | Aprovada | 14/09/2026 |
| D12 | Número de operadores por turno | Aprovada | 14/09/2026 |
| D13 | Histórico de metas | Aprovada | 14/09/2026 |
| D14 | Meta igual para todos os turnos | Aprovada | 14/09/2026 |
| D15 | Meta não pode começar no passado | Aprovada — em revisão pela D34 | 14/09/2026 |
| D16 | `calendar_events` com três tipos | Aprovada | 14/09/2026 |
| D17 | Eventos por turno e vários por dia | Aprovada | 14/09/2026 |
| D18 | Importação automática de feriados nacionais | Aprovada | 14/09/2026 |
| D19 | Supabase Auth com login por e-mail | Aprovada | 14/09/2026 |
| D20 | Cadastro aguarda aprovação do gestor | Aprovada | 14/09/2026 |
| D21 | Nº do crachá obrigatório para contas pessoais | Aprovada | 14/09/2026 |
| D22 | Perfil copiado como modelo de permissões | Aprovada | 14/09/2026 |
| D23 | Conta Admin compartilhada com identificação | Aprovada | 14/09/2026 |
| D24 | Edição do próprio apontamento por 24 h | Aprovada | 14/09/2026 |
| D25 | Notificações por destinatário | Aprovada | 15/09/2026 |
| D26 | Log de auditoria por trigger, retenção adiada | Aprovada | 14/09/2026 |
| D27 | Modo de trabalho (hora extra) no apontamento | Aprovada | 16/09/2026 |
| D28 | Recriar `shifts` no banco que estava vazio | Aprovada (projeto de testes) | 21/09/2026 |
| D29 | Criação e remoção de contas | Aprovada | 21/09/2026 |
| D30 | Novo lançamento no mesmo apontamento acrescenta ordens | Aprovada | 21/09/2026 |
| D31 | Correção da meta de hoje/futura no mesmo dia | Provisória — será absorvida pela D34 | 20/09/2026 |
| D32 | Meta de datas anteriores ao histórico | Aprovada em parte — regra geral mantida na D34 | 21/09/2026 |
| D33 | Autor lê os próprios apontamentos (ligado à permissão) | Aprovada | 21/09/2026 |
| D34 | Gestão de metas por linha do tempo (painel do gestor) | Proposta | 21/09/2026 |
| D35 | Migração do histórico da planilha Excel | Proposta (gestor revisou em 25/09) | 21/09/2026 |
| D36 | Atingimento × disponibilidade (máquinas contínuas e sob demanda) | Proposta | 21/09/2026 |
| D37 | Centro de trabalho e processo (montagem/embalagem) | Aprovada | 25/09/2026 |
| D38 | Metas reais e centros por demanda | Aprovada | 25/09/2026 |
| D39 | Base da meta: por turno ou por operador | Aprovada | 25/09/2026 |
| D40 | Capacidade como alarme, não como cálculo da meta | Aprovada | 25/09/2026 |
| D41 | Máquina planejada e data de entrada em operação | Aprovada | 25/09/2026 |
| D42 | Tempo útil por turno guardado no banco | Aprovada | 25/09/2026 |
| D43 | Destino do histórico das máquinas renomeadas e divididas | Aprovada | 25/09/2026 |

---

### D01 — Id de máquina gerado pelo banco
- **Contexto:** o Apps Script calcula `maior id + 1`; dois cadastros simultâneos podem gerar o mesmo id.
- **Decisão:** `integer generated always as identity`.
- **Custo:** nenhum.

### D02 — Nome de máquina único
- **Contexto:** a checagem de duplicidade existe só no código.
- **Decisão:** índice único em `lower(name)`.
- **Custo:** nenhum.

### D03 — Nomes em inglês, `snake_case`
- **Contexto:** o legado mistura português e inglês; o Postgres converte identificadores para minúsculas.
- **Decisão:** inglês, sem acentos, `snake_case`.
- **Alternativa rejeitada:** português (mais natural para a equipe, mas exige tradução para bancos corporativos).
- **Custo:** menos natural no dia a dia; o frontend mantém rótulos em português.

### D04 — Autoria por id
- **Contexto:** `createdBy`, `savedBy` etc. guardam o nome; renomear um usuário quebra o vínculo.
- **Decisão:** `uuid` com FK para `profiles`.
- **Custo:** exibir o nome exige join.

### D05 — Status de máquina e paradas
- **Contexto:** necessidade de indicar manutenção e preventiva; paradas virão futuramente do SFM.
- **Decisão:** `status` com 4 valores via CHECK; tabela `machine_downtimes` criada sem uso, com `source` + `external_id` únicos.
- **Alternativa rejeitada:** `ENUM` (difícil de alterar, não portável).
- **Custo:** tabela sem uso até a integração.

### D06 — Tabela de turnos
- **Contexto:** turnos eram texto solto; turnos ativos ficavam no `localStorage` de cada navegador.
- **Decisão:** tabela `shifts` com horários e `is_active`. Qualquer usuário aponta qualquer turno.
- **Complemento (16/09/2026):** `start_time`/`end_time` são apenas descritivos. O turno de um apontamento vem sempre do `shift_id` informado, nunca deduzido do horário em que o apontamento foi feito — na prática os apontadores ficam além do horário do turno (passagem de turno, organização interna).
- **Custo:** uma tabela e um join a mais.

### D07 — Datas
- **Contexto:** o Sheets converte datas em textos como `"Thu Apr 03 2026 GMT-0300"`.
- **Decisão:** tipo `date`; o frontend exibe e recebe `dd/mm/aaaa`.
- **Alternativa rejeitada:** guardar `"14/09/2026"` como texto (ordenação e filtros incorretos).

### D08 — Meta como snapshot
- **Contexto:** a meta muda com o tempo, mas o passado não deve mudar junto.
- **Decisão:** manter `target_quantity` no apontamento (duplicação intencional).
- **Alternativa rejeitada:** calcular sempre a partir do histórico (consultas complexas).

### D09 — Ordens em tabela própria
- **Contexto:** as OPs eram um JSON dentro de uma célula.
- **Decisão:** tabela `production_orders`; `order_number` como texto (zeros à esquerda do SAP).
- **Custo:** gravação em duas tabelas, feita por função transacional.

### D10 — Um apontamento por máquina + dia + turno
- **Alterada por D27 (16/09/2026):** a chave de unicidade passa a incluir `work_mode`.
- **Contexto:** o legado tinha `upsert` (substitui) e `append` (duplica) coexistindo.
- **Decisão:** UQ `(machine_id, production_date, shift_id)`; lançamentos adicionais viram ordens do mesmo apontamento. A mesma OP pode aparecer em turnos diferentes; apontar atrasado é permitido.
- **Custo:** o botão "criar novo apontamento" do legado deixa de existir.

### D11 — Retrabalho
- **Contexto:** o legado soma retrabalho na produção, inflando o atingimento de meta.
- **Decisão:** remover `quantity_produced`; view `production_summary` separa produção boa e retrabalho. Meta usa apenas produção boa.
- **Custo:** gráficos do frontend precisam ser ajustados (corrige o bug atual).

### D12 — Operadores por turno
- **Contexto:** produção baixa em feriados e turnos com falta de pessoal distorce a leitura.
- **Decisão:** `machines.standard_operator_count` e `production_records.operator_count` (opcionais, pré-preenchidos). Métricas de lotação e meta ajustada.
- **Alternativa adiada:** registrar quais pessoas operaram (complexidade de uso e questões de RH/LGPD).
- **Substitui:** a proposta de "capacidade esperada no feriado" (rejeitada: estimativa não confiável).

### D13 — Histórico de metas
- **Decisão:** `machine_targets` append-only com `valid_from`; `default_target` removido; ao criar máquina o gestor informa a meta atual.

### D14 — Meta igual para todos os turnos
- **Decisão:** sem `shift_id` em `machine_targets`.

### D15 — Meta não retroativa
- **Em revisão (21/09/2026):** a D34 (Proposta) permite ao gestor/admin alterar metas do passado com rastro. Quando a D34 for implementada, esta decisão passa a `Substituída por D34`.
- **Decisão:** `valid_from` não pode ser anterior a hoje (fuso de Brasília). Correções pontuais em apontamentos são feitas pelo gestor.

### D16 — Três tipos de evento
- **Decisão:** `holiday` e `special_event` são contexto; `excluded_day` retira o dia/turno dos cálculos e prevalece sobre os demais.

### D17 — Eventos por turno e vários por dia
- **Decisão:** tabela de ligação `calendar_event_shifts` (vazia = dia inteiro); sem unicidade de data para eventos manuais.

### D18 — Feriados nacionais automáticos
- **Decisão:** importação anual da BrasilAPI (Supabase Cron + Edge Function); UQ parcial para eventos importados. Estaduais, municipais e da empresa são manuais.
- **Nota de segurança:** a rotina usa credencial interna do Supabase; ela nunca entra no repositório.

### D19 — Supabase Auth
- **Decisão:** login por e-mail (corporativo ou pessoal); proteção contra força bruta pelo limite de tentativas do Supabase. Tabelas `Sessions`, `senhaHash`, `loginAttempts`, `lockedUntil` eliminadas.

### D20 — Aprovação do gestor
- **Decisão:** cadastro nasce `pending` sem permissões; o gestor aprova. `InviteCodes` e o código fixo `ACCESS_CODE` são eliminados.

### D21 — Nº do crachá
- **Decisão:** `badge_number` obrigatório para `account_type = 'personal'`; contas `shared` e `display` isentas.

### D22 — Perfil como modelo
- **Decisão:** na aprovação, as permissões do perfil são copiadas para `user_permissions` e podem ser ajustadas.
- **Alternativa rejeitada:** perfil + exceções (propaga mudanças, mas é mais difícil de entender e depurar).
- **Custo:** alterar um perfil não afeta usuários já aprovados sem "reaplicar perfil".

### D23 — Conta Admin compartilhada
- **Decisão:** conta `shared`; a cada sessão a pessoa informa o nº do crachá, que precisa pertencer a um usuário ativo. Sem identificação, nenhuma permissão. O uso restrito ao PC do gestor é acordo interno, sem controle técnico.
- **Limitação conhecida:** identificação declarada, não comprovada por senha individual.

### D24 — Edição do próprio apontamento
- **Decisão:** `production.edit_own` permite editar/apagar apontamentos próprios até 24 h após a criação (evita o problema do turno 3 atravessando a meia-noite e do servidor em UTC).

### D25 — Notificações
- **Decisão:** uma linha por destinatário; ao aprovar, as notificações relacionadas são marcadas como lidas para todos. Realtime para atualização imediata.
- **Status:** aprovada em 15/09/2026 (antes assumida).

### D26 — Auditoria
- **Decisão:** `audit_logs` gravado por triggers, com snapshot antes/depois e IP; append-only.
- **Adiado:** política de retenção (decidir junto com o plano Supabase ou a migração para a WEG; o plano Free tem 500 MB).

### D27 — Modo de trabalho (hora extra)
- **Contexto:** a fábrica faz hora extra esporádica, combinada previamente com o gestor (inclusive de madrugada, onde o TURNO 3 ainda não opera regularmente). Hoje isso é registrado como uma linha separada na planilha, identificada por texto livre ("hora extra do dia tal"), que o sistema não consegue somar, filtrar nem excluir dos gráficos.
- **Problema:** medir uma hora extra (poucas pessoas, poucas horas) com a meta cheia de um turno produz percentuais falsos — o TURNO 3 apareceria como péssimo sendo que sequer existe como turno. A lotação (D12) corrige "menos gente", mas não corrige "menos horas".
- **Decisão:** coluna `work_mode` em `production_records`: `text not null default 'regular'`, CHECK `regular`/`overtime`. O apontamento fica no turno real em que a produção ocorreu.
- **Regras de leitura:** produção total inclui hora extra; atingimento de meta por turno considera apenas `regular`; hora extra vira indicador próprio.
- **Consequência estrutural:** a unicidade de D10 passa a ser `(machine_id, production_date, shift_id, work_mode)`, para que trabalho normal e hora extra do mesmo turno coexistam como linhas separadas — como já acontece na planilha.
- **Alternativas rejeitadas:** lançar no turno 1/2 (dado mentiroso); ativar o TURNO 3 e aceitar o percentual ruim; criar um "turno HORA EXTRA" (hora extra não é turno — pode ocorrer em qualquer um).
- **Formato:** texto com CHECK em vez de booleano, para acomodar futuros modos (`training`, `trial`) sem coluna nova.
- **Custo:** uma coluna a mais e uma marcação na tela de apontamento; os gráficos do frontend precisam respeitar a regra.
- **Quando o TURNO 3 virar regular:** nada muda na estrutura — os apontamentos novos simplesmente deixam de ser marcados como `overtime`, e o passado continua verdadeiro.

### D28 — Recriar `shifts` no banco que estava vazio
- **Status:** Aprovada em 21/09/2026. O projeto Supabase usado nesta etapa é um **projeto de testes**. O projeto oficial será montado depois com `supabase/migrations/_consolidado.sql` + `supabase/seed/01_estrutural.sql` (sem o seed de demonstração).
- **Contexto:** a documentação registrava `shifts` como criada em 16/09/2026, mas o banco apontado pelo arquivo de segredos estava com o schema `public` **vazio**, sem nenhum rastro de criação ou remoção da tabela. Detalhes em [notas/2026-09-20-verificacao-inicial.md](notas/2026-09-20-verificacao-inicial.md).
- **Decisão:** aplicar as duas migrations versionadas de `shifts` sem nenhuma alteração, antes das demais.
- **Alternativas rejeitadas:** trabalhar só offline (atrasaria toda a verificação real); reescrever a migration de `shifts` (mudaria o histórico versionado).
- **Por que é seguro:** a ação é só aditiva. Se `shifts` existir em outro projeto, ele não é tocado.
- **A confirmar:** qual é o projeto oficial. Se for outro, basta rodar `supabase/migrations/_consolidado.sql` nele.

### D29 — Criação e remoção de contas
- **Status:** Aprovada em 21/09/2026 (as duas partes).
- **Contexto:** a regra D21 (crachá obrigatório para conta pessoal) precisava de um comportamento concreto no gatilho `handle_new_user`, e as chaves estrangeiras para `profiles` (autoria, aprovação, auditoria) precisavam de uma regra de remoção.
- **Decisão 1 — cadastro sem crachá:** o gatilho **recusa** o cadastro pessoal sem crachá, com a mensagem "O nº do crachá é obrigatório para contas pessoais." Contas `shared` (Admin) e `display` (TV) são criadas enviando `account_type` nos metadados do cadastro.
- **Consequência:** criar usuário pelo botão "Add user" do painel do Supabase (que não envia metadados) falha. Usar a tela de cadastro do app ou a API com `options.data`.
- **Alternativa rejeitada:** criar o perfil mesmo sem crachá (exigiria afrouxar a regra D21 no banco).
- **Decisão 2 — remoção:** as chaves estrangeiras para `profiles` usam o padrão "impedir" (sem `ON DELETE`). Quem já tem histórico não pode ser apagado; o caminho é bloquear (`status = 'blocked'`), preservando a rastreabilidade (D04, D26).
- **Alternativa rejeitada:** `ON DELETE SET NULL` (apagaria a autoria do histórico).
- **A confirmar:** se a LGPD exigir remoção de dados pessoais no futuro, a saída prevista é anonimizar `full_name`/`badge_number`, não apagar a linha.

### D30 — Novo lançamento no mesmo apontamento acrescenta ordens
- **Status:** Aprovada em 21/09/2026. Confirmação do usuário: um novo apontamento no mesmo "filtro" (máquina + dia + turno) só **acrescenta** à lista; para substituir, usa-se a função **Editar**, que já existe.
- **Contexto:** o `upsert` do legado **substitui** a lista de ordens quando alguém salva de novo a mesma máquina + dia + turno; a D10 diz que "lançamentos adicionais viram ordens do mesmo apontamento" e a visão geral diz que o sistema "completa o apontamento existente".
- **Decisão:** `save_production_record` **acrescenta** as ordens enviadas às existentes (segue D10). Para editar/corrigir, `update_production_record` (ou `p_replace_orders = true`) substitui a lista.
- **Consequência:** salvar duas vezes a mesma ordem gera duas linhas (no legado, a segunda sobrescrevia a primeira). A edição de uma ordem errada passa a ser feita na tela de edição, não salvando de novo.
- **Alternativa rejeitada:** manter a substituição do legado (contraria D10 e perde lançamentos feitos por outra pessoa no mesmo turno).
- **Encerrado:** o aviso "já existe apontamento — substituir?" não será feito; a correção é pela edição.

### D31 — Correção da meta de hoje/futura no mesmo dia
- **Status:** Provisória — será absorvida pela D34 (21/09/2026): corrigir a meta de hoje vira um caso de "alterar a meta de um trecho" no painel. Até a D34 ser implementada, vale o comportamento abaixo.
- **Contexto:** `machine_targets` é append-only (D13) e tem unicidade `(machine_id, valid_from)`. Um erro de digitação ao salvar a meta de hoje ficaria sem correção até amanhã.
- **Decisão:** `save_machine_targets` corrige a meta já cadastrada para a **mesma data**, desde que essa data seja hoje ou futura. Metas que já valeram (antes de hoje) continuam imutáveis — o gatilho `validate_target_valid_from` recusa. Toda correção fica no log de auditoria (antes/depois).
- **Consequência:** apontamentos feitos hoje **antes** da correção guardam a meta antiga (foto, D08); o gestor corrige esses pontualmente.
- **Alternativa rejeitada:** recusar e obrigar a vigência de amanhã (bloqueia a correção de um erro óbvio).

### D32 — Meta de datas anteriores ao histórico
- **Status:** Aprovada em parte (21/09/2026). Regra confirmada pelo usuário: o apontamento recebe a **meta vigente na data do apontamento** — se a meta no dia X é N, o apontamento do dia X recebe N. É o que `machine_target_on(máquina, data)` já faz. **Em aberto:** confirmar que, num apontamento atrasado, "data do apontamento" é a data da produção (`production_date`) e não o dia em que foi digitado; e se a regra da meta mais antiga para datas antes do histórico continua.
- **Contexto:** o histórico de metas começa na data da carga inicial (20/09/2026). Um apontamento atrasado de antes disso não teria meta vigente.
- **Decisão:** `machine_target_on` usa a meta **mais antiga conhecida** para datas anteriores ao início do histórico, em vez de zero.
- **Alternativa rejeitada:** meta zero (o atingimento ficaria indefinido e os gráficos mostrariam "—").
- **A confirmar:** quando os dados do Sheets forem migrados, o `target_quantity` de cada apontamento antigo virá da própria planilha (coluna `meta`), e esta regra só valerá para apontamentos atrasados novos.

### D33 — Autor lê os próprios apontamentos
- **Status:** Aprovada em 21/09/2026. O usuário confirmou a lógica "apenas para o Operador" e escolheu a forma recomendada: a regra fica ligada à **permissão** `production.edit_own`, não ao nome do perfil (migration 0.10.2).
- **Contexto:** a referência dizia "leitura de produção: `history.view` OR `dashboard.view` OR `tv_mode.view`". O perfil Operador não tem nenhuma dessas, mas tem `production.edit_own` (corrigir o próprio apontamento por 24 h, D24) — e não dá para corrigir o que não se vê.
- **Decisão:** a política de leitura de `production_records` também libera os apontamentos em que `created_by` é o próprio usuário **e** ele tem `production.edit_own`. As ordens seguem o apontamento-pai.
- **Por que permissão e não perfil:** as permissões são ajustáveis por pessoa (D22). Tirar de alguém o direito de corrigir também tira o de ver os próprios; com os perfis de fábrica, só o Operador depende desta regra — os demais já veem toda a produção.
- **Alternativa rejeitada:** travar pelo perfil "Operador" (ignoraria os ajustes individuais).
- **Alternativa rejeitada:** dar `history.view` ao Operador (ele passaria a ver a produção de todos).

### D34 — Gestão de metas por linha do tempo (painel do gestor)
- **Status:** Proposta (21/09/2026) — desenhada com o usuário; ainda não implementada. Próximo passo: protótipo navegável do painel e, depois, as migrations.
- **Contexto:** a D15 proíbe meta no passado e a D31 tratava só a correção do dia. O usuário quer um fluxo completo: definir metas por máquina, ver a meta ao longo do tempo e corrigir qualquer trecho, inclusive no passado, com responsabilidade.
- **Decisão (pontos confirmados pelo usuário):**
  1. **Quem:** só gestor e admin (a permissão `targets.manage` que já existe; sem permissão separada para o passado). Na conta Admin compartilhada, o rastro registra a pessoa identificada pelo crachá (D23).
  2. **Para quem:** uma meta por **máquina**, igual para todos os turnos (D14 mantida). Hora extra e dia anulado continuam fora do cálculo (D16, D27).
  3. **Linha do tempo:** a meta vale **até existir uma nova**; a meta atual não tem data de fim. Nunca há duas metas ao mesmo tempo na mesma máquina (o banco impede sobreposição).
  4. **Editar um trecho** (ex.: de 03/03 a 28/03 → 550): o sistema grava a mudança no início e, no dia seguinte ao fim, **volta sozinho** à meta que valia antes. Mudanças que existiam dentro do trecho são substituídas.
  5. **Até onde:** qualquer data em que exista apontamento daquela máquina no passado, além de datas futuras (metas "agendadas").
  6. **Apontamentos acompanham a linha do tempo:** ao mudar um trecho, a meta guardada em cada apontamento do trecho é recalculada (D08 mantida como "foto", mas com recálculo oficial). **Não existe mais correção avulsa** da meta de um apontamento: a meta vem sempre da linha do tempo.
  7. **Rastro:** motivo obrigatório; antes/depois de cada meta e de cada apontamento recalculado no log de auditoria (D26); **prévia do impacto** antes de confirmar (quantos apontamentos mudam, atingimento antes e depois).
  8. **Transparência:** gráficos e relatórios mostram um aviso nos períodos alterados ("meta alterada em … por …"); o painel lista as mudanças com o botão **Desfazer** (uma nova mudança no sentido contrário, também registrada).
  9. **Concorrência:** se dois gestores editam a mesma máquina ao mesmo tempo, o segundo é avisado de que a linha do tempo mudou e precisa recarregar.
- **Painel:** por máquina, gráfico da meta em "degraus" ao longo do tempo com a produção real diária por trás; metas futuras tracejadas; selecionar um trecho no gráfico abre a edição com prévia.
- **Consequências:** D15 será substituída; D31 deixa de existir isolada; a regra geral da D32 (meta vigente na data da produção) continua. `machine_targets` ganha o motivo da mudança; nasce uma função de recálculo auditada.
- **Em aberto:** (a) montar a linha do tempo do passado a partir da planilha de apontamentos que o usuário vai enviar (a meta gravada em cada linha); (b) **fechamento mensal** — discutir depois, como um arquivo pronto com os indicadores do mês.
- **Alternativas rejeitadas:** metas com data de fim obrigatória (não dá para prever quando haverá meta nova); preservar correções avulsas em apontamentos (criaria metas "escondidas" diferentes do gráfico); permissão separada para alterar o passado (o usuário preferiu manter só gestor/admin).

### D35 — Migração do histórico da planilha Excel
- **Status:** Proposta (21/09/2026) — **revisão do gestor concluída em 25/09/2026** (ver D35.1). Datas de entrada em operação confirmadas e cruzamento coluna a coluna feito (D35.3). **Sem pendências de informação** — falta implementar.
- **Contexto:** o histórico real está na planilha `ITAJAI - CONTROLE DE PRODUÇÃO 2026.xlsx` (20/12/2025 em diante, uma aba por mês, linha = data + turno, coluna = máquina, sem nº de OP). O app atual (Google Sheets + Apps Script) registra a **mesma** produção e será abandonado quando o sistema novo estiver em uso.
- **Decisão (pontos confirmados pelo usuário):**
  1. **Fonte única do histórico = a planilha Excel.** O Google Sheets do app serve só para conferência (importar os dois contaria em dobro).
  2. **Virada:** uma **data de corte**, precedida de uma rodagem em paralelo curta (a equipe aponta no sistema; a planilha segue só para comparação). Depois do corte, só o sistema.
  3. **A planilha nunca é alterada.** A extração é um script reproduzível (rodar de novo dá o mesmo resultado).
  4. **Área de preparo** no banco, separada das tabelas de produção; cada valor guarda a origem (aba e célula, ex.: `JUN 26!F12`).
  5. **Pendências revisadas caso a caso** pelo gestor antes da carga: hora extra (rótulos "HORA EXTRA", "H. EXTRA", "EXTRA 1°T/2°T"; sábado 10/01), textos no lugar de números ("Preventiva", "Manutenção" → paradas de máquina), anotações de retrabalho.
  6. **Carga em lote** identificado e reversível; cada apontamento marcado como vindo da planilha, com a célula de origem; passa pela auditoria.
  7. **Conferência obrigatória:** total por máquina e mês no sistema = total na planilha.
  8. **Data de entrada em operação** por máquina: sugerida como o 1º dia com produção e confirmada pelo gestor. Zeros **antes** dela = máquina ainda não existia em Itajaí (descartados). A linha do tempo de metas (D34) começa nessa data.
  9. **Metas:** a meta do grupo na planilha vale **para cada máquina** do grupo (ex.: "Horizontais 500" → Horizontal 1 = 500 e Horizontal 2 = 500). Agosto e setembro continuam com as metas de julho. Máquinas sem meta na planilha ficam **sem meta** até o gestor definir no painel (D34).
  10. **Máquinas:** entram as que não existem no app (2 CONJUNTOS, 1 CONJUNTOS, REBITAGEM PINOS, MÁQUINA DE PLUG AUTOMÁTICA); **PRENSA TOX** entra como **Montagem Diversos**.
  11. **Retrabalho:** nomenclatura antiga respeitada no histórico (só 3 anotações na planilha, tratadas uma a uma); a boa prática nova vale a partir da entrada em produção do sistema.
  12. **OP:** apontamentos importados entram sem nº de OP ("importado da planilha"). A OP informada passa a ser boa prática nova, com integração futura ao SAP.
- **Impacto no banco (a implementar):** data de entrada/saída de operação em `machines`; origem e lote em `production_records`; tabela da área de preparo; tipo da máquina (D36). Tudo aditivo.
- **Alternativas rejeitadas:** importar também o Google Sheets (duplicaria); tratar todo zero como "não rodou" (misturaria máquinas que ainda não existiam); gravar direto nas tabelas de produção sem área de preparo (sem revisão nem desfazer).


#### D35.1 — Devolutivas do gestor (25/09/2026)

O relatório de pré-importação voltou revisado. As 17 pendências que dependiam
dele estão fechadas; o que segue é o que vale na importação.

**Hora extra — em qual turno cada caso aconteceu.** Nenhum caiu no T3, o que
bate com o T3 ainda ser só hora extra de madrugada.

| Data | Rótulo na planilha | Turno |
|---|---|---|
| sáb 10/01/2026 | aba separada, "T1" | hora extra, **T1** |
| sáb 16/05/2026 | "HORA EXTRA" | T1 |
| sáb 23/05/2026 | "HORA EXTRA" | T1 |
| sex 05/06/2026 | "EXTRA 2°T" | T2 |
| seg 15/06/2026 | "EXTRA 1°T" | T1 |
| seg 15/06/2026 | "EXTRA 2°T" | T2 |
| sáb 27/06/2026 | "H. EXTRA" | T1 |
| sáb 11/07/2026 | "H. EXTRA" | T1 |
| dom 12/07/2026 | "H. EXTRA" | T1 |

**Textos no lugar de números.** Os quatro viram parada de máquina no turno,
com o motivo que a planilha escreveu:

| Data · turno | Célula | Escrito | Vira |
|---|---|---|---|
| qua 04/03 · T1 | `MAR 26!I10` | "Preventiva" | parada por manutenção preventiva — 4x2 Suportes/Placas N°2 |
| sex 06/03 · T1 | `MAR 26!F14` | "Manutenção" | parada por manutenção — Horizontal N°1 |
| seg 09/03 · T1 | `MAR 26!F16` | "Preventiva" | parada por manutenção preventiva — Horizontal N°1 |
| sex 13/03 · T1 | `MAR 26!F24` | "Manutenção" | parada por manutenção — Horizontal N°1 |

**Retrabalho e observações.**

| Célula | Escrito | Vira |
|---|---|---|
| `ABR 26!AN42` | "Retrabalho Refinatto 4.510" | 4.510 peças de retrabalho na Prensa Placa Refinatto, 27/04 · T1 |
| `SET 26!AB8` | "H 01 - 4800" | 4.800 peças de retrabalho na Embaladora Horizontal N°1 |
| `SET 26!AB30` | "Colagem de etiqueta de correção nas embalagens da modulo 02" | **observação do dia, sem quantidade**, na Vertical Módulos N°2 |

**Número cortado.** `AGO 26!X38` trazia "10." na Máquina de Tomadas
Automática, 25/08 · T1. O gestor confirmou: **10.000 peças**.

#### D35.2 — O que as decisões D37 a D43 mudaram nesta decisão

O desenho da fábrica foi refeito **depois** que a D35 foi escrita, então dois
pontos dela ficaram desatualizados:

- **Item 10 está superado.** Ele dizia que a `PRENSA TOX` entraria como
  "Montagem Diversos". Pela D37 ela é um **centro de trabalho próprio** e já
  está cadastrada. O mesmo vale para as duas Conjuntos e para a "Máquina de
  Plug Automática", que hoje é a `MÁQUINA DE PLUGUE SLIN - AUMAQ`.
- **Mapeamento das colunas da planilha** passa a seguir a D43: a coluna de
  `MONTAGEM DIVERSOS` vai para a **Bancada N°4**, e as de `MONTAGEM TOMADAS
  MANUAL` e `FECHAMENTO TECLA INTERRUPTORES` vão para a **Bancada N°3**.
- **Item 9 continua valendo** para os degraus do **passado** (horizontais
  8.000, placas 7.000, a granel 15.000). As metas de **hoje** já estão no
  banco pela D38 e não vêm mais da planilha.

**Resolvido em 25/09/2026:** a coluna `REBITAGEM PINOS` vai para a **Prensa Tox**. Todas as 23 colunas da planilha passam a ter destino — ver D35.3.


#### D35.3 — Cruzamento coluna a coluna (25/09/2026)

As 23 colunas da planilha de produção contra os 22 centros de trabalho. As
datas de entrada em operação foram confirmadas pelo gestor; o resto vem da
leitura da planilha (20/12/2025 a 21/09/2026, 2.505 turnos-máquina com
produção).

| Coluna da planilha | Vira o centro | Entrou em operação | Turnos c/ produção | Zeros depois |
|---|---|---|---|---|
| VERTICAL PLACAS / SUP. 2 | Embaladora 4X2 Suportes/Placas N°2 | 20/12/2025 | 305 | 22 |
| A GRANEL | Bancada Embalagem A Granél | 20/12/2025 | 279 | 34 |
| MANUAL INTERRUPTOR | Bancada N°2 - Montagem Interruptores | 20/12/2025 | **10** | 283 |
| MONTAGEM DIVERSOS | Bancada N°4 - Diversos | 20/12/2025 | 224 | 90 |
| KIT 2 PARAFUSO | Embaladora Kit Parafusos N°2 | 22/12/2025 | 148 | 155 |
| TESTE INTERRUPTORES | Bancada N°1 - Teste Interruptores | 05/01/2026 | 116 | 135 |
| MONTAGEM PLACA REFINATTO | Prensa Placa Refinatto | 05/01/2026 | 95 | 199 |
| HORIZONTAL 1 | Embaladora Horizontal N°1 | 03/02/2026 | 273 | 16 |
| KIT 1 PARAFUSO | Embaladora Kit Parafusos N°1 | 22/04/2026 | 58 | 150 |
| VERTICAL PLACAS / SUP. 1 | Embaladora 4X2 Suportes/Placas N°1 | 30/04/2026 | 194 | 11 |
| VERTICAL MÓDULOS 2 | Embaladora Vertical Módulos N°2 | 21/05/2026 | 167 | 12 |
| VERTICAL MÓDULOS 1 | Embaladora Vertical Módulos N°1 | 29/05/2026 | 157 | 9 |
| 2 CONJUNTOS | Embaladora Vertical Conjuntos N°2 | 02/07/2026 | 106 | 10 |
| MÁQUINA DE PLUG AUTOMÁTICA | Máquina de Plugue Slin - AUMAQ | 09/07/2026 | 92 | 2 |
| PRENSA TOX | Prensa Tox | 20/07/2026 | **2** | 17 |
| MÁQUINA INTERRUPTOR | Máquina de Interruptores Composé N°1 | 21/07/2026 | 78 | 12 |
| INSERÇÃO DOS CONTATOS INTERRUPTOR | Prensa Inserção Contatos Interruptores | 27/07/2026 | **16** | 46 |
| 1 CONJUNTOS | Embaladora Vertical Conjuntos N°1 | 29/07/2026 | 74 | 5 |
| HORIZONTAL 2 | Embaladora Horizontal N°2 | 03/08/2026 | 67 | 4 |
| MÁQUINA DE TOMADAS AUTOMÁTICA | Máquina de Tomadas Composé - AUMAQ | 20/08/2026 | 34 | 4 |
| REBITAGEM PINOS | **Prensa Tox** (confirmado em 25/09) | 24/08/2026 | **9** | 7 |
| FECHAMENTO TECLA INTERRUPTORES | Bancada N°3 - Diversos | 27/08/2026 | **1** | 4 |
| MONTAGEM TOMADAS MANUAL | Bancada N°3 - Diversos | — | **0** | 0 |

**Duas colunas por centro, em dois casos.** A Bancada N°3 recebe
`FECHAMENTO TECLA` e `MONTAGEM TOMADAS MANUAL`; a Prensa Tox recebe
`PRENSA TOX` e `REBITAGEM PINOS`. Conferido: **não há colisão de data e
turno** em nenhum dos dois (Prensa Tox produziu só em julho, Rebitagem Pinos
só em agosto e setembro; Montagem Tomadas Manual nunca produziu). A junção
não perde nem sobrepõe nenhum registro.

**Um centro fica sem histórico:** a `BANCADA N°5 - ELETRÔNICOS` não tem coluna
na planilha. Começa a vida no sistema novo, sem passado.

##### O que não faz sentido levar adiante

- **`MONTAGEM TOMADAS MANUAL`: nada a importar.** Zero turnos com produção em
  nove meses de planilha. A coluna existe e está inteiramente vazia. Não é
  perda de dado: não há dado.
- **Zeros anteriores à entrada em operação: descartados**, como já dizia o
  item 8 da D35. São 2.663 células que significam "a máquina ainda não estava
  em Itajaí", não "produziu zero".
- **Zeros de centros por demanda: descartados.** Turno sem pedido não é
  parada. São os 283 da Bancada N°2, 199 da Placa Refinatto, 155 e 150 dos
  Kits, 135 da Bancada N°1, 90 da Bancada N°4 e 46 da Prensa Inserção.
- **Zeros de centros contínuos: viram turnos parados** (D36), com o motivo
  quando a planilha informa. São poucos e concentrados nas embaladoras: 34 da
  A Granél, 22 da 4X2 N°2, 16 da Horizontal N°1, 12 da Módulos N°2, 11 da 4X2
  N°1, 10 da Conjuntos N°2, 9 da Módulos N°1, 5 da Conjuntos N°1, 4 da
  Horizontal N°2, 4 da Tomadas, 2 da Plugue Slin.

##### O que vale a pena levar, mesmo sendo pouco

Quatro centros têm histórico curto demais para sustentar qualquer indicador,
mas o custo de importar é zero e o dado é real: Prensa Tox (2 turnos próprios
+ 9 da Rebitagem Pinos), Fechamento Tecla (1), Prensa Inserção Contatos (16) e
Bancada N°2 (10). Ficam no sistema como registro histórico, não como base de
média.

##### Pendência fechada em 25/09/2026

A folha de revisão perguntava sobre a `MANUAL INTERRUPTOR`: *"Produziu em
dez/jan e uma vez em 05/06; depois só zeros. Foi desativada?"*. Resposta do
usuário: **não foi desativada — ela é sob demanda**, e a produção dela vai
para o centro correspondente, a **Bancada N°2 - Montagem Interruptores**
(o mapeamento que já estava registrado).

Consequências:
- os **283 zeros são descartados** (turno sem pedido não é parada);
- a Bancada N°2 **não precisa de data de saída** de operação;
- os 10 turnos com produção entram normalmente no histórico dela.

Com isso **todas as pendências da D35 estão fechadas**: as 23 colunas têm
destino, as datas de entrada em operação estão confirmadas e os casos
especiais foram revisados um a um. O que falta é construir — área de preparo,
script de extração e carga em lote reversível.

### D36 — Atingimento × disponibilidade (máquinas contínuas e sob demanda)
- **Status:** Proposta (21/09/2026) — opção escolhida pelo usuário; **a classificação das máquinas precisa ser revisada pelo gestor**.
- **Contexto:** um turno com produção zero pode ser parada (máquina contínua) ou simplesmente falta de pedido (máquina sob demanda). Contar todo zero no atingimento castiga as máquinas sob demanda; ignorar todo zero esconde as paradas das contínuas.
- **Decisão:** dois indicadores separados.
  - **Atingimento:** mede só os turnos em que a máquina rodou ("quando roda, rende o esperado?").
  - **Disponibilidade:** só para máquinas **contínuas** — turnos em que rodou ÷ turnos programados, com os motivos das paradas ("ficou parada quando devia rodar?").
- **Cadastro:** cada máquina é marcada como **contínua** ou **sob demanda** (o gestor pode mudar depois). Sugestão inicial a revisar: contínuas = embaladoras (horizontais, verticais placas/suporte e módulos, a granel), conjuntos e máquina de plug; sob demanda = kits, Refinatto, Teste Interruptores, Montagem Diversos e demais montagens.
- **Na importação:** zeros de máquinas contínuas depois da entrada em operação viram **turnos parados** (com o motivo quando a planilha informa); zeros de máquinas sob demanda são ignorados.
- **No dia a dia:** máquina contínua sem apontamento num turno normal gera aviso ("Horizontal 1 sem apontamento no T2 de ontem"); quem aponta informa o motivo ou lança a produção esquecida.
- **Alternativas rejeitadas:** ignorar zeros em todas; contar zeros em todas; misturar paradas no atingimento das contínuas (um número só esconde se a máquina está lenta ou parada).
- **Relação:** amplia a D05 (paradas de máquina) — `machine_downtimes` passará a ter motivos como falta de material e falta de operador.

---

> **Fonte das decisões D37 a D43:** planilha `ITAJAÍ_TI_CAPACIDADE_VS_PESSOAS 2026_2027_REV01.xlsx` (atualizada em 09/09/2026) somada às confirmações do usuário em 25/09/2026. O desenho resultante está em `cadernos/07-mapa-da-fabrica.pdf`.

### D37 — Centro de trabalho e processo (montagem/embalagem)
- **Status:** Aprovada (25/09/2026).
- **Contexto:** o banco tem 18 "máquinas" numa lista plana, com nomes que não correspondem aos da fábrica. A planilha de capacidade mostra a fábrica organizada em dois processos, e o usuário confirmou: "cada nome é um centro de trabalho que deve ser contado e interpretado no contexto".
- **Decisão:** a ficha da máquina passa a representar um **centro de trabalho** e ganha o campo **processo**: `montagem` ou `embalagem`. São **22 centros ativos** — 13 em montagem, 9 em embalagem.
- **Por quê:** resolve três necessidades com um campo só — indicador por processo, parada de um setor inteiro no calendário com um evento (hoje exigiria um evento por máquina) e desambiguação de nomes (a "Embaladora Kit Parafusos" pertence a **montagem**, apesar do nome).
- **Alternativas rejeitadas:** grupo livre de máquinas criado pelo gestor (flexível demais para dois valores que a fábrica trata como fixos); nenhum agrupamento (mantém o problema das paradas de setor).
- **Custo:** um campo obrigatório a mais no cadastro. Se um dia a fábrica ganhar um terceiro processo, é um valor novo na lista, não uma migração.

### D38 — Metas reais e centros por demanda
- **Status:** Aprovada (25/09/2026). Substitui os valores de reserva do seed (`MACHINES_DEFAULT`, 150 a 600), que nunca foram reais.
- **Decisão:** **12 centros com meta** (peças por turno): Horizontais N°1 e N°2 **10.000**; 4x2 Suportes/Placas N°1 e N°2 **7.500**; Vertical Módulos N°1 e N°2 **13.000**; Vertical Conjuntos N°1 e N°2 **5.000**; A Granel **25.000 por pessoa**; Tomadas Composé–AUMAQ **12.500**; Plugue Slin–AUMAQ **6.500**; Interruptores Composé N°1 **4.500**.
- **10 centros por demanda**, sem meta (`has_target = false`), todos em montagem: Kit Parafusos N°1 e N°2, Bancadas N°1 a N°5, Prensa Inserção Contatos, Prensa Tox e Prensa Placa Refinatto. Motivo informado pelo usuário: são máquinas por demanda de fábrica, onde a meta não faz sentido.
- **Consequência que o gestor precisa saber:** o atingimento passa a falar de **12 centros, não de 22**. O número não fica pior nem melhor de propósito — fica sobre outra coisa. A produção dos 10 continua somando no total.
- **Relação:** confirma a classificação sugerida na **D36** (sob demanda = kits, Refinatto, Teste Interruptores, Diversos e demais montagens), que estava marcada como "a revisar pelo gestor".

### D39 — Base da meta: por turno ou por operador
- **Status:** Aprovada (25/09/2026).
- **Contexto:** A Granel é medida em **25.000 peças por pessoa no turno**; todas as outras são um número fixo por turno.
- **Decisão:** a meta ganha o campo **base**: `por_turno` (padrão, 11 centros) ou `por_operador` (A Granel). Quando a base é por operador, a meta efetiva do apontamento é `quantidade × número de operadores informado`.
- **Alternativa rejeitada:** guardar 25.000 como meta fixa e dividir depois na tela — some a intenção do dado e cada leitor precisa lembrar da exceção.
- **Custo:** o cálculo de atingimento deixa de ser uma comparação direta e passa a depender do número de operadores do apontamento, que hoje é opcional. Apontamento de A Granel **sem operadores informados** precisa cair na lotação padrão da máquina.

### D40 — Capacidade como alarme, não como cálculo da meta
- **Status:** Aprovada (25/09/2026).
- **Contexto:** a planilha calcula, por centro, `peças por minuto × tempo útil do turno = capacidade técnica`, e `× eficiência (0,60 a 0,90) = capacidade realista`. Era tentador derivar a meta desse número.
- **Decisão:** guardar **peças por minuto** e **eficiência** na ficha da máquina e usá-los **só como alarme** — meta acima da capacidade técnica é fisicamente impossível, e o sistema avisa no momento em que o gestor digita. A meta continua sendo digitada por ele.
- **Por que não derivar:** as metas acordadas ficam entre **62% e 86%** da capacidade técnica, sem fator único (Horizontais 62%, Placas 71%, Conjuntos 73%, Interruptores 77%, A Granel 79%, Módulos 83%, Plugue 83%, Tomadas 86%). Qualquer fórmula automática seria uma solução que só parece resolver.
- **Custo:** dois campos que alguém precisa manter atualizados. Desatualizados, o alarme fica errado — é o caso suspeito da Plugue Slin, cuja eficiência de 0,60 na planilha não bate com a meta acordada.

### D41 — Máquina planejada e data de entrada em operação
- **Status:** Aprovada (25/09/2026).
- **Contexto:** sete centros aparecem em amarelo na planilha — já previstos ou comprados, sem funcionamento real hoje: Interruptores (Nova Base), Plugue Fêmea, Tomadas N°2, Lufati Klin Padrão, Lufati PL+SUP 4x4, Vertical Plugues e Vertical Conjuntos N°3.
- **Decisão:** a situação da máquina ganha o valor **`planejada`**, e a ficha ganha uma **data de entrada em operação**. Centro planejado não aparece na tela de apontamento nem entra em nenhum indicador; antes da data de entrada, os turnos não são cobrados.
- **Por quê:** cadastrar hoje uma máquina que chega em março faria o indicador contar dezenas de turnos zerados de um equipamento inexistente. É o mesmo remédio do problema dos zeros antigos levantado na **D35**.
- **Alternativa rejeitada:** cadastrar só quando a máquina chegar — perde-se o planejamento e o cadastro vira correria no dia da instalação.

### D42 — Tempo útil por turno guardado no banco
- **Status:** Aprovada (25/09/2026).
- **Contexto:** os três turnos têm tempos bem diferentes. T1 04:55–14:18, **493 min úteis**; T2 14:18–23:24, **481**; T3 23:24–05:00, **271**. Os descontos são iguais nos três: 30 de refeição, 10 de ginástica laboral, 10 de intervalo e 15 de troca de turno e limpeza.
- **Decisão:** guardar **minutos brutos** e **minutos úteis** na ficha do turno agora, mesmo sem uso imediato. O horário continua informativo e **não precisa fechar por subtração** com o tempo útil: no T1, os 5 minutos entre 04:55 e 05:00 são entrada e preparação, não produção.
- **Por quê:** o T3 hoje só existe como hora extra, que já fica fora do cálculo de meta — então a regra atual (uma meta única, igual para os três turnos) não machuca ninguém. Quando o T3 virar turno normal, ele terá **271 minutos contra 493 do T1 (55%)** e nascerá reprovado com a mesma meta. Com o tempo útil já no banco, a correção vira uma conta; sem ele, vira migração de emergência.
- **Alternativa rejeitada:** esperar o T3 virar turno normal para tratar o assunto.
- **Pendente de propósito:** a regra de proporcionalidade (meta do turno = meta base × minutos úteis do turno ÷ minutos úteis do T1) **não** será implementada agora, só quando o T3 entrar em operação normal.

### D43 — Destino do histórico das máquinas renomeadas e divididas
- **Status:** Aprovada (25/09/2026).
- **Contexto:** três centros do banco não correspondem um-para-um aos 22 da fábrica. Máquina com produção **não pode ser apagada** — o caminho é inativar (D05) —, então renomear preserva o histórico — mas é preciso dizer para onde ele vai.
- **Decisão:**
  - `MONTAGEM TOMADAS MANUAL` e `FECHAMENTO TECLA INTERRUPTORES`, renomeadas e readequadas na fábrica, têm todo o histórico levado para **BANCADA N°3 — DIVERSOS**.
  - `MONTAGEM DIVERSOS`, que virou dois centros na fábrica (Bancadas N°3 e N°4), tem todo o histórico levado para **BANCADA N°4 — DIVERSOS**.
- **Custo assumido:** a produção antiga de três centros fica concentrada em duas bancadas e **não tem como ser separada depois** — a planilha nunca registrou essa distinção. Vale só para o passado; a partir da migração, cada bancada recebe o seu próprio apontamento.
- **Alternativas rejeitadas:** criar centros "legado" só para segurar o histórico (polui a lista de apontamento para sempre); descartar o histórico (perde produção real).
