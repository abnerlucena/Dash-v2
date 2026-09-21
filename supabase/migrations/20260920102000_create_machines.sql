-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0005 — Máquinas e histórico de metas
-- Decisões: D01, D02, D04, D05, D12, D13, D14, D15
-- Documentação: docs/database/02-referencia-tecnica.md, seções 3.1 e 3.6
--
-- machines         → cadastro das máquinas/postos de trabalho
-- machine_targets  → histórico de metas: cada mudança de meta é uma LINHA NOVA
--                    com a data em que passa a valer (nada é sobrescrito)
--
-- As máquinas reais e suas metas atuais são carregadas pelo seed estrutural
-- (supabase/seed/01_estrutural.sql).
-- Idempotente: "if not exists" / "create or replace" em todos os comandos.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. machines ────────────────────────────────────────────────────────────
-- id: "generated always as identity" = o próprio banco numera (1, 2, 3...).
--     Acaba com o risco do legado, que calculava "maior id + 1" e podia gerar
--     o mesmo número em dois cadastros simultâneos (D01).
-- created_by/updated_by: QUEM cadastrou/alterou, guardado pelo id da pessoa
--     (D04). O "default auth.uid()" preenche sozinho com o usuário logado.
create table if not exists public.machines (
  id                       integer generated always as identity primary key,
  name                     text     not null check (length(trim(name)) > 0),
  has_target               boolean  not null default true,
  status                   text     not null default 'active'
                           check (status in ('active', 'inactive', 'maintenance', 'preventive_maintenance')),
  status_updated_at        timestamptz,
  standard_operator_count  smallint check (standard_operator_count >= 0),
  created_by               uuid references public.profiles(id) default auth.uid(),
  updated_by               uuid references public.profiles(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- D02: nome único, sem diferenciar maiúsculas/minúsculas
-- ("Horizontal 1" e "HORIZONTAL 1" são a mesma máquina).
create unique index if not exists machines_name_lower_key
  on public.machines (lower(name));

comment on table public.machines is
  'Máquinas/postos de produção. Não apagar máquina com produção: desativar via status. [D01, D02, D05]';
comment on column public.machines.standard_operator_count is
  'Lotação padrão (nº de operadores). Pré-preenche o apontamento. [D12]';

create or replace trigger set_updated_at
  before update on public.machines
  for each row execute function public.set_updated_at();


-- ─── 2. Gatilho: registrar quando o status da máquina mudou ─────────────────
-- Sempre que "status" muda (ex: active → maintenance), grava a hora em
-- status_updated_at. No cadastro, a hora do cadastro.
create or replace function public.set_machine_status_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.status_updated_at := now();
  end if;
  return new;
end;
$$;

create or replace trigger set_machine_status_updated_at
  before insert or update of status on public.machines
  for each row execute function public.set_machine_status_updated_at();


-- ─── 3. machine_targets — histórico de metas ────────────────────────────────
-- Uma linha = "a partir do dia X, a meta da máquina Y é Z peças por turno".
-- A meta vigente num dia qualquer é a linha com o MAIOR valid_from que ainda
-- seja menor ou igual àquele dia (a view current_machine_targets faz isso
-- para "hoje").
-- D14: a meta é a mesma para todos os turnos (por isso não há shift_id).
create table if not exists public.machine_targets (
  id                  uuid        primary key default gen_random_uuid(),
  machine_id          integer     not null references public.machines(id),
  quantity_per_shift  integer     not null check (quantity_per_shift >= 0),
  valid_from          date        not null,
  created_by          uuid        references public.profiles(id) default auth.uid(),
  created_at          timestamptz not null default now(),

  -- Uma única meta por máquina por data. Este índice também acelera a busca
  -- "qual a meta vigente da máquina X no dia Y".
  constraint machine_targets_machine_valid_from_key unique (machine_id, valid_from)
);

comment on table public.machine_targets is
  'Histórico de metas por máquina (append-only). Meta vigente = maior valid_from <= data. [D13, D14, D15]';


-- ─── 4. Gatilho: meta não pode começar no passado (D15) ─────────────────────
-- "Hoje" é calculado no fuso de Brasília: o servidor do Supabase roda em UTC,
-- e às 22h de Brasília já é "amanhã" em UTC.
-- Também impede alterar uma meta que JÁ entrou em vigor antes de hoje — o
-- passado não muda. (A correção de uma meta de hoje/futura é feita pela
-- função save_machine_targets; ver D31.)
create or replace function public.validate_target_valid_from()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if tg_op = 'UPDATE' and old.valid_from < v_today then
    raise exception 'Metas que já entraram em vigor não podem ser alteradas (vigência %).',
      to_char(old.valid_from, 'DD/MM/YYYY')
      using errcode = '23514';
  end if;

  if new.valid_from < v_today then
    raise exception 'A meta não pode começar no passado (informado %, hoje é %).',
      to_char(new.valid_from, 'DD/MM/YYYY'), to_char(v_today, 'DD/MM/YYYY')
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.validate_target_valid_from() is
  'Recusa valid_from anterior a hoje (fuso America/Sao_Paulo) e alteração de metas já vigentes. [D15]';

create or replace trigger validate_target_valid_from
  before insert or update on public.machine_targets
  for each row execute function public.validate_target_valid_from();


-- ─── 5. Segurança ───────────────────────────────────────────────────────────
alter table public.machines        enable row level security;
alter table public.machine_targets enable row level security;
