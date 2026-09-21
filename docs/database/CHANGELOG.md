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
