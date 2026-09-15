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
