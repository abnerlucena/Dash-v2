-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0023 — Zero pessoas é "não informado" (D48)
--
-- O PROBLEMA (revisão da PR 23)
-- A tela de apontamento (src/lib/metas.ts) e a view (`effective_target`)
-- faziam a conta da meta de jeitos diferentes quando o nº de operadores era 0:
--   • a tela tratava 0 como "não informado" e usava a lotação padrão;
--   • a view multiplicava por 0 → meta 0, que no resto do sistema significa
--     "não conta para meta". O turno sumia do atingimento sem aviso.
-- `operator_count` aceita 0 (check >= 0), então o caso acontece.
--
-- A REGRA ÚNICA (a mesma de src/lib/metas.ts, com teste dos dois lados):
--   pessoas = operador informado > 0, senão lotação padrão > 0, senão nenhuma
--   per_shift           → a meta gravada
--   per_shift_prorated  → meta × pessoas ÷ lotação; sem pessoas ou sem lotação,
--                         a meta cheia
--   per_operator        → meta × pessoas; sem pessoas nenhuma, × 1
--
-- Só a view muda: nenhuma linha é alterada, nenhuma coluna muda de lugar.
-- Idempotente (create or replace).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace view public.production_summary
with (security_invoker = true)
as
select
  r.id,
  r.production_date,
  r.shift_id,
  s.name                                              as shift_name,
  r.machine_id,
  m.name                                              as machine_name,
  r.target_quantity,
  r.operator_count,
  r.work_mode,
  r.notes,
  r.created_by,
  r.updated_by,
  r.created_at,
  r.updated_at,
  coalesce(o.good_quantity, 0)::integer               as good_quantity,
  coalesce(o.rework_quantity, 0)::integer             as rework_quantity,
  (coalesce(o.good_quantity, 0) + coalesce(o.rework_quantity, 0))::integer as total_quantity,
  coalesce(o.order_count, 0)::integer                 as order_count,
  case when r.operator_count is not null and m.standard_operator_count > 0
       then round(r.operator_count::numeric / m.standard_operator_count, 4)
  end                                                 as staffing_ratio,
  -- Meta corrigida pela lotação (D12), como informação. 0 pessoas = não informado.
  case
    when r.target_basis = 'per_operator'
      then (r.target_quantity * coalesce(nullif(r.operator_count, 0),
                                         nullif(m.standard_operator_count, 0), 1))::integer
    when nullif(r.operator_count, 0) is not null and m.standard_operator_count > 0
      then round(r.target_quantity * r.operator_count::numeric / m.standard_operator_count)::integer
  end                                                 as adjusted_target,
  coalesce(x.is_excluded, false)                      as is_excluded_day,
  (r.work_mode = 'regular' and not coalesce(x.is_excluded, false)) as counts_toward_target,
  -- A meta com que comparar a produção deste turno (D46, D47, D48).
  case
    when r.target_basis = 'per_operator'
      then (r.target_quantity * coalesce(nullif(r.operator_count, 0),
                                         nullif(m.standard_operator_count, 0), 1))::integer
    when r.target_basis = 'per_shift_prorated'
         and nullif(r.operator_count, 0) is not null
         and m.standard_operator_count > 0
      then round(r.target_quantity * r.operator_count::numeric / m.standard_operator_count)::integer
    else r.target_quantity
  end                                                 as effective_target,
  r.target_basis
from public.production_records r
join public.machines m on m.id = r.machine_id
join public.shifts   s on s.id = r.shift_id
left join lateral (
  select sum(po.quantity) filter (where not po.is_rework) as good_quantity,
         sum(po.quantity) filter (where po.is_rework)     as rework_quantity,
         count(*)                                         as order_count
    from public.production_orders po
   where po.production_record_id = r.id
) o on true
left join lateral (
  select true as is_excluded
    from public.calendar_events e
   where e.event_date = r.production_date
     and e.event_type = 'excluded_day'
     and (
       not exists (select 1 from public.calendar_event_shifts es where es.event_id = e.id)
       or exists (select 1 from public.calendar_event_shifts es
                   where es.event_id = e.id and es.shift_id = r.shift_id)
     )
   limit 1
) x on true;

comment on view public.production_summary is
  'Apontamentos com produção boa, retrabalho, total, lotação, meta efetiva '
  '(effective_target: resolvida conforme a base — fixa, rateada pela lotação ou '
  'por pessoa; 0 pessoas = não informado) e se contam para meta. '
  '[D11, D12, D16, D27, D39, D46, D47, D48]';

-- Como conferir depois de aplicar: rodar supabase/tests/06_meta_por_lotacao.sql
-- (casos 13 e 14 cobrem o zero).
