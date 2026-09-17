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
