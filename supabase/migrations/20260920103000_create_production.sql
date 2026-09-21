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
