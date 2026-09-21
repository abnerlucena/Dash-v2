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
