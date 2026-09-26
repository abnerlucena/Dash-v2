-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0009 — Views e funções (regras de negócio)
-- Decisões: D08, D10, D11, D12, D13, D15, D16, D20, D22, D23, D24, D27,
--           D30, D31, D32
-- Documentação: docs/database/02-referencia-tecnica.md, seções 4 e 6
--
-- VIEWS (consultas salvas, que se comportam como tabelas só de leitura):
--   production_summary       → apontamentos já com produção boa, retrabalho,
--                              total, lotação, meta ajustada e se conta para meta
--   current_machine_targets  → meta vigente HOJE de cada máquina
--
-- FUNÇÕES DE APOIO (usadas pelas regras de segurança e pelo app):
--   is_active_user, has_permission, my_permissions, machine_target_on,
--   list_profile_names
--
-- FUNÇÕES QUE GRAVAM (chamadas pelo app via "RPC"):
--   save_production_record, update_production_record,
--   delete_production_record, bulk_update_production_records,
--   bulk_delete_production_records, create_machine, save_machine_targets,
--   approve_user, identify_shared_session
--
-- FUNÇÃO DE INSTALAÇÃO (só o dono do banco, pelo SQL Editor):
--   bootstrap_admin
--
-- Como as funções que gravam são seguras:
--   • "security definer": rodam com os direitos do dono do banco, para poder
--     gravar mesmo com o RLS fechando a escrita direta nas tabelas;
--   • por isso CADA UMA confere a permissão de quem chamou logo no início;
--   • "set search_path = ''" impede que alguém troque as tabelas por outras
--     com o mesmo nome em outro schema.
--
-- Idempotente: "create or replace" em tudo.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ PARTE 1 — Funções de apoio ════════════════════════════════════════════

-- ─── is_active_user() ───────────────────────────────────────────────────────
-- "Quem está logado tem um perfil ativo?" Usada nas regras de leitura de
-- cadastros básicos (máquinas, turnos, calendário).
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.status = 'active'
  )
$$;

comment on function public.is_active_user() is
  'true se o usuário logado tem profile com status active.';


-- ─── has_permission(code) ───────────────────────────────────────────────────
-- A pergunta central da segurança: "quem está logado pode fazer X?"
-- Regras:
--   • o perfil precisa estar 'active';
--   • a permissão precisa estar em user_permissions (D22);
--   • se for a conta compartilhada (Admin), só vale se alguém se identificou
--     com o crachá NESTA sessão de login (D23).
create or replace function public.has_permission(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles p
      join public.user_permissions up on up.user_id = p.id
     where p.id = auth.uid()
       and p.status = 'active'
       and up.permission_code = p_code
       and (p.account_type <> 'shared' or public.current_identified_user_id() is not null)
  )
$$;

comment on function public.has_permission(text) is
  'Permissão efetiva do usuário logado: profile ativo + user_permissions + identificação na conta compartilhada. [D22, D23]';


-- ─── my_permissions() ───────────────────────────────────────────────────────
-- Lista das permissões efetivas de quem está logado (mesmas regras de
-- has_permission). O app usa para mostrar/esconder botões — mas quem decide
-- de verdade é o banco.
create or replace function public.my_permissions()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(up.permission_code order by up.permission_code), '{}')
    from public.profiles p
    join public.user_permissions up on up.user_id = p.id
   where p.id = auth.uid()
     and p.status = 'active'
     and (p.account_type <> 'shared' or public.current_identified_user_id() is not null)
$$;

comment on function public.my_permissions() is
  'Permissões efetivas do usuário logado (vazio se pendente, bloqueado ou conta compartilhada sem identificação).';


-- ─── machine_target_on(máquina, data) ───────────────────────────────────────
-- Meta vigente de uma máquina numa data: a de maior valid_from <= data.
-- D32: para datas ANTERIORES ao início do histórico (apontamento atrasado de
-- antes da migração), usa a meta mais antiga conhecida, em vez de zero.
create or replace function public.machine_target_on(p_machine_id integer, p_date date)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select t.quantity_per_shift from public.machine_targets t
      where t.machine_id = p_machine_id and t.valid_from <= p_date
      order by t.valid_from desc limit 1),
    (select t.quantity_per_shift from public.machine_targets t
      where t.machine_id = p_machine_id
      order by t.valid_from asc limit 1)
  )
$$;

comment on function public.machine_target_on(integer, date) is
  'Meta vigente da máquina na data (maior valid_from <= data; antes do histórico, a mais antiga). [D13, D32]';


-- ─── list_profile_names() ───────────────────────────────────────────────────
-- Nome de cada pessoa, para exibir "quem apontou". A tabela profiles tem
-- dados pessoais (nº do crachá) e só o próprio usuário ou o aprovador podem
-- lê-la; esta função entrega APENAS id + nome, e só para usuários ativos.
create or replace function public.list_profile_names()
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name
    from public.profiles p
   where public.is_active_user()
$$;

comment on function public.list_profile_names() is
  'id + nome de todos os perfis, só para usuários ativos (sem crachá nem status). [D04]';


-- ─── Regra de edição de apontamento (D24) ───────────────────────────────────
-- Pode editar/apagar um apontamento quem tem production.edit, OU quem tem
-- production.edit_own, é o autor e o apontamento tem menos de 24 horas.
-- Janela de 24 h (e não "mesmo dia") por causa do turno 3, que atravessa a
-- meia-noite, e do servidor em UTC.
create or replace function public.can_edit_production_record(p_created_by uuid, p_created_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_permission('production.edit')
      or (public.has_permission('production.edit_own')
          and p_created_by = auth.uid()
          and p_created_at > now() - interval '24 hours')
$$;

create or replace function public.can_delete_production_record(p_created_by uuid, p_created_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_permission('production.delete')
      or (public.has_permission('production.edit_own')
          and p_created_by = auth.uid()
          and p_created_at > now() - interval '24 hours')
$$;

comment on function public.can_edit_production_record(uuid, timestamptz) is
  'production.edit, ou production.edit_own sendo autor e dentro de 24 h. [D24]';
comment on function public.can_delete_production_record(uuid, timestamptz) is
  'production.delete, ou production.edit_own sendo autor e dentro de 24 h. [D24]';


-- ─── Ajudante interno: gravar a lista de ordens de um apontamento ───────────
-- Recebe um JSON no formato
--   [{"order_number": "000001004521", "quantity": 3000, "is_rework": false, "notes": "..."}]
-- Ordens com quantidade zero ou vazia são ignoradas (igual ao legado).
create or replace function public.insert_production_orders(p_record_id uuid, p_orders jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_orders is null then
    return 0;
  end if;
  if jsonb_typeof(p_orders) <> 'array' then
    raise exception 'As ordens de produção devem ser enviadas como lista.'
      using errcode = '22023';
  end if;

  insert into public.production_orders (production_record_id, order_number, quantity, is_rework, notes)
  select p_record_id,
         coalesce(trim(o ->> 'order_number'), ''),
         (o ->> 'quantity')::integer,
         coalesce((o ->> 'is_rework')::boolean, false),
         nullif(trim(o ->> 'notes'), '')
    from jsonb_array_elements(p_orders) as o
   where coalesce((o ->> 'quantity')::numeric, 0) > 0;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


-- ═══ PARTE 2 — Views ═══════════════════════════════════════════════════════

-- ─── production_summary ─────────────────────────────────────────────────────
-- Um apontamento por linha, já com as contas feitas:
--   good_quantity        → produção BOA (ordens sem retrabalho) — é esta que
--                          conta para a meta (D11)
--   rework_quantity      → retrabalho
--   total_quantity       → carga da máquina (boa + retrabalho)
--   staffing_ratio       → operadores ÷ lotação padrão (D12)
--   adjusted_target      → meta × staffing_ratio (D12)
--   is_excluded_day      → existe "dia anulado" para essa data/turno (D16)
--   counts_toward_target → entra no cálculo de atingimento de meta?
--                          = turno normal (D27) E dia não anulado (D16)
-- "security_invoker = true": quem consulta a view só vê o que as regras de
-- segurança das tabelas permitem a ELE (e não ao dono da view).
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
  case when r.operator_count is not null and m.standard_operator_count > 0
       then round(r.target_quantity * r.operator_count::numeric / m.standard_operator_count)::integer
  end                                                 as adjusted_target,
  coalesce(x.is_excluded, false)                      as is_excluded_day,
  (r.work_mode = 'regular' and not coalesce(x.is_excluded, false)) as counts_toward_target
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
  'Apontamentos com produção boa, retrabalho, total, lotação, meta ajustada e se contam para meta. [D11, D12, D16, D27]';


-- ─── current_machine_targets ────────────────────────────────────────────────
-- Meta que vale HOJE (fuso de Brasília) para cada máquina: dentre as metas
-- com valid_from <= hoje, a mais recente. Metas agendadas para o futuro
-- ficam de fora até o dia delas chegar.
create or replace view public.current_machine_targets
with (security_invoker = true)
as
select distinct on (t.machine_id)
  t.machine_id,
  t.id          as target_id,
  t.quantity_per_shift,
  t.valid_from,
  t.created_by,
  t.created_at
from public.machine_targets t
where t.valid_from <= (now() at time zone 'America/Sao_Paulo')::date
order by t.machine_id, t.valid_from desc;

comment on view public.current_machine_targets is
  'Meta vigente hoje (America/Sao_Paulo) por máquina: maior valid_from <= hoje. [D13]';


-- ═══ PARTE 3 — Funções que gravam apontamentos ═════════════════════════════

-- ─── save_production_record ─────────────────────────────────────────────────
-- A função do botão "Salvar" do apontamento. Grava registro + ordens numa
-- única transação (ou tudo, ou nada).
--   • Se ainda não existe apontamento para máquina + dia + turno + modo:
--     cria (exige production.create). A meta do dia é copiada (D08) e o nº de
--     operadores, se não informado, vem da lotação padrão da máquina (D12).
--   • Se já existe: COMPLETA o apontamento existente (D10), exigindo as
--     regras de edição (D24). As ordens enviadas são ACRESCENTADAS às que já
--     existem (D30); com p_replace_orders = true, substituem.
--   • p_notes: null = manter a observação atual; '' = apagar.
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
      (production_date, shift_id, machine_id, target_quantity, operator_count, work_mode, notes, created_by)
    values (
      p_production_date,
      p_shift_id,
      p_machine_id,
      coalesce(public.machine_target_on(p_machine_id, p_production_date), 0),
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
  'Cria ou completa o apontamento (máquina+dia+turno+modo) com suas ordens, numa transação. [D08, D10, D24, D27, D30]';


-- ─── update_production_record ───────────────────────────────────────────────
-- Edição de um apontamento pelo id. Cada parâmetro vazio (null) = não mexer.
-- p_orders, quando enviado, SUBSTITUI a lista de ordens.
create or replace function public.update_production_record(
  p_id              uuid,
  p_notes           text     default null,
  p_operator_count  smallint default null,
  p_orders          jsonb    default null,
  p_production_date date     default null,
  p_shift_id        smallint default null,
  p_work_mode       text     default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec public.production_records;
begin
  select * into v_rec from public.production_records where id = p_id for update;
  if not found then
    raise exception 'Apontamento não encontrado.' using errcode = 'P0002';
  end if;
  if not public.can_edit_production_record(v_rec.created_by, v_rec.created_at) then
    raise exception 'Você não tem permissão para editar este apontamento.' using errcode = '42501';
  end if;

  begin
    update public.production_records
       set notes           = case when p_notes is null then notes else nullif(trim(p_notes), '') end,
           operator_count  = coalesce(p_operator_count, operator_count),
           production_date = coalesce(p_production_date, production_date),
           shift_id        = coalesce(p_shift_id, shift_id),
           work_mode       = coalesce(p_work_mode, work_mode),
           updated_by      = auth.uid()
     where id = p_id;
  exception when unique_violation then
    raise exception 'Já existe apontamento desta máquina para a data, o turno e o modo escolhidos.'
      using errcode = '23505';
  end;

  if p_orders is not null then
    delete from public.production_orders where production_record_id = p_id;
    perform public.insert_production_orders(p_id, p_orders);
  end if;

  return p_id;
end;
$$;

comment on function public.update_production_record(uuid, text, smallint, jsonb, date, smallint, text) is
  'Edita um apontamento (null = manter). Ordens enviadas substituem as atuais. [D24]';


-- ─── delete_production_record ───────────────────────────────────────────────
create or replace function public.delete_production_record(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec public.production_records;
begin
  select * into v_rec from public.production_records where id = p_id for update;
  if not found then
    raise exception 'Apontamento não encontrado.' using errcode = 'P0002';
  end if;
  if not public.can_delete_production_record(v_rec.created_by, v_rec.created_at) then
    raise exception 'Você não tem permissão para apagar este apontamento.' using errcode = '42501';
  end if;
  delete from public.production_records where id = p_id;  -- as ordens vão junto (cascade)
end;
$$;

comment on function public.delete_production_record(uuid) is
  'Apaga um apontamento e suas ordens. production.delete ou edit_own na janela de 24 h. [D24]';


-- ─── bulk_update_production_records ─────────────────────────────────────────
-- Ações em massa da tela de Relatórios: mover para outra data e/ou trocar o
-- turno. Limite de 200 por vez (mesmo do legado). Se algum registro colidir
-- com um apontamento já existente no destino, NADA é alterado.
create or replace function public.bulk_update_production_records(
  p_ids          uuid[],
  p_new_date     date     default null,
  p_new_shift_id smallint default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.has_permission('production.bulk_edit') then
    raise exception 'Você não tem permissão para editar apontamentos em massa.' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_ids), 0) = 0 then
    raise exception 'Nenhum apontamento selecionado.' using errcode = '22023';
  end if;
  if cardinality(p_ids) > 200 then
    raise exception 'Limite de 200 apontamentos por operação.' using errcode = '22023';
  end if;
  if p_new_date is null and p_new_shift_id is null then
    raise exception 'Informe a nova data ou o novo turno.' using errcode = '22023';
  end if;

  begin
    update public.production_records
       set production_date = coalesce(p_new_date, production_date),
           shift_id        = coalesce(p_new_shift_id, shift_id),
           updated_by      = auth.uid()
     where id = any (p_ids);
    get diagnostics v_count = row_count;
  exception when unique_violation then
    raise exception 'Algum apontamento selecionado já existe no destino (mesma máquina, data, turno e modo). Nada foi alterado.'
      using errcode = '23505';
  end;

  return v_count;
end;
$$;

comment on function public.bulk_update_production_records(uuid[], date, smallint) is
  'Move data e/ou troca turno de até 200 apontamentos, atomicamente. Exige production.bulk_edit.';


-- ─── bulk_delete_production_records ─────────────────────────────────────────
create or replace function public.bulk_delete_production_records(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.has_permission('production.bulk_delete') then
    raise exception 'Você não tem permissão para apagar apontamentos em massa.' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_ids), 0) = 0 then
    raise exception 'Nenhum apontamento selecionado.' using errcode = '22023';
  end if;
  if cardinality(p_ids) > 200 then
    raise exception 'Limite de 200 apontamentos por operação.' using errcode = '22023';
  end if;

  delete from public.production_records where id = any (p_ids);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.bulk_delete_production_records(uuid[]) is
  'Apaga até 200 apontamentos (e suas ordens). Exige production.bulk_delete.';


-- ═══ PARTE 4 — Máquinas e metas ════════════════════════════════════════════

-- ─── create_machine ─────────────────────────────────────────────────────────
-- Cadastra a máquina JÁ com a meta inicial, valendo a partir de hoje (D13).
create or replace function public.create_machine(
  p_name                    text,
  p_initial_target          integer  default 0,
  p_has_target              boolean  default true,
  p_standard_operator_count smallint default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id integer;
begin
  if not public.has_permission('machines.manage') then
    raise exception 'Você não tem permissão para cadastrar máquinas.' using errcode = '42501';
  end if;
  if nullif(trim(p_name), '') is null then
    raise exception 'O nome da máquina é obrigatório.' using errcode = '22023';
  end if;

  begin
    insert into public.machines (name, has_target, standard_operator_count, created_by)
    values (trim(p_name), coalesce(p_has_target, true), p_standard_operator_count, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Já existe uma máquina com esse nome.' using errcode = '23505';
  end;

  insert into public.machine_targets (machine_id, quantity_per_shift, valid_from, created_by)
  values (v_id, greatest(coalesce(p_initial_target, 0), 0),
          (now() at time zone 'America/Sao_Paulo')::date, auth.uid());

  return v_id;
end;
$$;

comment on function public.create_machine(text, integer, boolean, smallint) is
  'Cadastra máquina + primeira meta (vigente hoje). Exige machines.manage. [D13]';


-- ─── save_machine_targets ───────────────────────────────────────────────────
-- Salva as metas da tela "Metas" de uma vez.
--   p_targets    → {"1": 500, "2": 520, ...} (id da máquina → meta por turno)
--   p_valid_from → a partir de quando vale (padrão: hoje). Nunca no passado (D15).
-- Só grava as máquinas cuja meta MUDOU em relação à vigente naquela data.
-- D31: se já houver meta da mesma máquina para a MESMA data (hoje ou futura),
-- ela é corrigida em vez de dar erro. Metas que já valeram nunca mudam.
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
      insert into public.machine_targets (machine_id, quantity_per_shift, valid_from, created_by)
      values (v_key::integer, v_qty, v_from, auth.uid())
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
  'Grava novas metas (só as que mudaram), vigentes a partir de p_valid_from (>= hoje). Exige targets.manage. [D13, D15, D31]';


-- ═══ PARTE 5 — Usuários ════════════════════════════════════════════════════

-- ─── approve_user ───────────────────────────────────────────────────────────
-- O gestor aprova um cadastro: escolhe o perfil-modelo e, opcionalmente, a
-- lista final de permissões (se não enviar, copia as do perfil — D22).
-- Também serve para "reaplicar perfil" num usuário já ativo.
create or replace function public.approve_user(
  p_user_id     uuid,
  p_role_id     smallint,
  p_permissions text[] default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('users.approve') then
    raise exception 'Você não tem permissão para aprovar usuários.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Usuário não encontrado.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.roles where id = p_role_id) then
    raise exception 'Perfil inválido.' using errcode = '22023';
  end if;

  update public.profiles
     set status      = 'active',
         role_id     = p_role_id,
         approved_by = auth.uid(),
         approved_at = now()
   where id = p_user_id;

  delete from public.user_permissions where user_id = p_user_id;

  insert into public.user_permissions (user_id, permission_code, granted_by)
  select p_user_id, c.code, auth.uid()
    from unnest(coalesce(
           p_permissions,
           array(select rp.permission_code from public.role_permissions rp where rp.role_id = p_role_id)
         )) as c(code)
  on conflict do nothing;
end;
$$;

comment on function public.approve_user(uuid, smallint, text[]) is
  'Ativa o usuário, aplica o perfil-modelo e copia/ajusta as permissões. Exige users.approve. [D20, D22]';


-- ─── identify_shared_session ────────────────────────────────────────────────
-- Na conta Admin compartilhada, a pessoa digita o nº do crachá. Se o crachá
-- for de um usuário pessoal ATIVO, a sessão fica identificada e as
-- permissões da conta passam a valer (D23). Devolve o nome identificado.
create or replace function public.identify_shared_session(p_badge_number text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.profiles;
  v_person  public.profiles;
  v_session uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
  select * into v_account from public.profiles where id = auth.uid();
  if not found or v_account.account_type <> 'shared' or v_account.status <> 'active' then
    raise exception 'Identificação por crachá é usada só na conta compartilhada ativa.' using errcode = '42501';
  end if;
  if v_session is null then
    raise exception 'Sessão de login não identificada. Entre novamente.' using errcode = '42501';
  end if;

  select * into v_person
    from public.profiles
   where badge_number = trim(p_badge_number)
     and status = 'active'
     and account_type = 'personal';
  if not found then
    raise exception 'Crachá não encontrado ou usuário inativo.' using errcode = 'P0002';
  end if;

  insert into public.shared_account_sessions (auth_session_id, account_id, identified_user_id)
  values (v_session, v_account.id, v_person.id)
  on conflict (auth_session_id)
  do update set identified_user_id = excluded.identified_user_id,
                identified_at      = now();

  return v_person.full_name;
end;
$$;

comment on function public.identify_shared_session(text) is
  'Identifica por crachá quem está usando a conta compartilhada nesta sessão. [D23]';


-- ─── bootstrap_admin (instalação) ───────────────────────────────────────────
-- Problema do "ovo e da galinha": para aprovar alguém é preciso já ter um
-- aprovador. Esta função ativa o PRIMEIRO gestor. Só o dono do banco pode
-- executá-la (pelo SQL Editor do Supabase): o app não tem acesso.
--   select public.bootstrap_admin('email@da.pessoa');
create or replace function public.bootstrap_admin(p_email text, p_role_code text default 'manager')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_role_id smallint;
begin
  select u.id into v_user_id from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_user_id is null then
    raise exception 'Nenhum usuário cadastrado com o e-mail %.', p_email using errcode = 'P0002';
  end if;
  select r.id into v_role_id from public.roles r where r.code = p_role_code;
  if v_role_id is null then
    raise exception 'Perfil % não existe (rode o seed estrutural antes).', p_role_code using errcode = 'P0002';
  end if;

  update public.profiles
     set status = 'active', role_id = v_role_id, approved_at = now()
   where id = v_user_id;

  insert into public.user_permissions (user_id, permission_code)
  select v_user_id, rp.permission_code
    from public.role_permissions rp
   where rp.role_id = v_role_id
  on conflict do nothing;
end;
$$;

comment on function public.bootstrap_admin(text, text) is
  'Instalação: ativa o primeiro gestor com as permissões do perfil. Só o dono do banco executa.';


-- ═══ PARTE 6 — Quem pode chamar cada função ════════════════════════════════
-- Por padrão o Postgres deixa QUALQUER UM executar funções novas. Aqui
-- tiramos esse direito de todos (public) e do visitante não logado (anon), e
-- devolvemos só para quem está logado (authenticated).
do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'public.is_active_user()',
    'public.has_permission(text)',
    'public.my_permissions()',
    'public.machine_target_on(integer, date)',
    'public.list_profile_names()',
    'public.can_edit_production_record(uuid, timestamptz)',
    'public.can_delete_production_record(uuid, timestamptz)',
    'public.current_identified_user_id()',
    'public.save_production_record(date, smallint, integer, jsonb, text, smallint, text, boolean)',
    'public.update_production_record(uuid, text, smallint, jsonb, date, smallint, text)',
    'public.delete_production_record(uuid)',
    'public.bulk_update_production_records(uuid[], date, smallint)',
    'public.bulk_delete_production_records(uuid[])',
    'public.create_machine(text, integer, boolean, smallint)',
    'public.save_machine_targets(jsonb, date)',
    'public.approve_user(uuid, smallint, text[])',
    'public.identify_shared_session(text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', v_fn);
    execute format('grant execute on function %s to authenticated', v_fn);
  end loop;
end;
$$;

-- Funções internas/instalação: ninguém do app executa.
revoke execute on function public.insert_production_orders(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.bootstrap_admin(text, text) from public, anon, authenticated;
