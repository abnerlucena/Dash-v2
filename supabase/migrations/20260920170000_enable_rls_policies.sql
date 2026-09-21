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
