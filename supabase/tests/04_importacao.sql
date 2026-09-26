-- Testes da área de preparo da importação (migration 0016).
-- Decisões: D35. Ver README desta pasta.
--
-- Rode SEMPRE dentro de uma transação desfeita no fim, depois do seed
-- estrutural e do 00_fixtures.sql. Nada do que este arquivo escreve fica.

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  perform public.approve_user('00000000-0000-0000-0000-0000000000b1', 1::smallint);  -- operador
  perform public.approve_user('00000000-0000-0000-0000-0000000000b2', 6::smallint);  -- admin
end $$;

create temp table ri(n int, caso text, esperado text, resultado text);

-- ─── Como admin: as regras de coerência da área de preparo ─────────────────
-- Usa b2 promovido a admin, e não a conta Admin das fixtures: aquela é
-- COMPARTILHADA, e has_permission só concede a conta compartilhada quando há
-- alguém identificado na sessão (D-conta compartilhada).
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');

do $$ begin
  insert into public.import_batches (id, source_file, description)
  values ('00000000-0000-0000-0000-0000000ba701'::uuid, 'ITAJAI - CONTROLE DE PRODUÇÃO 2026.xlsx', 'lote de teste');
  insert into ri values (1, 'admin cria lote', 'aceita', 'ACEITOU');
exception when others then insert into ri values (1, 'admin cria lote', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ begin
  insert into public.import_rows (batch_id, source_sheet, source_cell, raw_machine, raw_value,
    kind, machine_id, production_date, shift_id, work_mode, quantity)
  values ('00000000-0000-0000-0000-0000000ba701'::uuid, 'JUN 26', 'F12', 'HORIZONTAL 1', '8300',
    'production', 1, '2026-06-12', 1, 'regular', 8300);
  insert into ri values (2, 'linha de produção completa', 'aceita', 'ACEITOU');
exception when others then insert into ri values (2, 'linha de produção completa', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ begin
  insert into public.import_rows (batch_id, source_sheet, source_cell, raw_machine, raw_value,
    kind, production_date, shift_id, work_mode, quantity)
  values ('00000000-0000-0000-0000-0000000ba701'::uuid, 'JUN 26', 'G12', 'MAQUINA X', '500',
    'production', '2026-06-12', 1, 'regular', 500);   -- sem machine_id
  insert into ri values (3, 'produção sem máquina', 'recusa', 'ACEITOU');
exception when check_violation then insert into ri values (3, 'produção sem máquina', 'recusa', 'RECUSOU'); end $$;

do $$ begin
  insert into public.import_rows (batch_id, source_sheet, source_cell, raw_machine, raw_value, kind)
  values ('00000000-0000-0000-0000-0000000ba701'::uuid, 'JUN 26', 'H12', 'REBITAGEM PINOS', '0', 'discard');  -- sem motivo
  insert into ri values (4, 'descarte sem motivo', 'recusa', 'ACEITOU');
exception when check_violation then insert into ri values (4, 'descarte sem motivo', 'recusa', 'RECUSOU'); end $$;

do $$ begin
  insert into public.import_rows (batch_id, source_sheet, source_cell, raw_machine, raw_value,
    kind, discard_reason)
  values ('00000000-0000-0000-0000-0000000ba701'::uuid, 'JAN 26', 'F04', 'VERTICAL MÓDULOS 1', '0',
    'discard', 'zero antes da entrada em operação (29/05/2026)');
  insert into ri values (5, 'descarte com motivo', 'aceita', 'ACEITOU');
exception when others then insert into ri values (5, 'descarte com motivo', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ begin
  insert into public.import_rows (batch_id, source_sheet, source_cell, raw_machine, raw_value,
    kind, machine_id, production_date, shift_id, work_mode, quantity)
  values ('00000000-0000-0000-0000-0000000ba701'::uuid, 'JUN 26', 'F12', 'HORIZONTAL 1', '8300',
    'production', 1, '2026-06-12', 1, 'regular', 8300);   -- MESMA célula do teste 2
  insert into ri values (6, 'mesma célula duas vezes no lote', 'recusa', 'ACEITOU');
exception when unique_violation then insert into ri values (6, 'mesma célula duas vezes no lote', 'recusa', 'RECUSOU'); end $$;

do $$ begin
  insert into public.import_rows (batch_id, source_sheet, source_cell, raw_machine, raw_value,
    kind, machine_id, production_date, shift_id, notes)
  values ('00000000-0000-0000-0000-0000000ba701'::uuid, 'MAR 26', 'F14', 'HORIZONTAL 1', 'Manutenção',
    'downtime', 1, '2026-03-06', 1, 'parada por manutenção');
  insert into ri values (7, 'parada sem quantidade', 'aceita', 'ACEITOU');
exception when others then insert into ri values (7, 'parada sem quantidade', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- Apagar o lote tem que levar as linhas junto: um lote pela metade seria pior
-- do que nenhum lote.
do $$ declare antes int; depois int; begin
  select count(*) into antes from public.import_rows where batch_id = '00000000-0000-0000-0000-0000000ba701'::uuid;
  delete from public.import_batches where id = '00000000-0000-0000-0000-0000000ba701'::uuid;
  select count(*) into depois from public.import_rows
   where batch_id = '00000000-0000-0000-0000-0000000ba701'::uuid;
  insert into ri values (8, 'apagar lote leva as linhas junto', 'aceita',
    case when antes = 3 and depois = 0 then 'ACEITOU' else format('RECUSOU: antes=%s depois=%s', antes, depois) end);
exception when others then insert into ri values (8, 'apagar lote leva as linhas junto', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── Como gestora: confere, mas não carrega ────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  perform count(*) from public.import_batches;
  insert into ri values (9, 'gestora lê a área de preparo', 'aceita', 'ACEITOU');
exception when others then insert into ri values (9, 'gestora lê a área de preparo', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ begin
  insert into public.import_batches (source_file) values ('gestora não pode');
  insert into ri values (10, 'gestora cria lote', 'recusa', 'ACEITOU');
exception when others then insert into ri values (10, 'gestora cria lote', 'recusa', 'RECUSOU'); end $$;

-- ─── Como operador: não enxerga a área de preparo ──────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ declare n int; begin
  select count(*) into n from public.import_batches;
  insert into ri values (11, 'operador enxerga lotes', 'recusa',
    case when n = 0 then 'RECUSOU' else format('ACEITOU: viu %s', n) end);
exception when others then insert into ri values (11, 'operador enxerga lotes', 'recusa', 'RECUSOU'); end $$;

do $$ declare n int; begin
  select count(*) into n from public.import_rows;
  insert into ri values (12, 'operador enxerga a preparo', 'recusa',
    case when n = 0 then 'RECUSOU' else format('ACEITOU: viu %s', n) end);
exception when others then insert into ri values (12, 'operador enxerga a preparo', 'recusa', 'RECUSOU'); end $$;

select n, caso, esperado, resultado,
       case when (esperado = 'aceita') = (resultado = 'ACEITOU') then 'PASSOU' else '>>> FALHOU' end as veredito
  from ri order by n;
