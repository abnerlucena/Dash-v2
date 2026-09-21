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
