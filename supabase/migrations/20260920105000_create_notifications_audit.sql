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
