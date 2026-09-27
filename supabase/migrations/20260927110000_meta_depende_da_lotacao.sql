-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0022 — Onde a lotação muda a meta: granel e horizontais (D47)
--
-- O QUE O GESTOR ESCLARECEU (27/09/2026)
-- O nº de operadores do posto no turno só faz diferença em DOIS lugares:
--   • Bancada Embalagem A Granél — trabalho manual: cada pessoa embala. Dobrar
--     as pessoas dobra a produção, e a meta acompanha (25.000 por pessoa).
--   • Embaladoras Horizontais N°1 e N°2 — a linha precisa de 4 pessoas para
--     render as 10.000 do turno. Com 3, não rende 10.000; render 7.500 é o
--     esperado, não um fracasso.
-- Nas outras, quem dita o ritmo é a máquina: mais gente na volta não faz sair
-- mais peça, e cobrar meta maior por isso seria errado.
--
-- Essas são DUAS regras diferentes, e a 0021 só tinha lugar para uma:
--   A Granél  → a meta gravada é de CADA pessoa    → meta × pessoas
--   Horizontal→ a meta gravada é do turno CHEIO     → meta × pessoas ÷ lotação
--
-- A SEGUNDA é a conta que a D12 já calculava em `adjusted_target` desde 20/09,
-- como informação que ninguém usava. Agora ela vale como meta — mas SÓ onde a
-- base disser, e é por isso que a base ganha um terceiro valor em vez de a
-- conta valer para todo mundo.
--
-- `machine_targets.basis` (e a foto dela no apontamento) passa a ter três:
--   per_shift            meta fixa do turno; a lotação não muda nada (padrão)
--   per_shift_prorated   meta do turno com a lotação padrão; rateada pela real
--   per_operator         meta de cada pessoa; multiplicada pela lotação real
--
-- TAMBÉM CONSERTA UM BURACO SÉRIO, encontrado ao escrever isto:
-- `save_machine_targets` — a função do botão "Salvar Metas" — grava a meta nova
-- SEM a base. Como a coluna tem default 'per_shift', bastava o gestor editar a
-- meta de A Granél na tela para o "por pessoa" virar "por turno", sem aviso
-- nenhum, e o atingimento voltar a mentir. A partir daqui a função carrega a
-- base que a máquina já tinha: mudar o NÚMERO nunca muda a REGRA DE LEITURA.
--
-- Idempotente. Nada é apagado; as constraints de CHECK são recriadas para
-- aceitar o valor novo (nenhuma linha é alterada por isso).
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. As duas colunas passam a aceitar o terceiro valor ───────────────────
-- Trocar o "check" exige derrubar e recriar: o PostgreSQL não sabe alterar uma
-- restrição no lugar. A ordem importa — enquanto a antiga estiver lá, o valor
-- novo é recusado. Nenhum dado é tocado, e a restrição continua existindo em
-- todo instante depois de recriada.
--
-- O nome antigo (`machine_targets_basis_check`) é o que o PostgreSQL gerou
-- sozinho na 0013; o novo é explícito, para a próxima vez ser mais fácil.
alter table public.machine_targets
  drop constraint if exists machine_targets_basis_check;
alter table public.machine_targets
  drop constraint if exists machine_targets_basis_valido;
alter table public.machine_targets
  add constraint machine_targets_basis_valido
  check (basis in ('per_shift', 'per_shift_prorated', 'per_operator'));

comment on column public.machine_targets.basis is
  'Como ler quantity_per_shift: per_shift (meta do turno, lotação não conta), '
  'per_shift_prorated (meta do turno com a lotação padrão, rateada pela real) '
  'ou per_operator (meta de cada pessoa, multiplicada pela lotação real). [D39, D47]';

alter table public.production_records
  drop constraint if exists production_records_target_basis_check;
alter table public.production_records
  drop constraint if exists production_records_target_basis_valido;
alter table public.production_records
  add constraint production_records_target_basis_valido
  check (target_basis in ('per_shift', 'per_shift_prorated', 'per_operator'));

comment on column public.production_records.target_basis is
  'Foto da base da meta no dia do apontamento: per_shift, per_shift_prorated ou '
  'per_operator. Diz como ler target_quantity. [D08, D39, D46, D47]';


-- ─── 2. A meta efetiva agora tem três caminhos ──────────────────────────────
-- Só a linha do `effective_target` muda em relação à 0021; a view está repetida
-- inteira porque o PostgreSQL não substitui um pedaço de view.
--
--   per_shift           → a meta gravada, sem conta nenhuma
--   per_shift_prorated  → meta × pessoas ÷ lotação padrão  (a conta da D12)
--   per_operator        → meta × pessoas
--
-- Sem o nº de operadores informado, as duas últimas caem na lotação padrão da
-- máquina — o que dá, para a rateada, exatamente a meta cheia. É o palpite
-- certo: "não informaram" não é "trabalharam sozinhos".
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
  -- Meta corrigida pela lotação (D12): continua sendo calculada para toda
  -- máquina, como informação. Só vale como META onde a base manda.
  case
    when r.target_basis = 'per_operator'
      then (r.target_quantity * coalesce(r.operator_count, m.standard_operator_count, 1))::integer
    when r.operator_count is not null and m.standard_operator_count > 0
      then round(r.target_quantity * r.operator_count::numeric / m.standard_operator_count)::integer
  end                                                 as adjusted_target,
  coalesce(x.is_excluded, false)                      as is_excluded_day,
  (r.work_mode = 'regular' and not coalesce(x.is_excluded, false)) as counts_toward_target,
  -- A meta com que comparar a produção deste turno.
  case
    when r.target_basis = 'per_operator'
      then (r.target_quantity * coalesce(r.operator_count, m.standard_operator_count, 1))::integer
    when r.target_basis = 'per_shift_prorated'
         and r.operator_count is not null
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
  'por pessoa) e se contam para meta. [D11, D12, D16, D27, D39, D46, D47]';


-- ─── 3. Salvar meta nova não muda mais a base ───────────────────────────────
-- Igual à versão de 20/09, com `basis` no insert: a base vem da que a máquina
-- já tinha naquela data. Sem isso, a tela de metas apagava a regra de leitura
-- toda vez que alguém corrigia um número.
create or replace function public.save_machine_targets(
  p_targets    jsonb,
  p_valid_from date default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from  date := coalesce(p_valid_from, (now() at time zone 'America/Sao_Paulo')::date);
  v_key   text;
  v_value jsonb;
  v_qty   integer;
  v_count integer := 0;
begin
  if not public.has_permission('targets.manage') then
    raise exception 'Você não tem permissão para alterar metas.' using errcode = '42501';
  end if;
  if p_targets is null or jsonb_typeof(p_targets) <> 'object' then
    raise exception 'Metas inválidas.' using errcode = '22023';
  end if;

  for v_key, v_value in select * from jsonb_each(p_targets) loop
    v_qty := greatest(round((v_value #>> '{}')::numeric)::integer, 0);
    if v_qty is distinct from public.machine_target_on(v_key::integer, v_from)
       or not exists (select 1 from public.machine_targets t where t.machine_id = v_key::integer) then
      insert into public.machine_targets (machine_id, quantity_per_shift, valid_from, basis, created_by)
      values (v_key::integer, v_qty, v_from,
              -- A base que a máquina já usava nesta data. Mudar o número não
              -- muda como o número é lido.
              public.machine_target_basis_on(v_key::integer, v_from),
              auth.uid())
      on conflict (machine_id, valid_from)
      do update set quantity_per_shift = excluded.quantity_per_shift,
                    created_by         = excluded.created_by,
                    created_at         = now();
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

comment on function public.save_machine_targets(jsonb, date) is
  'Grava novas metas (só as que mudaram), vigentes a partir de p_valid_from (>= hoje), '
  'preservando a base de cada máquina. Exige targets.manage. [D13, D15, D31, D47]';


-- ─── 4. As horizontais passam a ter a meta rateada pela lotação ─────────────
-- Degrau novo, a partir de hoje: o NÚMERO continua 10.000: é a meta do turno
-- com as 4 pessoas da lotação padrão. O que muda é a leitura — com 3 pessoas a
-- meta do turno passa a ser 7.500.
--
-- Por que um degrau novo e não uma correção da meta de 25/09: a regra de
-- leitura mudou HOJE. Os turnos de antes foram medidos com a régua antiga, e é
-- assim que devem continuar sendo lidos (mesmo princípio da D46).
--
-- O "not exists" torna isto repetível: se as horizontais já estiverem
-- rateadas, não nasce degrau nenhum.
insert into public.machine_targets (machine_id, quantity_per_shift, valid_from, basis)
select m.id,
       coalesce(public.machine_target_on(m.id, (now() at time zone 'America/Sao_Paulo')::date), 0),
       (now() at time zone 'America/Sao_Paulo')::date,
       'per_shift_prorated'
  from public.machines m
 where m.name in ('EMBALADORA HORIZONTAL N°1', 'EMBALADORA HORIZONTAL N°2')
   and not exists (
     select 1 from public.current_machine_targets c
      where c.machine_id = m.id and c.basis = 'per_shift_prorated'
   )
on conflict (machine_id, valid_from) do update
   set basis = 'per_shift_prorated';


-- ═══════════════════════════════════════════════════════════════════════════
-- Estado esperado depois desta migration:
--   • A Granél (id 7) → per_operator, 25.000 por pessoa;
--   • Horizontais N°1 e N°2 (ids 1 e 2) → per_shift_prorated, 10.000 com 4
--     pessoas (lotação padrão cadastrada: 4);
--   • todas as outras → per_shift, como sempre;
--   • nenhum apontamento antigo alterado: cada um guarda a base do seu dia;
--   • editar metas na tela não muda mais a base de ninguém.
--
-- Como conferir depois de aplicar:
--   select m.id, m.name, m.standard_operator_count as lotacao,
--          c.quantity_per_shift as meta, c.basis
--     from current_machine_targets c
--     join machines m on m.id = c.machine_id
--    where c.basis <> 'per_shift'
--    order by m.id;
--
--   -- a conta, num apontamento das horizontais com 3 pessoas:
--   select machine_name, target_quantity, target_basis, operator_count,
--          effective_target
--     from production_summary
--    where machine_id in (1, 2, 7)
--    order by production_date desc limit 10;
-- ═══════════════════════════════════════════════════════════════════════════
