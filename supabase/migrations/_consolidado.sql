-- ═══════════════════════════════════════════════════════════════════════════
-- SCRIPT CONSOLIDADO — schema completo do Dash de Produção (v0.11.0)
--
-- Junta TODAS as migrations desta pasta, na ordem, num arquivo só, para colar
-- no SQL Editor do Supabase de um projeto novo (ou para conferir um projeto
-- existente). É IDEMPOTENTE: rodar num banco que já tem tudo não altera nem
-- apaga nada.
--
-- Diferenças em relação às migrations individuais:
--   • a criação de "shifts" usa "if not exists" (a original de 15/09 não usava);
--   • a view current_machine_targets é derrubada antes de ser recriada (ver nota
--     no lugar, na parte 2).
--
-- NÃO edite este arquivo à mão: ele é gerado a partir das migrations.
-- Depois de rodar, carregue os dados: supabase/seed/01_estrutural.sql
-- ═══════════════════════════════════════════════════════════════════════════



-- ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
-- ▓ 20260915120000_create_shifts.sql
-- ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
-- Migration 0001 — Tabela de turnos (shifts)
-- Decisão: D06 (docs/database/03-decisoes.md)
-- Substitui o texto solto "TURNO 1/2/3" e o localStorage "turnosAtivos".

create table if not exists public.shifts (
  id          smallint primary key,
  name        text     not null unique check (length(trim(name)) > 0),
  start_time  time,
  end_time    time,
  is_active   boolean  not null default true
);

comment on table public.shifts is
  'Turnos de produção da fábrica. O turno 3 atravessa a meia-noite (end_time < start_time). [D06]';

alter table public.shifts enable row level security;


-- ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
-- ▓ 20260916090000_seed_shifts.sql
-- ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
-- Migration 0002 — Carga inicial dos turnos
-- Decisão: D06 (docs/database/03-decisoes.md)
-- Horários ficam vazios por ora: são descritivos e não entram em nenhuma regra.
-- O TURNO 3 já fica ativo: hoje recebe apenas hora extra de madrugada (work_mode = 'overtime',
-- fora do cálculo de meta — ver D27). Quando virar turno regular, nada muda na estrutura.

insert into public.shifts (id, name, start_time, end_time, is_active) values
  (1, 'TURNO 1', null, null, true),
  (2, 'TURNO 2', null, null, true),
  (3, 'TURNO 3', null, null, true)
on conflict (id) do nothing;


-- ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
-- ▓ 20260920100000_create_access_catalog.sql
-- ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0003 — Catálogo de acesso: perfis-modelo e permissões
-- Decisões: D20 (aprovação do gestor), D22 (perfil copiado como modelo)
-- Documentação: docs/database/02-referencia-tecnica.md, seções 3.10 a 3.12 e 8
--
-- O que esta migration cria:
--   roles             → os "perfis-modelo" (Operador, Gestor, TV...)
--   permissions       → a lista de tudo que alguém pode fazer no sistema
--   role_permissions  → quais permissões cada perfil-modelo traz de fábrica
--
-- As LINHAS (os perfis e as permissões em si) não estão aqui: ficam no seed
-- estrutural `supabase/seed/01_estrutural.sql`, para poderem ser recarregadas
-- sem mexer na estrutura.
--
-- Idempotente: pode ser executada mais de uma vez sem erro e sem apagar nada
-- (todo comando usa "if not exists").
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. roles — perfis-modelo ───────────────────────────────────────────────
-- Um perfil-modelo é só um PONTO DE PARTIDA: na aprovação, as permissões dele
-- são copiadas para o usuário, que pode ganhar ou perder permissões
-- individualmente depois (D22).
--   id          → número pequeno fixo (1, 2, 3...), escolhido por nós no seed
--   code        → código em inglês usado pelo sistema ('operator', 'manager')
--   name        → nome exibido na tela, em português ('Operador', 'Gestor')
create table if not exists public.roles (
  id          smallint primary key,
  code        text not null unique check (code ~ '^[a-z_]+$'),
  name        text not null check (length(trim(name)) > 0),
  description text
);

comment on table public.roles is
  'Perfis-modelo de permissão. Copiados para user_permissions na aprovação do usuário. [D22]';


-- ─── 2. permissions — catálogo de permissões ────────────────────────────────
-- Cada linha é uma coisa que o sistema deixa (ou não) alguém fazer.
--   code        → identificador, no formato 'area.acao' (ex: 'production.create')
--   category    → agrupa as caixinhas na tela de aprovação ('Apontamento', 'Gestão')
--   sort_order  → ordem de exibição dentro da tela
create table if not exists public.permissions (
  code        text primary key check (code ~ '^[a-z_]+\.[a-z_]+$'),
  description text not null,
  category    text not null,
  sort_order  smallint not null
);

comment on table public.permissions is
  'Catálogo de permissões do sistema (formato area.acao). Ver seção 8 da referência técnica.';


-- ─── 3. role_permissions — o que cada perfil-modelo traz ────────────────────
-- Tabela de ligação "muitos para muitos": um perfil tem várias permissões e
-- uma permissão aparece em vários perfis. A chave primária composta impede
-- repetir o mesmo par.
-- "on delete cascade": se um perfil ou permissão for removido do catálogo,
-- a ligação some junto (não fica "órfã").
create table if not exists public.role_permissions (
  role_id         smallint not null references public.roles(id) on delete cascade,
  permission_code text     not null references public.permissions(code) on delete cascade,
  primary key (role_id, permission_code)
);

-- Índice para a pergunta inversa: "quais perfis têm a permissão X?"
create index if not exists role_permissions_permission_code_idx
  on public.role_permissions (permission_code);

comment on table public.role_permissions is
  'Permissões padrão de cada perfil-modelo. Alterar aqui NÃO afeta usuários já aprovados. [D22]';


-- ─── 4. Segurança ───────────────────────────────────────────────────────────
-- RLS (Row Level Security) ligado: sem nenhuma política, NINGUÉM consegue ler
-- ou escrever pelo frontend. As políticas de leitura são criadas na migration
-- de segurança (20260920170000_enable_rls_policies.sql).
alter table public.roles            enable row level security;
alter table public.permissions      enable row level security;
alter table public.role_permissions enable row level security;


-- ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
-- ▓ 20260920101000_create_profiles.sql
-- ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
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


-- ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
-- ▓ 20260920102000_create_machines.sql
-- ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
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


-- ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
-- ▓ 20260920103000_create_production.sql
-- ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0006 — Produção: apontamentos, ordens de produção e paradas
-- Decisões: D05, D06, D07, D08, D09, D10, D11, D12, D27
-- Documentação: docs/database/02-referencia-tecnica.md, seções 3.3 a 3.5
--
-- production_records  → o APONTAMENTO: "máquina X, dia Y, turno Z (normal ou
--                       hora extra)". Guarda a meta do dia como "foto" (D08).
-- production_orders   → as ORDENS DE PRODUÇÃO (OPs) de cada apontamento, com
--                       quantidade e a marcação de retrabalho (D09, D11).
-- machine_downtimes   → paradas de máquina. Criada vazia, para a futura
--                       integração com o SFM (D05).
--
-- Importante: a quantidade produzida NÃO é uma coluna. Ela é sempre a soma das
-- ordens (a view production_summary calcula). Assim não existe o risco de o
-- total "desbater" da soma das OPs, como acontecia na planilha.
--
-- Idempotente: "if not exists" / "create or replace" em todos os comandos.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. production_records — apontamentos ───────────────────────────────────
create table if not exists public.production_records (
  id               uuid        primary key default gen_random_uuid(),
  production_date  date        not null,
  shift_id         smallint    not null references public.shifts(id),
  machine_id       integer     not null references public.machines(id),

  -- D08: a meta vigente no dia é COPIADA para cá no momento do apontamento.
  -- Se a meta mudar depois, o passado continua mostrando a meta da época.
  target_quantity  integer     not null check (target_quantity >= 0),

  -- D12: quantas pessoas operaram a máquina neste turno (opcional).
  operator_count   smallint    check (operator_count >= 0),

  -- D27: 'regular' = turno normal; 'overtime' = hora extra.
  -- Hora extra entra na produção total, mas NÃO no cálculo de meta.
  -- Texto com lista fechada (em vez de sim/não) para caber futuros modos.
  work_mode        text        not null default 'regular'
                   check (work_mode in ('regular', 'overtime')),

  notes            text        check (notes is null or char_length(notes) <= 500),
  created_by       uuid        references public.profiles(id) default auth.uid(),
  updated_by       uuid        references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- D10 + D27: um único apontamento por máquina + dia + turno + modo.
  -- Trabalho normal e hora extra do mesmo turno ficam em linhas separadas.
  constraint production_records_unique_entry
    unique (machine_id, production_date, shift_id, work_mode)
);

comment on table public.production_records is
  'Apontamento de produção: máquina + dia + turno + modo de trabalho. Quantidades vêm de production_orders. [D08, D10, D27]';
comment on column public.production_records.target_quantity is
  'Foto da meta vigente no dia do apontamento. [D08]';
comment on column public.production_records.work_mode is
  'regular = turno normal (conta para meta); overtime = hora extra (fora do cálculo de meta). [D27]';

-- Índices: atalhos para as buscas mais comuns.
--   por data (dashboard, relatórios de período)
create index if not exists production_records_production_date_idx
  on public.production_records (production_date);
--   por turno
create index if not exists production_records_shift_id_idx
  on public.production_records (shift_id);
--   por autor (regra "editar o próprio apontamento por 24 h", D24)
create index if not exists production_records_created_by_idx
  on public.production_records (created_by);
-- Obs.: a busca "máquina + período" já é atendida pelo índice da regra de
-- unicidade acima, que começa por (machine_id, production_date). Um índice
-- separado seria duplicado.

create or replace trigger set_updated_at
  before update on public.production_records
  for each row execute function public.set_updated_at();


-- ─── 2. production_orders — ordens de produção do apontamento ───────────────
-- order_number é TEXTO, não número: o SAP usa zeros à esquerda
-- ("000001004521") e um campo numérico os apagaria (D09).
-- "on delete cascade": apagar o apontamento apaga as ordens dele.
create table if not exists public.production_orders (
  id                    uuid        primary key default gen_random_uuid(),
  production_record_id  uuid        not null references public.production_records(id) on delete cascade,
  order_number          text        not null,
  quantity              integer     not null check (quantity > 0),
  is_rework             boolean     not null default false,
  notes                 text,
  created_at            timestamptz not null default now()
);

comment on table public.production_orders is
  'Ordens de produção de cada apontamento. is_rework = retrabalho (não conta como produção boa). [D09, D11]';
comment on column public.production_orders.order_number is
  'Nº da OP como texto, preservando zeros à esquerda do SAP. [D09]';

create index if not exists production_orders_production_record_id_idx
  on public.production_orders (production_record_id);
create index if not exists production_orders_order_number_idx
  on public.production_orders (order_number);


-- ─── 3. machine_downtimes — paradas de máquina (futuro: SFM) ────────────────
-- source + external_id: quando as paradas vierem do SFM, cada uma traz o id
-- dela no sistema de origem. A regra de unicidade impede importar a mesma
-- parada duas vezes.
create table if not exists public.machine_downtimes (
  id           uuid        primary key default gen_random_uuid(),
  machine_id   integer     not null references public.machines(id),
  reason       text        not null check (reason in ('maintenance', 'preventive_maintenance')),
  started_at   timestamptz not null,
  ended_at     timestamptz,                     -- vazio = parada em andamento
  source       text        not null default 'manual' check (source in ('manual', 'sfm')),
  external_id  text,
  notes        text,
  created_by   uuid        references public.profiles(id) default auth.uid(),
  created_at   timestamptz not null default now(),

  constraint machine_downtimes_period_check check (ended_at is null or ended_at > started_at),
  constraint machine_downtimes_source_external_id_key unique (source, external_id)
);

comment on table public.machine_downtimes is
  'Paradas de máquina. Criada sem uso; preparada para importação do SFM sem duplicar. [D05]';

create index if not exists machine_downtimes_machine_started_idx
  on public.machine_downtimes (machine_id, started_at);


-- ─── 4. Segurança ───────────────────────────────────────────────────────────
-- Gravação de apontamentos será SOMENTE pelas funções da migration 0009
-- (save_production_record etc.), que conferem permissões e gravam registro +
-- ordens juntos. As políticas de leitura ficam na migration 0010.
alter table public.production_records enable row level security;
alter table public.production_orders  enable row level security;
alter table public.machine_downtimes  enable row level security;


-- ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
-- ▓ 20260920104000_create_calendar.sql
-- ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0007 — Calendário: feriados, eventos especiais e dias anulados
-- Decisões: D16, D17, D18
-- Documentação: docs/database/02-referencia-tecnica.md, seções 3.7 e 3.8
--
-- calendar_events        → um evento numa data (Natal, jogo da Copa, falta
--                          de energia...)
-- calendar_event_shifts  → quais turnos o evento afeta. SEM linhas = o evento
--                          vale para o dia inteiro (todos os turnos).
--
-- Tipos de evento (D16):
--   holiday        → feriado: só contexto (etiqueta no dashboard)
--   special_event  → evento especial: só contexto
--   excluded_day   → dia/turno anulado: SAI dos cálculos e prevalece sobre
--                    os outros tipos no mesmo dia
--
-- Idempotente: "if not exists" em todos os comandos.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. calendar_events ─────────────────────────────────────────────────────
-- Pode haver VÁRIOS eventos na mesma data (D17), por isso a data não é única.
-- scope  → abrangência: nacional, estadual, municipal ou da empresa
-- source → 'manual' (cadastrado pelo gestor) ou 'brasil_api' (importado
--          automaticamente, D18 — rotina ainda não implementada)
create table if not exists public.calendar_events (
  id           uuid        primary key default gen_random_uuid(),
  event_date   date        not null,
  description  text        not null check (length(trim(description)) > 0),
  event_type   text        not null check (event_type in ('holiday', 'special_event', 'excluded_day')),
  scope        text        not null check (scope in ('national', 'state', 'municipal', 'company')),
  source       text        not null default 'manual' check (source in ('manual', 'brasil_api')),
  created_by   uuid        references public.profiles(id) default auth.uid(),  -- vazio quando importado
  created_at   timestamptz not null default now()
);

comment on table public.calendar_events is
  'Eventos do calendário. excluded_day retira o dia/turno dos cálculos e prevalece. [D16, D17, D18]';

create index if not exists calendar_events_event_date_idx
  on public.calendar_events (event_date);

-- D18: um feriado importado da BrasilAPI por data — rodar a importação duas
-- vezes não duplica. Eventos manuais não entram nesta regra (índice "parcial").
create unique index if not exists calendar_events_brasil_api_date_key
  on public.calendar_events (event_date)
  where source = 'brasil_api';


-- ─── 2. calendar_event_shifts — turnos afetados ─────────────────────────────
-- Ex.: jogo da Copa às 16h afeta só o TURNO 2 → uma linha (evento, 2).
-- Apagar o evento apaga as ligações dele ("on delete cascade").
create table if not exists public.calendar_event_shifts (
  event_id  uuid     not null references public.calendar_events(id) on delete cascade,
  shift_id  smallint not null references public.shifts(id),
  primary key (event_id, shift_id)
);

comment on table public.calendar_event_shifts is
  'Turnos afetados por um evento. Nenhuma linha = evento vale para todos os turnos. [D17]';

create index if not exists calendar_event_shifts_shift_id_idx
  on public.calendar_event_shifts (shift_id);


-- ─── 3. Segurança ───────────────────────────────────────────────────────────
alter table public.calendar_events       enable row level security;
alter table public.calendar_event_shifts enable row level security;


-- ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
-- ▓ 20260920105000_create_notifications_audit.sql
-- ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0008 — Notificações e log de auditoria
-- Decisões: D23, D25, D26
-- Documentação: docs/database/02-referencia-tecnica.md, seções 3.15, 3.16 e 5
--
-- notifications → avisos para uma pessoa (hoje: "novo cadastro aguardando
--                 aprovação"). Uma linha por destinatário (D25).
-- audit_logs    → registro automático de toda alteração importante: quem,
--                 quando, de onde (IP), como estava e como ficou (D26).
--
-- Gatilhos criados aqui:
--   notify_approvers               → novo cadastro gera aviso para os aprovadores
--   resolve_approval_notifications → aprovado/bloqueado: avisos somem para todos
--   audit_row_change               → grava o log de auditoria
--   prevent_audit_log_changes      → ninguém altera nem apaga o log
--
-- Idempotente: "if not exists" / "create or replace" / blocos com verificação.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. notifications ───────────────────────────────────────────────────────
-- read_at vazio = não lida. related_table/related_id apontam para o assunto
-- do aviso (ex: 'profiles' + id da pessoa que se cadastrou).
create table if not exists public.notifications (
  id                 uuid        primary key default gen_random_uuid(),
  recipient_id       uuid        not null references public.profiles(id) on delete cascade,
  notification_type  text        not null check (notification_type in ('user_pending_approval')),
  title              text        not null,
  body               text        not null,
  related_table      text,
  related_id         text,
  read_at            timestamptz,
  created_at         timestamptz not null default now()
);

comment on table public.notifications is
  'Avisos por destinatário. Publicada no Realtime para aparecer na hora. [D25]';

-- Índice "parcial": só as NÃO lidas, que é o que o sininho consulta.
create index if not exists notifications_unread_idx
  on public.notifications (recipient_id, created_at)
  where read_at is null;

-- Para achar os avisos de um assunto (usado ao aprovar um cadastro).
create index if not exists notifications_related_idx
  on public.notifications (related_table, related_id);


-- ─── 2. audit_logs ──────────────────────────────────────────────────────────
-- id "bigint identity": número sequencial, adequado para uma tabela que só
-- cresce. old_data/new_data guardam a linha inteira em JSON (antes/depois).
create table if not exists public.audit_logs (
  id                  bigint      generated always as identity primary key,
  occurred_at         timestamptz not null default now(),
  actor_id            uuid        references public.profiles(id),   -- vazio = sistema
  identified_user_id  uuid        references public.profiles(id),   -- pessoa na conta Admin (D23)
  action              text        not null,
  table_name          text,
  record_id           text,
  old_data            jsonb,
  new_data            jsonb,
  ip_address          inet
);

comment on table public.audit_logs is
  'Log de auditoria gravado por gatilhos. Append-only: não pode ser alterado nem apagado. [D26]';

create index if not exists audit_logs_occurred_at_idx on public.audit_logs (occurred_at);
create index if not exists audit_logs_table_record_idx on public.audit_logs (table_name, record_id);
create index if not exists audit_logs_actor_id_idx on public.audit_logs (actor_id);


-- ─── 3. Quem está usando a conta compartilhada nesta sessão? ────────────────
-- Lê o "session_id" de dentro do token de login (JWT) e procura a
-- identificação por crachá feita nesta sessão (D23). Fora da conta
-- compartilhada, devolve vazio.
create or replace function public.current_identified_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.identified_user_id
    from public.shared_account_sessions s
   where s.account_id = auth.uid()
     and s.auth_session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
$$;

comment on function public.current_identified_user_id() is
  'Pessoa identificada por crachá na sessão atual da conta compartilhada (ou null). [D23]';


-- ─── 4. Gatilho de auditoria ────────────────────────────────────────────────
-- Uma função genérica, ligada em várias tabelas. Para cada linha inserida,
-- alterada ou apagada, grava em audit_logs:
--   action      → INSERT / UPDATE / DELETE
--   record_id   → o id da linha (ou a chave composta, nas tabelas de ligação)
--   old/new     → a linha antes e depois, em JSON
--   ip_address  → o IP de quem fez, lido do cabeçalho x-forwarded-for que o
--                 Supabase repassa. Se não der para ler, fica vazio.
-- UPDATE que não mudou nada não é registrado (economiza espaço).
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old     jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new     jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row     jsonb := coalesce(v_new, v_old);
  v_headers jsonb;
  v_ip      inet;
begin
  if tg_op = 'UPDATE' and v_old = v_new then
    return null;
  end if;

  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
    v_ip := nullif(trim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)), '')::inet;
  exception when others then
    v_ip := null;  -- cabeçalho ausente ou IP em formato inesperado: segue sem IP
  end;

  insert into public.audit_logs
    (actor_id, identified_user_id, action, table_name, record_id, old_data, new_data, ip_address)
  values (
    auth.uid(),
    public.current_identified_user_id(),
    tg_op,
    tg_table_name,
    coalesce(
      v_row ->> 'id',
      (v_row ->> 'user_id') || ':' || (v_row ->> 'permission_code'),
      (v_row ->> 'event_id') || ':' || (v_row ->> 'shift_id')
    ),
    v_old,
    v_new,
    v_ip
  );

  return null;  -- gatilho AFTER: o valor de retorno é ignorado
end;
$$;

comment on function public.audit_row_change() is
  'Gatilho genérico de auditoria: grava antes/depois, autor, pessoa identificada e IP. [D26]';

-- Liga a auditoria nas tabelas previstas no desenho. "create or replace
-- trigger" torna o comando repetível.
create or replace trigger audit_row_change
  after insert or update or delete on public.production_records
  for each row execute function public.audit_row_change();
create or replace trigger audit_row_change
  after insert or update or delete on public.production_orders
  for each row execute function public.audit_row_change();
create or replace trigger audit_row_change
  after insert or update or delete on public.machines
  for each row execute function public.audit_row_change();
create or replace trigger audit_row_change
  after insert or update or delete on public.machine_targets
  for each row execute function public.audit_row_change();
create or replace trigger audit_row_change
  after insert or update or delete on public.calendar_events
  for each row execute function public.audit_row_change();
create or replace trigger audit_row_change
  after insert or update or delete on public.calendar_event_shifts
  for each row execute function public.audit_row_change();
create or replace trigger audit_row_change
  after insert or update or delete on public.profiles
  for each row execute function public.audit_row_change();
create or replace trigger audit_row_change
  after insert or update or delete on public.user_permissions
  for each row execute function public.audit_row_change();


-- ─── 5. O log não pode ser alterado nem apagado ─────────────────────────────
-- As políticas de segurança (RLS) já impedem o frontend. Este gatilho vai
-- além: recusa UPDATE, DELETE e TRUNCATE até para o dono do banco.
-- (Quando a política de retenção for decidida — D26 — ela precisará
-- desligar este gatilho conscientemente.)
create or replace function public.prevent_audit_log_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'O log de auditoria não pode ser alterado nem apagado.'
    using errcode = '42501';
end;
$$;

create or replace trigger prevent_audit_log_changes
  before update or delete on public.audit_logs
  for each row execute function public.prevent_audit_log_changes();
create or replace trigger prevent_audit_log_truncate
  before truncate on public.audit_logs
  for each statement execute function public.prevent_audit_log_changes();


-- ─── 6. Gatilho: novo cadastro avisa os aprovadores ─────────────────────────
-- Quando nasce um perfil 'pending', cria UM aviso para CADA usuário ativo que
-- tenha a permissão users.approve (D25).
create or replace function public.notify_approvers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending' then
    insert into public.notifications
      (recipient_id, notification_type, title, body, related_table, related_id)
    select p.id,
           'user_pending_approval',
           'Novo cadastro aguardando aprovação',
           format('%s (crachá %s) se cadastrou e aguarda aprovação.',
                  new.full_name, coalesce(new.badge_number, '—')),
           'profiles',
           new.id::text
      from public.profiles p
      join public.user_permissions up
        on up.user_id = p.id and up.permission_code = 'users.approve'
     where p.status = 'active'
       and p.id <> new.id;
  end if;
  return null;
end;
$$;

create or replace trigger notify_approvers
  after insert on public.profiles
  for each row execute function public.notify_approvers();


-- ─── 7. Gatilho: cadastro resolvido → avisos marcados como lidos ────────────
-- Quando alguém aprova (ou bloqueia) um cadastro pendente, o aviso daquele
-- cadastro some para TODOS os aprovadores, não só para quem aprovou (D25).
create or replace function public.resolve_approval_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status <> 'pending' then
    update public.notifications
       set read_at = now()
     where related_table = 'profiles'
       and related_id = new.id::text
       and notification_type = 'user_pending_approval'
       and read_at is null;
  end if;
  return null;
end;
$$;

create or replace trigger resolve_approval_notifications
  after update of status on public.profiles
  for each row execute function public.resolve_approval_notifications();


-- ─── 8. Realtime: avisos chegam na hora ─────────────────────────────────────
-- Adiciona a tabela à "publicação" que o Supabase Realtime escuta. O bloco
-- confere antes, para não dar erro se já tiver sido adicionada.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;


-- ─── 9. Segurança ───────────────────────────────────────────────────────────
alter table public.notifications enable row level security;
alter table public.audit_logs    enable row level security;


-- ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
-- ▓ 20260920160000_create_views_functions.sql
-- ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
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
-- Diferença em relação à migration 0009: o "drop view if exists" abaixo.
-- Sem ele, rodar este script num banco que JÁ tem a 0013 aplicada falha com
-- "cannot drop columns from view" — o create or replace da 0009 tentaria tirar
-- a coluna basis, que a 0013 acrescentou. Nada depende desta view.
drop view if exists public.current_machine_targets;
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


-- ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
-- ▓ 20260920170000_enable_rls_policies.sql
-- ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0010 — Segurança: políticas de acesso (RLS) em todas as tabelas
-- Decisões: D19, D20, D22, D23, D25, D26, D33
-- Documentação: docs/database/02-referencia-tecnica.md, seção 7
--
-- O que é RLS (Row Level Security): uma regra que o PRÓPRIO BANCO aplica a
-- cada consulta, linha por linha. Mesmo que alguém use a chave pública do
-- app (anon key) fora do app, só enxerga/altera o que a política permitir.
-- Todas as tabelas já estão com RLS LIGADO desde a migration que as criou;
-- sem política, ninguém acessa nada. Aqui abrimos, com cuidado, o necessário.
--
-- Como ler uma política:
--   create policy <nome> on <tabela> for <select|insert|update|delete>
--     to authenticated                 → vale só para quem está logado
--     using (<condição>)               → quais linhas a pessoa pode VER/ALTERAR
--     with check (<condição>)          → quais linhas a pessoa pode GRAVAR
--
-- Detalhe de desempenho: as funções aparecem como "(select public.f())".
-- Assim o banco calcula a resposta UMA vez por consulta, e não uma vez por
-- linha.
--
-- Escritas que têm regra de negócio (apontamentos, aprovação, identificação
-- na conta Admin, cadastro de máquina) NÃO têm política de escrita: só
-- acontecem pelas funções da migration 0009, que conferem as permissões.
--
-- Idempotente: cada política só é criada se ainda não existir.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── Ajudante: criar a política só se ela ainda não existir ─────────────────
-- (O Postgres não tem "create policy if not exists".) A função fica no
-- schema temporário pg_temp: some sozinha ao fim da conexão.
create or replace function pg_temp.create_policy(p_table text, p_name text, p_definition text)
returns void
language plpgsql
as $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = p_table and policyname = p_name
  ) then
    execute format('create policy %I on public.%I %s', p_name, p_table, p_definition);
  end if;
end;
$$;


-- ─── 1. Cadastros básicos: turnos, máquinas, catálogo de acesso ─────────────
-- Qualquer usuário ATIVO lê (a tela de apontamento precisa deles).
select pg_temp.create_policy('shifts', 'shifts_select_active',
  'for select to authenticated using ((select public.is_active_user()))');
-- Ativar/desativar turno (substitui o "turnosAtivos" do navegador, D06).
select pg_temp.create_policy('shifts', 'shifts_update_admin',
  'for update to authenticated using ((select public.has_permission(''system.admin'')))
   with check ((select public.has_permission(''system.admin'')))');

select pg_temp.create_policy('machines', 'machines_select_active',
  'for select to authenticated using ((select public.is_active_user()))');
-- Alterar nome, status, lotação. Cadastro novo: só pela função create_machine.
select pg_temp.create_policy('machines', 'machines_update_manage',
  'for update to authenticated using ((select public.has_permission(''machines.manage'')))
   with check ((select public.has_permission(''machines.manage'')))');

select pg_temp.create_policy('roles', 'roles_select_active',
  'for select to authenticated using ((select public.is_active_user()))');
select pg_temp.create_policy('permissions', 'permissions_select_active',
  'for select to authenticated using ((select public.is_active_user()))');
select pg_temp.create_policy('role_permissions', 'role_permissions_select_active',
  'for select to authenticated using ((select public.is_active_user()))');


-- ─── 2. Metas ───────────────────────────────────────────────────────────────
-- Todos os ativos leem (a meta aparece na tela de apontamento).
-- Nova meta: targets.manage. Sem UPDATE/DELETE: histórico append-only (D13).
select pg_temp.create_policy('machine_targets', 'machine_targets_select_active',
  'for select to authenticated using ((select public.is_active_user()))');
select pg_temp.create_policy('machine_targets', 'machine_targets_insert_manage',
  'for insert to authenticated with check ((select public.has_permission(''targets.manage'')))');


-- ─── 3. Produção ────────────────────────────────────────────────────────────
-- Lê apontamentos quem tem histórico, dashboard ou modo TV — e, D33, qualquer
-- usuário lê os apontamentos QUE ELE MESMO fez (necessário para corrigir o
-- próprio apontamento em 24 h, D24).
select pg_temp.create_policy('production_records', 'production_records_select',
  'for select to authenticated using (
     (select public.has_permission(''history.view''))
     or (select public.has_permission(''dashboard.view''))
     or (select public.has_permission(''tv_mode.view''))
     or (created_by = (select auth.uid()) and (select public.is_active_user()))
   )');
-- Ordens: visíveis quando o apontamento-pai é visível (o RLS do pai vale
-- dentro da subconsulta).
select pg_temp.create_policy('production_orders', 'production_orders_select',
  'for select to authenticated using (
     exists (select 1 from public.production_records r where r.id = production_record_id)
   )');
select pg_temp.create_policy('machine_downtimes', 'machine_downtimes_select_active',
  'for select to authenticated using ((select public.is_active_user()))');


-- ─── 4. Calendário ──────────────────────────────────────────────────────────
select pg_temp.create_policy('calendar_events', 'calendar_events_select_active',
  'for select to authenticated using ((select public.is_active_user()))');
select pg_temp.create_policy('calendar_events', 'calendar_events_insert_manage',
  'for insert to authenticated with check ((select public.has_permission(''calendar.manage'')))');
select pg_temp.create_policy('calendar_events', 'calendar_events_update_manage',
  'for update to authenticated using ((select public.has_permission(''calendar.manage'')))
   with check ((select public.has_permission(''calendar.manage'')))');
select pg_temp.create_policy('calendar_events', 'calendar_events_delete_manage',
  'for delete to authenticated using ((select public.has_permission(''calendar.manage'')))');

select pg_temp.create_policy('calendar_event_shifts', 'calendar_event_shifts_select_active',
  'for select to authenticated using ((select public.is_active_user()))');
select pg_temp.create_policy('calendar_event_shifts', 'calendar_event_shifts_insert_manage',
  'for insert to authenticated with check ((select public.has_permission(''calendar.manage'')))');
select pg_temp.create_policy('calendar_event_shifts', 'calendar_event_shifts_delete_manage',
  'for delete to authenticated using ((select public.has_permission(''calendar.manage'')))');


-- ─── 5. Pessoas ─────────────────────────────────────────────────────────────
-- profiles: cada um lê o PRÓPRIO perfil (inclusive pendente, para a tela
-- "aguardando aprovação"); quem aprova usuários lê e altera todos.
select pg_temp.create_policy('profiles', 'profiles_select_own_or_approver',
  'for select to authenticated using (
     id = (select auth.uid()) or (select public.has_permission(''users.approve''))
   )');
select pg_temp.create_policy('profiles', 'profiles_update_approver',
  'for update to authenticated using ((select public.has_permission(''users.approve'')))
   with check ((select public.has_permission(''users.approve'')))');

-- user_permissions: cada um lê as próprias; quem aprova lê todas e pode
-- marcar/desmarcar permissões individuais (D22).
select pg_temp.create_policy('user_permissions', 'user_permissions_select_own_or_approver',
  'for select to authenticated using (
     user_id = (select auth.uid()) or (select public.has_permission(''users.approve''))
   )');
select pg_temp.create_policy('user_permissions', 'user_permissions_insert_approver',
  'for insert to authenticated with check ((select public.has_permission(''users.approve'')))');
select pg_temp.create_policy('user_permissions', 'user_permissions_delete_approver',
  'for delete to authenticated using ((select public.has_permission(''users.approve'')))');

-- shared_account_sessions: a própria conta compartilhada vê suas sessões; a
-- administração do sistema vê todas. Gravação só pela função (D23).
select pg_temp.create_policy('shared_account_sessions', 'shared_account_sessions_select',
  'for select to authenticated using (
     account_id = (select auth.uid()) or (select public.has_permission(''system.admin''))
   )');


-- ─── 6. Notificações e auditoria ────────────────────────────────────────────
-- notifications: cada um só vê e marca como lidas as PRÓPRIAS (D25).
select pg_temp.create_policy('notifications', 'notifications_select_own',
  'for select to authenticated using (recipient_id = (select auth.uid()))');
select pg_temp.create_policy('notifications', 'notifications_update_own',
  'for update to authenticated using (recipient_id = (select auth.uid()))
   with check (recipient_id = (select auth.uid()))');
-- Além da linha, limita a COLUNA: o usuário só consegue alterar read_at
-- (não dá para reescrever o texto do aviso).
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- audit_logs: só leitura, e só para a administração do sistema (D26).
-- Nenhuma política de escrita: só os gatilhos gravam.
select pg_temp.create_policy('audit_logs', 'audit_logs_select_admin',
  'for select to authenticated using ((select public.has_permission(''system.admin'')))');


-- ─── 7. Visitante não logado (anon): nenhum acesso às tabelas ───────────────
-- O RLS já bloqueia (não existe política para anon). Retirar os direitos de
-- tabela é uma segunda tranca: mesmo que alguém crie uma política errada no
-- futuro, o visitante continua sem acesso.
revoke all on
  public.shifts, public.machines, public.machine_targets,
  public.production_records, public.production_orders, public.machine_downtimes,
  public.calendar_events, public.calendar_event_shifts,
  public.roles, public.permissions, public.role_permissions,
  public.profiles, public.user_permissions, public.shared_account_sessions,
  public.notifications, public.audit_logs,
  public.production_summary, public.current_machine_targets
from anon;


-- ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
-- ▓ 20260921100000_own_records_by_permission.sql
-- ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0011 — "Ver os próprios apontamentos" passa a depender de permissão
-- Decisões: D22, D24, D33 (confirmada em 21/09/2026)
-- Documentação: docs/database/02-referencia-tecnica.md, seção 7
--
-- Antes: qualquer usuário ativo lia os apontamentos que ele mesmo fez.
-- Agora: só quem tem a permissão production.edit_own ("corrigir os próprios
-- apontamentos até 24 h"). O motivo de ver os próprios é justamente poder
-- corrigi-los — então as duas coisas andam juntas.
--
-- Por que permissão e não o nome do perfil "Operador": as permissões de cada
-- pessoa podem ser ajustadas individualmente (D22). Se o gestor tirar de um
-- operador o direito de corrigir, ele também deixa de ver; se der a outra
-- pessoa, ela passa a ver. O perfil é só o ponto de partida.
--
-- Na prática, com os perfis de fábrica nada muda: todos os perfis, menos TV,
-- têm production.edit_own, e todos, menos Operador, já veem toda a produção.
--
-- "alter policy" só troca a condição da política existente (nada é apagado).
-- Rodar de novo produz o mesmo resultado.
-- ═══════════════════════════════════════════════════════════════════════════

alter policy production_records_select on public.production_records
  using (
    (select public.has_permission('history.view'))
    or (select public.has_permission('dashboard.view'))
    or (select public.has_permission('tv_mode.view'))
    or (created_by = (select auth.uid()) and (select public.has_permission('production.edit_own')))
  );


-- ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
-- ▓ 20260921101000_fix_edit_rules_null_author.sql
-- ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0012 — Correção: apontamento SEM AUTOR não pode ser editado por
--                  quem só tem "corrigir os próprios"
-- Decisões: D24
-- Documentação: docs/database/02-referencia-tecnica.md, seção 6.1
--
-- O defeito (encontrado em 21/09/2026 nos testes):
--   A regra "é o autor?" era  created_by = auth.uid().  Quando o apontamento
--   não tem autor (created_by vazio — dados de demonstração, carga inicial e,
--   no futuro, apontamentos migrados da planilha), essa comparação não dá
--   "verdadeiro" nem "falso": dá "desconhecido" (NULL). E o teste
--   "se NÃO pode editar, recuse" não recusa um "desconhecido". Resultado: um
--   operador conseguia acrescentar ordens em apontamento que não era dele.
--
-- A correção: coalesce(..., false) — "desconhecido" passa a valer "não".
-- Apontamento sem autor só é editável/apagável por quem tem production.edit /
-- production.delete.
--
-- "create or replace" troca só o corpo das funções; o resto fica igual.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.can_edit_production_record(p_created_by uuid, p_created_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.has_permission('production.edit')
    or (public.has_permission('production.edit_own')
        and p_created_by = auth.uid()
        and p_created_at > now() - interval '24 hours'),
    false)
$$;

create or replace function public.can_delete_production_record(p_created_by uuid, p_created_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.has_permission('production.delete')
    or (public.has_permission('production.edit_own')
        and p_created_by = auth.uid()
        and p_created_at > now() - interval '24 hours'),
    false)
$$;

comment on function public.can_edit_production_record(uuid, timestamptz) is
  'production.edit, ou production.edit_own sendo autor e dentro de 24 h. Sem autor = só production.edit. [D24]';
comment on function public.can_delete_production_record(uuid, timestamptz) is
  'production.delete, ou production.edit_own sendo autor e dentro de 24 h. Sem autor = só production.delete. [D24]';


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0013 (25/09/2026) — processo, capacidade, tempo de turno e base da meta
-- ═══════════════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0013 — Processo, capacidade, turno planejado e base da meta
-- Decisões: D37, D39, D40, D41, D42
-- Documentação: docs/database/02-referencia-tecnica.md, seções 3.1, 3.2 e 3.6
--               docs/database/cadernos/07-mapa-da-fabrica.pdf
--
-- PARTE 1 de 3 da adequação ao desenho real da fábrica de Itajaí.
--   parte 1 (esta)  → campos novos. NÃO mexe em nenhum dado existente.
--   parte 2         → os 22 centros de trabalho (renomear, criar, D43).
--   parte 3         → as metas reais (D38).
--
-- Tudo aqui é aditivo: "add column if not exists" e "create or replace".
-- A única exceção é a restrição de situação da máquina, que é trocada para
-- ACEITAR um valor a mais ('planned'). É uma troca que só amplia: nenhuma
-- linha existente pode deixar de passar por ela.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. machines: a que processo o centro pertence (D37) ────────────────────
-- A fábrica é organizada em dois processos, e o nome do centro não basta para
-- saber qual: a "EMBALADORA KIT PARAFUSOS" pertence à MONTAGEM.
--
-- Fica aceitando nulo por enquanto porque as 18 máquinas já cadastradas ainda
-- não têm processo definido — quem preenche é a parte 2. Depois dela, o campo
-- pode virar obrigatório numa migration própria.
alter table public.machines
  add column if not exists process text
  check (process in ('assembly', 'packaging'));

comment on column public.machines.process is
  'Processo do centro de trabalho: assembly (montagem) ou packaging (embalagem). [D37]';


-- ─── 2. machines: capacidade, só como alarme (D40) ──────────────────────────
-- Estes dois campos NÃO calculam a meta. Eles existem para o sistema avisar
-- quando alguém digita uma meta fisicamente impossível:
--
--     capacidade técnica do turno = pieces_per_minute × minutos úteis do turno
--
-- Por que não derivar a meta daqui: as metas acordadas em 25/09/2026 ficam
-- entre 62% e 86% da capacidade técnica, sem fator único. A meta é negociada
-- pelo gestor, não calculada pelo banco. Ver D40.
alter table public.machines
  add column if not exists pieces_per_minute numeric(10, 3)
  check (pieces_per_minute > 0);

alter table public.machines
  add column if not exists efficiency numeric(4, 3)
  check (efficiency > 0 and efficiency <= 1);

comment on column public.machines.pieces_per_minute is
  'Peças por minuto do centro, da planilha de capacidade. Usado só como alarme de meta impossível. [D40]';
comment on column public.machines.efficiency is
  'Eficiência esperada do centro (0 a 1; a fábrica usa 0,60 a 0,90). Não entra no cálculo da meta. [D40]';


-- ─── 3. machines: máquina planejada e data de entrada (D41) ─────────────────
-- Sete centros já estão previstos mas não produzem nada hoje. Cadastrar sem
-- marcar isso faria o indicador contar dezenas de turnos zerados de um
-- equipamento que nem chegou.
--
-- started_on também resolve o problema dos zeros antigos levantado na D35:
-- turno anterior a esta data não é cobrado da máquina.
alter table public.machines
  add column if not exists started_on date;

comment on column public.machines.started_on is
  'Data de entrada em operação. Turnos anteriores a ela não são cobrados da máquina. [D41, D35]';

-- A restrição de situação passa a aceitar 'planned'. Só amplia o que é aceito:
-- 'active', 'inactive', 'maintenance' e 'preventive_maintenance' continuam
-- valendo, então nenhuma linha existente é afetada.
alter table public.machines
  drop constraint if exists machines_status_check;

alter table public.machines
  add constraint machines_status_check
  check (status in ('active', 'inactive', 'maintenance',
                    'preventive_maintenance', 'planned'));

comment on column public.machines.status is
  'Situação: active, inactive, maintenance, preventive_maintenance ou planned '
  '(prevista, ainda não existe na fábrica). [D05, D41]';


-- ─── 4. shifts: o tempo que realmente produz (D42) ──────────────────────────
-- start_time e end_time continuam sendo só informativos. Quem manda no cálculo
-- é useful_minutes.
--
-- Os dois NÃO precisam fechar por subtração, e isso é de propósito: no T1 o
-- horário começa 04:55 mas a produção começa 05:00 — os 5 minutos são entrada
-- e preparação. O gross_minutes guarda o que a planilha de capacidade usa.
--
-- Valores a carregar na parte 2 (da planilha de 09/09/2026):
--   T1  bruto 558  útil 493      T2  bruto 546  útil 481
--   T3  bruto 336  útil 271      (descontos iguais nos três: 65 min)
--
-- Hoje o T3 só existe como hora extra, que já fica fora do cálculo de meta.
-- Guardamos o tempo agora para que, quando ele virar turno normal, ajustar a
-- meta seja uma conta e não uma migration de emergência (271 min é 55% dos
-- 493 do T1 — com a mesma meta, o T3 nasceria reprovado).
alter table public.shifts
  add column if not exists gross_minutes smallint
  check (gross_minutes > 0);

alter table public.shifts
  add column if not exists useful_minutes smallint
  check (useful_minutes > 0);

comment on column public.shifts.gross_minutes is
  'Duração bruta do turno em minutos, conforme a planilha de capacidade. Informativo. [D42]';
comment on column public.shifts.useful_minutes is
  'Minutos que realmente produzem (bruto menos refeição, ginástica, intervalo e troca). '
  'É este número que entra no cálculo de capacidade. [D42]';

-- O tempo útil nunca pode passar do bruto. A restrição fica na tabela (e não
-- em cada coluna) porque depende das duas ao mesmo tempo. Linhas com os campos
-- ainda vazios passam sem problema: em SQL, comparação com nulo não é falsa,
-- é "não sei", e o check só reprova o que é comprovadamente falso.
alter table public.shifts
  drop constraint if exists shifts_useful_within_gross;

alter table public.shifts
  add constraint shifts_useful_within_gross
  check (useful_minutes <= gross_minutes);


-- ─── 5. machine_targets: meta por turno ou por pessoa (D39) ─────────────────
-- Onze centros têm meta fixa por turno. A Bancada Embalagem A Granel é medida
-- em 25.000 peças POR PESSOA no turno — três pessoas apontadas significam meta
-- de 75.000.
--
-- O default 'per_shift' faz as metas que já existem continuarem se comportando
-- exatamente como antes, sem precisar tocar em nenhuma linha.
alter table public.machine_targets
  add column if not exists basis text not null default 'per_shift'
  check (basis in ('per_shift', 'per_operator'));

comment on column public.machine_targets.basis is
  'Como ler quantity_per_shift: per_shift (meta do turno inteiro) ou '
  'per_operator (meta por pessoa, multiplicada pela lotação do apontamento). [D39]';


-- ─── 6. A view da meta vigente passa a mostrar a base ───────────────────────
-- Sem isso, quem lê a view não tem como saber se 25.000 é a meta do turno ou
-- de cada pessoa. A coluna nova entra no fim para não trocar a ordem das que
-- já existem (o "create or replace view" do PostgreSQL exige isso).
create or replace view public.current_machine_targets
with (security_invoker = true)
as
select distinct on (t.machine_id)
  t.machine_id,
  t.id          as target_id,
  t.quantity_per_shift,
  t.valid_from,
  t.created_by,
  t.created_at,
  t.basis
from public.machine_targets t
where t.valid_from <= (now() at time zone 'America/Sao_Paulo')::date
order by t.machine_id, t.valid_from desc;

comment on view public.current_machine_targets is
  'Meta vigente hoje (America/Sao_Paulo) por máquina: maior valid_from <= hoje. [D13, D39]';


-- ═══════════════════════════════════════════════════════════════════════════
-- O que esta migration NÃO faz, de propósito:
--   • não preenche processo, capacidade nem data de entrada (parte 2);
--   • não carrega os minutos dos turnos (parte 2);
--   • não cria, renomeia nem inativa nenhuma máquina (parte 2);
--   • não mexe em nenhuma meta (parte 3);
--   • não implementa o alarme de meta impossível nem a meta por operador no
--     cálculo — os campos existem, quem os usa vem depois;
--   • não torna a meta proporcional ao tempo útil do turno: isso só quando o
--     T3 virar turno normal (D42).
-- ═══════════════════════════════════════════════════════════════════════════
