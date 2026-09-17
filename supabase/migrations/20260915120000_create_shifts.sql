-- Migration 0001 — Tabela de turnos (shifts)
-- Decisão: D06 (docs/database/03-decisoes.md)
-- Substitui o texto solto "TURNO 1/2/3" e o localStorage "turnosAtivos".

create table public.shifts (
  id          smallint primary key,
  name        text     not null unique check (length(trim(name)) > 0),
  start_time  time,
  end_time    time,
  is_active   boolean  not null default true
);

comment on table public.shifts is
  'Turnos de produção da fábrica. O turno 3 atravessa a meia-noite (end_time < start_time). [D06]';

alter table public.shifts enable row level security;
