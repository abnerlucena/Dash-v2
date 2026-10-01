-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0021 — A meta por operador entra no cálculo (D39, D46)
--
-- O PROBLEMA
-- A Bancada Embalagem A Granél é medida em 25.000 peças POR PESSOA no turno.
-- A meta dela já está gravada assim desde 25/09 (`machine_targets.basis =
-- 'per_operator'`, migration 0013), mas NINGUÉM usava esse campo: o
-- apontamento copiava 25.000 e o dashboard comparava a produção do turno
-- inteiro — três pessoas, 75.000 peças de meta real — com 25.000. Resultado:
-- atingimento de 300% onde o certo era 100%.
--
-- A ESCOLHA (D46): a base fica CONGELADA no apontamento, junto com a meta que
-- já era congelada (D08), e a multiplicação acontece na LEITURA (na view).
--   • congelar a base: o apontamento de ontem continua sendo lido como ontem,
--     mesmo que a meta mude de base amanhã;
--   • multiplicar na leitura: se alguém corrigir o nº de operadores depois, a
--     meta efetiva se corrige sozinha — não fica uma conta velha gravada.
--
-- O QUE ESTA MIGRATION NÃO FAZ, DE PROPÓSITO
--   • não mexe em nenhum apontamento que já existe. Todos continuam
--     'per_shift' (o default da coluna nova), inclusive os 2.507 do histórico
--     importado: a planilha nunca distinguiu meta por turno de meta por
--     pessoa, e inventar essa distinção agora mudaria a história com base num
--     palpite. Vale para o passado; a partir daqui, cada apontamento novo de
--     A Granél nasce com a base certa. Ver D46.
--   • não muda `machine_target_on()`: ela continua devolvendo o número cru da
--     meta (25.000 para A Granél). Quem lê aquele número precisa ler a base
--     junto — é o que o comentário da função passa a avisar.
--   • não torna a meta proporcional ao tempo útil do turno (D42, ainda aberto).
--
-- Idempotente: `add column if not exists` e `create or replace` em tudo.
-- Nada é apagado.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. A base da meta congelada no apontamento ─────────────────────────────
-- Irmã de `target_quantity`: uma guarda QUANTO era a meta no dia, a outra
-- guarda COMO ler esse número. Sem a segunda, 25.000 é ambíguo.
--
-- O default 'per_shift' faz todo apontamento que já existe continuar se
-- comportando exatamente como hoje, sem precisar tocar em nenhuma linha.
alter table public.production_records
  add column if not exists target_basis text not null default 'per_shift'
  check (target_basis in ('per_shift', 'per_operator'));

comment on column public.production_records.target_basis is
  'Como ler target_quantity: per_shift (meta do turno inteiro) ou per_operator '
  '(meta de cada pessoa, multiplicada pela lotação deste apontamento). Foto da '
  'base vigente no dia, como target_quantity é foto da meta. [D08, D39, D46]';


-- ─── 2. machine_target_basis_on(máquina, data) ──────────────────────────────
-- A base vigente de uma máquina numa data. Mesma regra da `machine_target_on`:
-- a meta de maior `valid_from` que não passe da data pedida e, para datas
-- anteriores ao início do histórico, a meta mais antiga conhecida (D32).
-- As duas funções andam juntas — quem chama uma precisa da outra.
create or replace function public.machine_target_basis_on(p_machine_id integer, p_date date)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select t.basis from public.machine_targets t
      where t.machine_id = p_machine_id and t.valid_from <= p_date
      order by t.valid_from desc limit 1),
    -- Nenhuma meta até esta data: usa a base da meta mais antiga que existe.
    (select t.basis from public.machine_targets t
      where t.machine_id = p_machine_id
      order by t.valid_from asc limit 1),
    'per_shift'   -- máquina sem meta nenhuma cadastrada
  )
$$;

comment on function public.machine_target_basis_on(integer, date) is
  'Base da meta vigente de uma máquina numa data (per_shift | per_operator). '
  'Companheira de machine_target_on: o número sem a base é ambíguo. [D39, D46]';

-- Aviso na função antiga, para ninguém usar o número sozinho.
comment on function public.machine_target_on(integer, date) is
  'Meta vigente de uma máquina numa data, número CRU. Para A Granél são 25.000 '
  'POR PESSOA: leia junto com machine_target_basis_on(). [D13, D32, D39]';


-- ─── 3. O apontamento passa a congelar a base junto com a meta ──────────────
-- Igual à versão de 20/09, com uma linha a mais no insert: `target_basis`.
-- O resto do corpo é o mesmo — está repetido inteiro porque o PostgreSQL não
-- sabe substituir só um pedaço de uma função.
create or replace function public.save_production_record(
  p_production_date date,
  p_shift_id        smallint,
  p_machine_id      integer,
  p_orders          jsonb    default null,
  p_notes           text     default null,
  p_operator_count  smallint default null,
  p_work_mode       text     default 'regular',
  p_replace_orders  boolean  default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mode text := coalesce(p_work_mode, 'regular');
  v_rec  public.production_records;
  v_id   uuid;
begin
  select * into v_rec
    from public.production_records
   where machine_id = p_machine_id
     and production_date = p_production_date
     and shift_id = p_shift_id
     and work_mode = v_mode
   for update;  -- trava a linha: dois salvamentos simultâneos não se atropelam

  if not found then
    if not public.has_permission('production.create') then
      raise exception 'Você não tem permissão para apontar produção.' using errcode = '42501';
    end if;

    insert into public.production_records
      (production_date, shift_id, machine_id, target_quantity, target_basis,
       operator_count, work_mode, notes, created_by)
    values (
      p_production_date,
      p_shift_id,
      p_machine_id,
      coalesce(public.machine_target_on(p_machine_id, p_production_date), 0),
      -- A base vem da mesma meta de onde veio o número, no mesmo dia.
      public.machine_target_basis_on(p_machine_id, p_production_date),
      coalesce(p_operator_count,
               (select m.standard_operator_count from public.machines m where m.id = p_machine_id)),
      v_mode,
      nullif(trim(p_notes), ''),
      auth.uid()
    )
    returning id into v_id;
  else
    if not public.can_edit_production_record(v_rec.created_by, v_rec.created_at) then
      raise exception 'Já existe apontamento desta máquina neste dia e turno, e você não tem permissão para alterá-lo.'
        using errcode = '42501';
    end if;
    v_id := v_rec.id;

    update public.production_records
       set notes          = case when p_notes is null then notes else nullif(trim(p_notes), '') end,
           operator_count = coalesce(p_operator_count, operator_count),
           updated_by     = auth.uid()
     where id = v_id;

    if p_replace_orders and p_orders is not null then
      delete from public.production_orders where production_record_id = v_id;
    end if;
  end if;

  perform public.insert_production_orders(v_id, p_orders);
  return v_id;
end;
$$;

comment on function public.save_production_record(date, smallint, integer, jsonb, text, smallint, text, boolean) is
  'Salva apontamento + ordens numa transação. Congela a meta e a base do dia. [D08, D10, D24, D27, D30, D39]';


-- ─── 4. A view passa a entregar a meta efetiva ──────────────────────────────
-- `effective_target` é a meta com que a produção do turno deve ser comparada.
-- É ela que as telas passam a usar; as colunas antigas continuam no lugar.
--
--   per_shift     → a própria meta gravada (comportamento de sempre)
--   per_operator  → meta × pessoas do apontamento
--
-- Se o nº de operadores não foi informado, cai na lotação padrão da máquina
-- (D39); sem lotação padrão cadastrada, multiplica por 1 — o número cru, que
-- é o menor palpite possível. Nunca por zero: meta zero significa "não conta
-- para meta" no resto do sistema, e seria uma mentira diferente.
--
-- `adjusted_target` (D12, a meta corrigida pela lotação) também foi consertada:
-- para uma máquina per_operator a conta antiga — meta × pessoas ÷ lotação
-- padrão — devolvia 25.000 de novo, porque a lotação real já está embutida na
-- multiplicação. Agora ela repete a meta efetiva nesse caso.
--
-- "create or replace" exige manter as colunas que já existem, na mesma ordem;
-- a nova entra no fim. Trocar a CONTA de uma coluna existente é permitido.
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
  case
    when r.target_basis = 'per_operator'
      then (r.target_quantity * coalesce(r.operator_count, m.standard_operator_count, 1))::integer
    when r.operator_count is not null and m.standard_operator_count > 0
      then round(r.target_quantity * r.operator_count::numeric / m.standard_operator_count)::integer
  end                                                 as adjusted_target,
  coalesce(x.is_excluded, false)                      as is_excluded_day,
  (r.work_mode = 'regular' and not coalesce(x.is_excluded, false)) as counts_toward_target,
  -- Coluna nova: a meta com que comparar a produção deste turno.
  case
    when r.target_basis = 'per_operator'
      then (r.target_quantity * coalesce(r.operator_count, m.standard_operator_count, 1))::integer
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
  '(effective_target: já multiplicada pelas pessoas quando a base é por operador) '
  'e se contam para meta. [D11, D12, D16, D27, D39, D46]';


-- ═══════════════════════════════════════════════════════════════════════════
-- Estado esperado depois desta migration:
--   • todo apontamento tem `target_basis`; os que já existiam ficaram
--     'per_shift', então nenhum número mudou para trás;
--   • um apontamento NOVO de A Granél nasce 'per_operator' e a view devolve
--     25.000 × pessoas em `effective_target`;
--   • as telas passam a ler `effective_target` (src/lib/repositories/supabase/
--     adapters.ts). Onde ela é nula — não acontece, mas o tipo permite —, o
--     app cai em `target_quantity`, que é o comportamento de antes.
--
-- Como conferir depois de aplicar (A Granél é a máquina 7):
--   select production_date, target_quantity, target_basis, operator_count,
--          effective_target
--     from production_summary
--    where machine_id = 7
--    order by production_date desc limit 5;
--
-- ATENÇÃO, e isto é dado, não código: a lotação padrão de A Granél está
-- cadastrada como 1 pessoa (migration 0014). Como o apontamento que não informa
-- operadores cai na lotação padrão, ele vai continuar valendo 25.000. Ou a
-- equipe informa quantas pessoas trabalharam — é o certo, e a tela de
-- apontamento agora mostra a conta acontecendo —, ou o gestor corrige a lotação
-- padrão da bancada. Nenhuma das duas é decisão de migration.
--   update machines set standard_operator_count = <n> where id = 7;
-- ═══════════════════════════════════════════════════════════════════════════
