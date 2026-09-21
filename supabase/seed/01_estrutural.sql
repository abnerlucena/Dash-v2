-- ═══════════════════════════════════════════════════════════════════════════
-- Seed ESTRUTURAL — dados reais que o sistema precisa para funcionar
-- Pode rodar quantas vezes quiser: nada é duplicado nem sobrescrito
-- ("on conflict do nothing" / "where not exists").
--
-- Conteúdo:
--   1. Perfis-modelo (roles)                    — 7 linhas
--   2. Permissões (permissions)                 — 18 linhas
--   3. Permissões de cada perfil (role_permissions) — matriz da seção 8 da
--      referência técnica
--   4. Máquinas reais (machines)                — ids 1 a 18 do legado
--      (a 19 "RETRABALHO GERAL" não é recriada — decisão do desenho v0.1.0)
--   5. Metas vigentes (machine_targets)         — só para máquina SEM meta
--
-- Pré-requisito: migrations até 20260920170000 aplicadas.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. Perfis-modelo ───────────────────────────────────────────────────────
insert into public.roles (id, code, name, description) values
  (1, 'operator',    'Operador',     'Aponta produção e corrige os próprios apontamentos por 24 h'),
  (2, 'preparer',    'Preparador',   'Operador + histórico, feedbacks, editar e apagar um por vez'),
  (3, 'distributor', 'Distribuidor', 'Preparador + edição/exclusão em massa e exportação de relatórios'),
  (4, 'technician',  'Técnico',      'Distribuidor + dashboard, metas (ver), máquinas, calendário, alertas e modo TV'),
  (5, 'manager',     'Gestor',       'Acesso total, incluindo alterar metas e aprovar usuários'),
  (6, 'admin',       'Admin',        'Acesso total, em conta compartilhada com identificação por crachá'),
  (7, 'tv_display',  'TV',           'Somente o modo TV')
on conflict (id) do nothing;


-- ─── 2. Permissões ──────────────────────────────────────────────────────────
insert into public.permissions (code, description, category, sort_order) values
  ('production.create',      'Apontar produção',                                   'Apontamento', 10),
  ('production.edit_own',    'Corrigir os próprios apontamentos (até 24 h)',       'Apontamento', 20),
  ('production.edit',        'Editar qualquer apontamento',                         'Apontamento', 30),
  ('production.delete',      'Apagar qualquer apontamento',                         'Apontamento', 40),
  ('production.bulk_edit',   'Editar vários apontamentos de uma vez',               'Apontamento', 50),
  ('production.bulk_delete', 'Apagar vários apontamentos de uma vez',               'Apontamento', 60),
  ('history.view',           'Ver histórico de apontamentos',                       'Análise',     110),
  ('feedbacks.view',         'Ver e editar observações (feedbacks)',                'Análise',     120),
  ('reports.export',         'Exportar relatórios (PDF/CSV)',                       'Análise',     130),
  ('dashboard.view',         'Ver o dashboard',                                     'Análise',     140),
  ('targets.view',           'Ver metas',                                           'Análise',     150),
  ('tv_mode.view',           'Usar o modo TV',                                      'Análise',     160),
  ('machines.manage',        'Cadastrar e alterar máquinas',                        'Gestão',      210),
  ('calendar.manage',        'Cadastrar feriados, eventos e dias anulados',         'Gestão',      220),
  ('alerts.manage',          'Configurar alertas',                                  'Gestão',      230),
  ('targets.manage',         'Alterar metas',                                       'Gestão',      240),
  ('users.approve',          'Aprovar usuários e ajustar permissões',               'Gestão',      250),
  ('system.admin',           'Administração do sistema (auditoria, turnos)',        'Sistema',     310)
on conflict (code) do nothing;


-- ─── 3. Permissões de cada perfil-modelo ────────────────────────────────────
-- Montado a partir da matriz: cada permissão lista os perfis que a recebem.
insert into public.role_permissions (role_id, permission_code)
select r.id, m.permission_code
  from (values
    ('production.create',      array['operator','preparer','distributor','technician','manager','admin']),
    ('production.edit_own',    array['operator','preparer','distributor','technician','manager','admin']),
    ('production.edit',        array['preparer','distributor','technician','manager','admin']),
    ('production.delete',      array['preparer','distributor','technician','manager','admin']),
    ('production.bulk_edit',   array['distributor','technician','manager','admin']),
    ('production.bulk_delete', array['distributor','technician','manager','admin']),
    ('history.view',           array['preparer','distributor','technician','manager','admin']),
    ('feedbacks.view',         array['preparer','distributor','technician','manager','admin']),
    ('reports.export',         array['distributor','technician','manager','admin']),
    ('dashboard.view',         array['technician','manager','admin']),
    ('targets.view',           array['technician','manager','admin']),
    ('tv_mode.view',           array['technician','manager','admin','tv_display']),
    ('machines.manage',        array['technician','manager','admin']),
    ('calendar.manage',        array['technician','manager','admin']),
    ('alerts.manage',          array['technician','manager','admin']),
    ('targets.manage',         array['manager','admin']),
    ('users.approve',          array['manager','admin']),
    ('system.admin',           array['manager','admin'])
  ) as m(permission_code, role_codes)
  cross join lateral unnest(m.role_codes) as rc(code)
  join public.roles r on r.code = rc.code
on conflict do nothing;


-- ─── 4. Máquinas reais ──────────────────────────────────────────────────────
-- Fonte: MACHINES_DEFAULT em src/lib/api.ts (= MACHINE_DEFS do Main.gs).
-- Os ids do legado são mantidos (1 a 18) para que a migração dos apontamentos
-- antigos case direto. "overriding system value" permite informar o id numa
-- coluna que normalmente é numerada pelo banco.
insert into public.machines (id, name, has_target, status)
overriding system value
values
  (1,  'HORIZONTAL 1',                      true, 'active'),
  (2,  'HORIZONTAL 2',                      true, 'active'),
  (3,  'VERTICAL PLACAS / SUP. 1',          true, 'active'),
  (4,  'VERTICAL PLACAS / SUP. 2',          true, 'active'),
  (5,  'VERTICAL MÓDULOS 1',                true, 'active'),
  (6,  'VERTICAL MÓDULOS 2',                true, 'active'),
  (7,  'A GRANEL',                          true, 'active'),
  (8,  'MÁQUINA INTERRUPTOR',               true, 'active'),
  (9,  'TESTE INTERRUPTORES',               true, 'active'),
  (10, 'MANUAL INTERRUPTOR',                true, 'active'),
  (11, 'MONTAGEM DIVERSOS',                 true, 'active'),
  (12, 'MONTAGEM PLACA REFINATTO',          true, 'active'),
  (13, 'KIT 1 PARAFUSO',                    true, 'active'),
  (14, 'KIT 2 PARAFUSO',                    true, 'active'),
  (15, 'MONTAGEM TOMADAS MANUAL',           true, 'active'),
  (16, 'MÁQUINA DE TOMADAS AUTOMÁTICA',     true, 'active'),
  (17, 'INSERÇÃO DOS CONTATOS INTERRUPTOR', true, 'active'),
  (18, 'FECHAMENTO TECLA INTERRUPTORES',    true, 'active')
on conflict (id) do nothing;

-- Acerta o contador de ids: a próxima máquina cadastrada pelo app recebe
-- (maior id existente + 1), e não 1 — que já está em uso.
select setval(
  pg_get_serial_sequence('public.machines', 'id'),
  greatest((select max(id) from public.machines), 1)
);


-- ─── 5. Metas vigentes ──────────────────────────────────────────────────────
-- Fonte: defaultMeta de MACHINES_DEFAULT. ATENÇÃO: podem não ser as metas
-- reais atuais (as reais estão na aba "Metas" da planilha). Conferir e, se
-- preciso, ajustar pela tela de Metas — que cria uma nova vigência.
-- Só insere para máquina que ainda não tem NENHUMA meta: rodar de novo não
-- altera metas já existentes. Vigência: hoje (fuso de Brasília).
insert into public.machine_targets (machine_id, quantity_per_shift, valid_from)
select v.machine_id, v.quantity, (now() at time zone 'America/Sao_Paulo')::date
  from (values
    (1, 500), (2, 500), (3, 400), (4, 400), (5, 350), (6, 350),
    (7, 600), (8, 300), (9, 250), (10, 200), (11, 150), (12, 180),
    (13, 220), (14, 220), (15, 160), (16, 500), (17, 0), (18, 0)
  ) as v(machine_id, quantity)
 where exists (select 1 from public.machines m where m.id = v.machine_id)
   and not exists (select 1 from public.machine_targets t where t.machine_id = v.machine_id);
