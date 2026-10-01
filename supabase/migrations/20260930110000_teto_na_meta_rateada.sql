-- ════════════════════════════════════════════════════════════════════════════
-- Migration 0025 — Teto na meta rateada pela lotação
-- Decisões: D47, D49 (nova)
--
-- O QUE ESTAVA ERRADO: numa horizontal com lotação padrão de 4, um turno que
-- rodasse com 5 pessoas gerava meta de 12.500 em vez de 10.000 — a fórmula
-- crescia sem limite. Bastava um reforço no turno para a meta subir sozinha.
--
-- A REGRA NOVA: a meta para de crescer na lotação padrão.
--
--   meta efetiva = meta × menor(pessoas, lotação padrão) ÷ lotação padrão
--
-- Com meta 10.000 e lotação 4:  3 pessoas → 7.500 · 4 → 10.000 · 8 → 10.000.
-- Gente a MENOS continua reduzindo proporcionalmente; gente a MAIS não soma.
--
-- POR QUÊ: quem limita a produção é a máquina, não a quantidade de gente.
-- Pôr uma quinta pessoa numa embaladora não a faz embalar mais rápido.
--
-- O teto é no NÚMERO DE PESSOAS, não no valor da meta: trocar a meta de 10.000
-- para 15.000 não muda a regra, só a escala. E se a lotação padrão mudar de 4
-- para 5, o teto se move junto, porque a regra lê o cadastro da máquina.
--
-- A MESMA REGRA VIVE EM DOIS LUGARES (D48): aqui e em `src/lib/metas.ts`, que
-- é o que a tela usa para mostrar a meta antes de salvar. As duas mudam
-- juntas, no mesmo commit, senão a tela mostra um número e o relatório outro.
--
-- NÃO MEXE em `adjusted_target` nem em `staffing_ratio`: são colunas da D12,
-- anteriores às três bases, e nenhuma tela do app as consome hoje. Mexer nelas
-- seria mudar o significado de um indicador que ninguém está lendo.
--
-- Só a view muda. Nenhum dado é tocado — a conta é feita na leitura.
-- ════════════════════════════════════════════════════════════════════════════

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
      -- O `least` é o teto: gente ACIMA da lotação padrão não aumenta a meta.
      -- Quem limita a produção é a máquina, não a quantidade de pessoas. Gente
      -- a MENOS continua reduzindo a meta proporcionalmente.
      then round(r.target_quantity
                 * least(r.operator_count, m.standard_operator_count)::numeric
                 / m.standard_operator_count)::integer
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

  'Resumo por apontamento: produção boa, retrabalho, meta efetiva e se conta para a meta. A meta rateada tem teto na lotação padrão. [D12, D46, D47, D48, D49]';
