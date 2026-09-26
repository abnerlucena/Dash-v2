-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0004 — Pessoas: perfis de usuário, permissões individuais e
--                  identificação na conta compartilhada
-- Decisões: D04, D19, D20, D21, D22, D23, D29
-- Documentação: docs/database/02-referencia-tecnica.md, seções 3.9, 3.13, 3.14 e 5
--
-- Como funciona o cadastro (visão rápida):
--   1. A pessoa se cadastra pela tela de login. Quem guarda e-mail e senha é o
--      Supabase Auth (tabela auth.users, que NÃO é nossa).
--   2. O gatilho handle_new_user cria automaticamente a linha dela em
--      public.profiles, com status 'pending' (aguardando aprovação) e nenhuma
--      permissão.
--   3. O gestor aprova (função approve_user, migration 0009), escolhe um
--      perfil-modelo e as permissões são copiadas para user_permissions.
--
-- Idempotente: "if not exists" / "create or replace" em todos os comandos.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. Função genérica: atualizar "updated_at" sozinho ─────────────────────
-- Usada por todas as tabelas que têm a coluna updated_at. Antes de cada
-- UPDATE, o gatilho troca updated_at pela hora atual — assim ninguém precisa
-- lembrar de preencher.
-- "set search_path = ''" é uma proteção: obriga a função a usar nomes
-- completos (public.x), impedindo que alguém "engane" a função criando uma
-- tabela com o mesmo nome em outro schema.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Gatilho genérico: preenche updated_at = now() antes de cada UPDATE.';


-- ─── 2. profiles — um perfil por usuário do Supabase Auth ───────────────────
-- O "id" é o MESMO id do usuário em auth.users (relação 1 para 1).
-- "on delete cascade": se o usuário for removido do Auth, o perfil vai junto
-- (mas veja D29: quem tem histórico não pode ser removido, só bloqueado).
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null check (length(trim(full_name)) > 0),
  badge_number  text unique check (badge_number is null or length(trim(badge_number)) > 0),
  account_type  text not null default 'personal'
                check (account_type in ('personal', 'shared', 'display')),
  status        text not null default 'pending'
                check (status in ('pending', 'active', 'blocked')),
  role_id       smallint references public.roles(id),
  approved_by   uuid references public.profiles(id),
  approved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- D21: conta pessoal precisa ter nº do crachá. Contas compartilhadas
  -- (Admin) e de exibição (TV) são isentas.
  constraint profiles_personal_requires_badge
    check (account_type <> 'personal' or badge_number is not null)
);

comment on table public.profiles is
  'Perfil de cada usuário do Supabase Auth. Nasce pending, sem permissões; o gestor aprova. [D19, D20, D21]';
comment on column public.profiles.badge_number is
  'Nº de cadastro do crachá. Obrigatório para contas pessoais. [D21]';
comment on column public.profiles.account_type is
  'personal = pessoa; shared = conta Admin compartilhada (exige identificação por crachá a cada sessão, D23); display = TV.';

-- Índice para listar rapidamente quem está aguardando aprovação.
create index if not exists profiles_status_idx on public.profiles (status);
create index if not exists profiles_role_id_idx on public.profiles (role_id);

-- Gatilho: updated_at automático.
create or replace trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();


-- ─── 3. Gatilho: criar o perfil quando alguém se cadastra ───────────────────
-- Roda DEPOIS de cada inserção em auth.users. Lê os dados extras que a tela de
-- cadastro envia em "options.data" (ficam em raw_user_meta_data):
--   full_name     → nome completo
--   badge_number  → nº do crachá
--   account_type  → opcional; padrão 'personal'
-- "security definer": a função roda com os direitos de quem a criou (o dono do
-- banco), porque quem está se cadastrando ainda não tem direito nenhum.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta         jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_full_name    text  := nullif(trim(v_meta ->> 'full_name'), '');
  v_badge        text  := nullif(trim(v_meta ->> 'badge_number'), '');
  v_account_type text  := coalesce(nullif(trim(v_meta ->> 'account_type'), ''), 'personal');
begin
  if v_account_type not in ('personal', 'shared', 'display') then
    raise exception 'Tipo de conta inválido: %', v_account_type
      using errcode = '22023';
  end if;

  -- D21 + D29: recusar o cadastro com mensagem clara, em vez de deixar a regra
  -- do banco falhar com uma mensagem técnica.
  if v_account_type = 'personal' and v_badge is null then
    raise exception 'O nº do crachá é obrigatório para contas pessoais.'
      using errcode = '23514';
  end if;

  insert into public.profiles (id, full_name, badge_number, account_type)
  values (
    new.id,
    coalesce(v_full_name, split_part(new.email, '@', 1), 'Sem nome'),
    v_badge,
    v_account_type
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Gatilho em auth.users: cria o profile (pending) a partir dos metadados do cadastro. [D20, D21, D29]';

create or replace trigger handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ─── 4. user_permissions — permissões efetivas de cada pessoa ───────────────
-- D22: esta é a ÚNICA fonte de permissões de um usuário. O perfil-modelo só é
-- usado no momento da aprovação, para copiar as permissões iniciais.
create table if not exists public.user_permissions (
  user_id         uuid        not null references public.profiles(id) on delete cascade,
  permission_code text        not null references public.permissions(code),
  granted_by      uuid        references public.profiles(id),
  granted_at      timestamptz not null default now(),
  primary key (user_id, permission_code)
);

create index if not exists user_permissions_permission_code_idx
  on public.user_permissions (permission_code);

comment on table public.user_permissions is
  'Permissões efetivas por usuário (copiadas do perfil-modelo na aprovação e ajustáveis). [D22]';


-- ─── 5. shared_account_sessions — quem está usando a conta Admin ────────────
-- D23: a conta Admin é compartilhada. A cada login, a pessoa informa o nº do
-- crachá; esta tabela liga a SESSÃO de login (o "session_id" que vem dentro do
-- token JWT do Supabase) à pessoa identificada. Sem essa linha, a conta
-- compartilhada não tem permissão nenhuma.
create table if not exists public.shared_account_sessions (
  id                  uuid        primary key default gen_random_uuid(),
  auth_session_id     uuid        not null unique,
  account_id          uuid        not null references public.profiles(id) on delete cascade,
  identified_user_id  uuid        not null references public.profiles(id) on delete cascade,
  identified_at       timestamptz not null default now()
);

create index if not exists shared_account_sessions_account_id_idx
  on public.shared_account_sessions (account_id);
create index if not exists shared_account_sessions_identified_user_id_idx
  on public.shared_account_sessions (identified_user_id);

comment on table public.shared_account_sessions is
  'Identificação por crachá em cada sessão da conta compartilhada. Gravada só pela função identify_shared_session. [D23]';


-- ─── 6. Segurança ───────────────────────────────────────────────────────────
-- RLS ligado; políticas na migration 20260920170000_enable_rls_policies.sql.
alter table public.profiles                enable row level security;
alter table public.user_permissions        enable row level security;
alter table public.shared_account_sessions enable row level security;
