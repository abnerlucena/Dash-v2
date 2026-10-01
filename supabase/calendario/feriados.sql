-- Feriados nacionais 2026, 2027, da BrasilAPI.
-- Gerado por supabase/calendario/feriados.cjs em 2026-10-01.
--
-- NÃO inclui feriados estaduais (SC), municipais (Itajaí), paradas da
-- fábrica nem férias coletivas. Esses entram à mão.
--
-- Idempotente: o índice calendar_events_brasil_api_date_key impede duplicar.

begin;

insert into public.calendar_events (event_date, description, event_type, scope, source)
values
  ('2026-01-01'::date, 'Confraternização mundial', 'holiday', 'national', 'brasil_api'),
  ('2026-02-16'::date, 'Carnaval', 'holiday', 'national', 'brasil_api'),
  ('2026-02-17'::date, 'Carnaval', 'holiday', 'national', 'brasil_api'),
  ('2026-04-03'::date, 'Sexta-feira Santa', 'holiday', 'national', 'brasil_api'),
  ('2026-04-05'::date, 'Páscoa', 'holiday', 'national', 'brasil_api'),
  ('2026-04-21'::date, 'Tiradentes', 'holiday', 'national', 'brasil_api'),
  ('2026-05-01'::date, 'Dia do trabalho', 'holiday', 'national', 'brasil_api'),
  ('2026-06-04'::date, 'Corpus Christi', 'holiday', 'national', 'brasil_api'),
  ('2026-09-07'::date, 'Independência do Brasil', 'holiday', 'national', 'brasil_api'),
  ('2026-10-12'::date, 'Nossa Senhora Aparecida', 'holiday', 'national', 'brasil_api'),
  ('2026-11-02'::date, 'Finados', 'holiday', 'national', 'brasil_api'),
  ('2026-11-15'::date, 'Proclamação da República', 'holiday', 'national', 'brasil_api'),
  ('2026-11-20'::date, 'Dia da consciência negra', 'holiday', 'national', 'brasil_api'),
  ('2026-12-25'::date, 'Natal', 'holiday', 'national', 'brasil_api'),
  ('2027-01-01'::date, 'Confraternização mundial', 'holiday', 'national', 'brasil_api'),
  ('2027-02-08'::date, 'Carnaval', 'holiday', 'national', 'brasil_api'),
  ('2027-02-09'::date, 'Carnaval', 'holiday', 'national', 'brasil_api'),
  ('2027-03-26'::date, 'Sexta-feira Santa', 'holiday', 'national', 'brasil_api'),
  ('2027-03-28'::date, 'Páscoa', 'holiday', 'national', 'brasil_api'),
  ('2027-04-21'::date, 'Tiradentes', 'holiday', 'national', 'brasil_api'),
  ('2027-05-01'::date, 'Dia do trabalho', 'holiday', 'national', 'brasil_api'),
  ('2027-05-27'::date, 'Corpus Christi', 'holiday', 'national', 'brasil_api'),
  ('2027-09-07'::date, 'Independência do Brasil', 'holiday', 'national', 'brasil_api'),
  ('2027-10-12'::date, 'Nossa Senhora Aparecida', 'holiday', 'national', 'brasil_api'),
  ('2027-11-02'::date, 'Finados', 'holiday', 'national', 'brasil_api'),
  ('2027-11-15'::date, 'Proclamação da República', 'holiday', 'national', 'brasil_api'),
  ('2027-11-20'::date, 'Dia da consciência negra', 'holiday', 'national', 'brasil_api'),
  ('2027-12-25'::date, 'Natal', 'holiday', 'national', 'brasil_api')
on conflict do nothing;

-- Confira antes de confirmar. Para desistir: rollback;
commit;
