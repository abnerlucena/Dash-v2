-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SEED DE DEMONSTRAÇÃO — DADOS FICTÍCIOS — NÃO É PRODUÇÃO REAL              ║
-- ║                                                                           ║
-- ║  ~30 dias de apontamentos inventados, para ver o dashboard funcionando    ║
-- ║  no modo Supabase antes da migração dos dados da planilha.                ║
-- ║                                                                           ║
-- ║  Como reconhecer: toda linha criada aqui tem a observação começando por   ║
-- ║  "[DEMO]" (apontamentos e eventos do calendário).                         ║
-- ║                                                                           ║
-- ║  Como remover: rode supabase/seed/99_remover_demo.sql                     ║
-- ║  (OBRIGATÓRIO antes de migrar os dados reais da planilha).                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
--
-- Pré-requisito: seed estrutural (01_estrutural.sql) aplicado.
-- Idempotente: rodar de novo não duplica (a regra de unicidade do apontamento
-- barra repetições e só apontamentos NOVOS recebem ordens).
--
-- Os números são "aleatórios" mas sempre os mesmos (calculados a partir de
-- máquina + data + turno), para que duas execuções gerem o mesmo resultado.
--
-- Auditoria: os gatilhos de auditoria ficam desligados SÓ durante esta carga,
-- para que dados fictícios não fiquem para sempre no log (que não pode ser
-- apagado). Tudo roda numa transação: se algo falhar, nada fica pela metade e
-- os gatilhos voltam ligados.

begin;

alter table public.production_records    disable trigger audit_row_change;
alter table public.production_orders     disable trigger audit_row_change;
alter table public.calendar_events       disable trigger audit_row_change;
alter table public.calendar_event_shifts disable trigger audit_row_change;


-- ─── 1. Eventos de calendário fictícios ─────────────────────────────────────
-- Um "dia anulado" só para o TURNO 2 (sai do cálculo de meta) e um feriado.
insert into public.calendar_events (event_date, description, event_type, scope)
select d, desc_, type_, 'company'
  from (values
    (((now() at time zone 'America/Sao_Paulo')::date - 9),  '[DEMO] Falta de energia (turno 2)', 'excluded_day'),
    (((now() at time zone 'America/Sao_Paulo')::date - 13), '[DEMO] Feriado fictício',           'holiday')
  ) as v(d, desc_, type_)
 where not exists (
   select 1 from public.calendar_events e where e.event_date = v.d and e.description = v.desc_
 );

insert into public.calendar_event_shifts (event_id, shift_id)
select e.id, 2
  from public.calendar_events e
 where e.description = '[DEMO] Falta de energia (turno 2)'
on conflict do nothing;


-- ─── 2. Apontamentos + ordens ───────────────────────────────────────────────
with dias as (
  -- últimos 30 dias até ontem, sem domingos
  select d::date as dia
    from generate_series(
           (now() at time zone 'America/Sao_Paulo')::date - 30,
           (now() at time zone 'America/Sao_Paulo')::date - 1,
           interval '1 day') as d
   where extract(isodow from d) <> 7
),
base as (
  -- turnos 1 e 2 normais, em todas as máquinas com meta > 0
  select dia, s.shift_id, m.id as machine_id, 'regular'::text as work_mode,
         public.machine_target_on(m.id, dia) as meta
    from dias
   cross join (values (1::smallint), (2::smallint)) as s(shift_id)
    join public.machines m on m.id between 1 and 16
  union all
  -- hora extra de madrugada (TURNO 3) em alguns sábados, nas horizontais
  select dia, 3::smallint, m.id, 'overtime', public.machine_target_on(m.id, dia)
    from dias
    join public.machines m on m.id in (1, 2)
   where extract(isodow from dia) = 6
),
sorteio as (
  select b.*,
         abs(hashtext(b.machine_id || '|' || b.dia || '|' || b.shift_id || '|' || b.work_mode)) as h
    from base b
),
novos as (
  insert into public.production_records
    (production_date, shift_id, machine_id, target_quantity, operator_count, work_mode, notes)
  select dia, shift_id, machine_id,
         case when work_mode = 'overtime' then 0 else meta end,
         case when h % 10 = 0 then 1 else 2 end,          -- 10% dos turnos com 1 operador só
         work_mode,
         '[DEMO] dado fictício'
    from sorteio
  on conflict on constraint production_records_unique_entry do nothing
  returning id, production_date, shift_id, machine_id, work_mode, target_quantity
),
qtd as (
  select n.*,
         abs(hashtext(n.id::text)) as h,
         -- produção boa entre 60% e 115% da meta (hora extra: 150 a 450 peças)
         case when n.work_mode = 'overtime'
              then 150 + abs(hashtext(n.id::text)) % 300
              else greatest(round(n.target_quantity * (0.60 + (abs(hashtext(n.id::text)) % 56) / 100.0)), 1)::int
         end as boa
    from novos n
)
insert into public.production_orders (production_record_id, order_number, quantity, is_rework)
-- ordem principal
select id, '0000010' || lpad((100000 + h % 90000)::text, 5, '0'), greatest(boa - boa / 3, 1), false from qtd
union all
-- segunda ordem (mesmo apontamento, OP diferente)
select id, '0000010' || lpad((100000 + (h + 7) % 90000)::text, 5, '0'), boa / 3, false from qtd where boa / 3 > 0
union all
-- retrabalho em ~15% dos apontamentos normais
select id, '0000010' || lpad((100000 + (h + 13) % 90000)::text, 5, '0'),
       greatest(round(boa * 0.1)::int, 1), true
  from qtd where work_mode = 'regular' and h % 100 < 15;


alter table public.production_records    enable trigger audit_row_change;
alter table public.production_orders     enable trigger audit_row_change;
alter table public.calendar_events       enable trigger audit_row_change;
alter table public.calendar_event_shifts enable trigger audit_row_change;

commit;
