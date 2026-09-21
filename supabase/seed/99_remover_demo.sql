-- ═══════════════════════════════════════════════════════════════════════════
-- REMOVER o seed de demonstração (90_demo_REMOVER.sql)
--
-- Apaga SOMENTE o que começa com "[DEMO]": apontamentos (as ordens vão junto,
-- em cascata) e eventos do calendário. Dados reais não são tocados.
-- Rodar antes de migrar os dados reais da planilha.
--
-- Como na carga, a auditoria fica desligada durante a remoção (os dados
-- fictícios nunca entraram no log, então a remoção também não precisa entrar).
-- ═══════════════════════════════════════════════════════════════════════════

begin;

alter table public.production_records    disable trigger audit_row_change;
alter table public.production_orders     disable trigger audit_row_change;
alter table public.calendar_events       disable trigger audit_row_change;
alter table public.calendar_event_shifts disable trigger audit_row_change;

delete from public.production_records where notes like '[DEMO]%';
delete from public.calendar_events    where description like '[DEMO]%';

alter table public.production_records    enable trigger audit_row_change;
alter table public.production_orders     enable trigger audit_row_change;
alter table public.calendar_events       enable trigger audit_row_change;
alter table public.calendar_event_shifts enable trigger audit_row_change;

commit;

-- Conferência: as duas contagens devem dar zero.
select
  (select count(*) from public.production_records where notes like '[DEMO]%')    as apontamentos_demo,
  (select count(*) from public.calendar_events    where description like '[DEMO]%') as eventos_demo;
