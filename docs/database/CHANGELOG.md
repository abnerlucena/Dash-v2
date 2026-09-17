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
