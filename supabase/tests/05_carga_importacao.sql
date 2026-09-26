-- Testes da carga e da reversão do lote de importação (migration 0019).
-- Decisões: D35. Ver README desta pasta.
--
-- Rode SEMPRE dentro de uma transação desfeita, depois do seed estrutural, do
-- 00_fixtures.sql e com um lote já na área de preparo.

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  perform public.approve_user('00000000-0000-0000-0000-0000000000b1', 1::smallint);  -- operador
  perform public.approve_user('00000000-0000-0000-0000-0000000000b2', 6::smallint);  -- admin
end $$;

create temp table rc(n int, caso text, esperado text, resultado text);

-- Um apontamento feito À MÃO, que a importação não pode encostar.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  perform public.save_production_record('2026-09-22'::date, 1::smallint, 1,
    '[{"order_number":"000001009999","quantity":1234}]'::jsonb, 'apontado por uma pessoa');
  insert into rc values (1, 'apontamento manual criado', 'aceita', 'ACEITOU');
exception when others then insert into rc values (1, 'apontamento manual criado', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- O operador não pode carregar lote.
do $$ begin
  perform public.carregar_lote_importacao((select id from public.import_batches limit 1));
  insert into rc values (2, 'operador carrega lote', 'recusa', 'ACEITOU');
exception when others then insert into rc values (2, 'operador carrega lote', 'recusa', 'RECUSOU'); end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');

-- Carga.
do $$ declare r jsonb; begin
  r := public.carregar_lote_importacao((select id from public.import_batches limit 1));
  insert into rc values (3, 'admin carrega o lote', 'aceita',
    case when (r->>'apontamentos')::int > 2000 then 'ACEITOU' else 'RECUSOU: ' || r::text end);
exception when others then insert into rc values (3, 'admin carrega o lote', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- Carregar duas vezes tem que ser recusado.
do $$ begin
  perform public.carregar_lote_importacao((select id from public.import_batches limit 1));
  insert into rc values (4, 'carregar o mesmo lote de novo', 'recusa', 'ACEITOU');
exception when others then insert into rc values (4, 'carregar o mesmo lote de novo', 'recusa', 'RECUSOU'); end $$;

-- O apontamento manual continua lá, e sem marca de lote.
do $$ declare n int; begin
  select count(*) into n from public.production_records
   where production_date = '2026-09-22' and machine_id = 1 and import_batch_id is null;
  insert into rc values (5, 'apontamento manual sobreviveu à carga', 'aceita',
    case when n = 1 then 'ACEITOU' else format('RECUSOU: achei %s', n) end);
end $$;

-- Importado nasce sem autor e com a origem na planilha registrada.
do $$ declare n int; begin
  select count(*) into n from public.production_records
   where import_batch_id is not null and (created_by is not null or source_ref is null);
  insert into rc values (6, 'importado sem autor e com origem', 'aceita',
    case when n = 0 then 'ACEITOU' else format('RECUSOU: %s fora do padrão', n) end);
end $$;

-- As duas linhas do mesmo dia e turno viraram UM apontamento com DUAS ordens.
do $$ declare n int; begin
  select count(*) into n from public.production_orders o
    join public.production_records p on p.id = o.production_record_id
   where p.production_date = '2026-09-02' and p.machine_id = 1 and p.shift_id = 1;
  insert into rc values (7, 'produção e retrabalho no mesmo apontamento', 'aceita',
    case when n = 2 then 'ACEITOU' else format('RECUSOU: %s ordens', n) end);
end $$;

-- Reversão.
do $$ declare r jsonb; begin
  r := public.reverter_lote_importacao((select id from public.import_batches limit 1));
  insert into rc values (8, 'admin reverte o lote', 'aceita',
    case when (r->>'apontamentos_apagados')::int > 2000 then 'ACEITOU' else 'RECUSOU: ' || r::text end);
exception when others then insert into rc values (8, 'admin reverte o lote', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- Depois de reverter: nenhum importado, e o manual intacto.
do $$ declare imp int; man int; begin
  select count(*) into imp from public.production_records where import_batch_id is not null;
  select count(*) into man from public.production_records where import_batch_id is null;
  insert into rc values (9, 'reversão apagou só o importado', 'aceita',
    case when imp = 0 and man = 1 then 'ACEITOU' else format('RECUSOU: importados=%s manuais=%s', imp, man) end);
end $$;

-- As paradas importadas também saíram.
do $$ declare n int; begin
  select count(*) into n from public.machine_downtimes where source = 'spreadsheet';
  insert into rc values (10, 'paradas importadas apagadas', 'aceita',
    case when n = 0 then 'ACEITOU' else format('RECUSOU: sobraram %s', n) end);
end $$;

-- A área de preparo voltou a poder ser carregada de novo.
do $$ declare n int; begin
  select count(*) into n from public.import_rows where status <> 'pending';
  insert into rc values (11, 'preparo voltou ao estado inicial', 'aceita',
    case when n = 0 then 'ACEITOU' else format('RECUSOU: %s linhas fora de pending', n) end);
end $$;

select n, caso, esperado, resultado,
       case when (esperado = 'aceita') = (resultado = 'ACEITOU') then 'PASSOU' else '>>> FALHOU' end as veredito
  from rc order by n;
