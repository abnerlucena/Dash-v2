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
| D15 | Meta não pode começar no passado | Aprovada | 14/09/2026 |
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
| D31 | Correção da meta de hoje/futura no mesmo dia | Provisória — confirmar com o usuário (em discussão) | 20/09/2026 |
| D32 | Meta de datas anteriores ao histórico | Aprovada em parte (regra geral) | 21/09/2026 |
| D33 | Autor lê os próprios apontamentos | Aprovada (ver ressalva) | 21/09/2026 |

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
- **Status:** Provisória — em discussão (21/09/2026: o usuário pediu reflexões e propostas de fluxo antes de decidir). Enquanto isso, vale o comportamento descrito abaixo.
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
- **Status:** Aprovada em 21/09/2026, com a ressalva do usuário: a leitura "só os próprios apontamentos" é **a regra do perfil Operador**. Hoje, na prática, isso já acontece: todos os outros perfis-modelo têm `history.view`, `dashboard.view` ou `tv_mode.view` e veem toda a produção. **Em aberto:** se deve virar trava explícita por perfil (ver pergunta registrada no PR #15).
- **Contexto:** a referência dizia "leitura de produção: `history.view` OR `dashboard.view` OR `tv_mode.view`". O perfil Operador não tem nenhuma dessas, mas tem `production.edit_own` (corrigir o próprio apontamento por 24 h, D24) — e não dá para corrigir o que não se vê.
- **Decisão:** a política de leitura de `production_records` também libera os apontamentos em que `created_by` é o próprio usuário (ativo). As ordens seguem o apontamento-pai.
- **Alternativa rejeitada:** dar `history.view` ao Operador (ele passaria a ver a produção de todos).
