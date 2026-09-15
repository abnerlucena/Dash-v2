# Registro de Decisões (ADR)

Cada decisão registra **o contexto**, **o que foi escolhido**, **as alternativas** e **o custo**.
Decisões não são apagadas: quando revistas, recebem o status `Substituída por Dxx`.

Status possíveis: `Aprovada` · `Assumida` (sem confirmação explícita) · `Substituída` · `Proposta`.

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
| D25 | Notificações por destinatário | Assumida | 14/09/2026 |
| D26 | Log de auditoria por trigger, retenção adiada | Aprovada | 14/09/2026 |

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
- **Status:** assumida — aguardando confirmação explícita.

### D26 — Auditoria
- **Decisão:** `audit_logs` gravado por triggers, com snapshot antes/depois e IP; append-only.
- **Adiado:** política de retenção (decidir junto com o plano Supabase ou a migração para a WEG; o plano Free tem 500 MB).
