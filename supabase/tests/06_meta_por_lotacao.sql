-- Testes da meta que depende da lotação (migrations 0021 e 0022).
-- Decisões: D39, D46, D47. Ver README desta pasta.
--
-- Rode SEMPRE dentro de uma transação desfeita, depois do seed estrutural e do
-- 00_fixtures.sql, com as migrations 0021 e 0022 aplicadas.
--
-- Os apontamentos de teste são feitos para AMANHÃ: assim não encostam em nada
-- que a fábrica tenha apontado hoje, e a meta de amanhã já é o degrau novo das
-- horizontais, que a 0022 cria com vigência de hoje.

-- Tabelas e funções de apoio criadas ANTES de trocar de papel.
create temp table rc(n int, caso text, esperado text, resultado text);
create temp table ids(nome text primary key, id uuid);
grant all on rc, ids to authenticated;

-- Os centros pelo nome, não pelo id: o id é detalhe do banco.
create function pg_temp.maquina(p_nome text) returns integer language sql as $$
  select id from public.machines where name = p_nome
$$;
create function pg_temp.amanha() returns date language sql as $$
  select (now() at time zone 'America/Sao_Paulo')::date + 1
$$;
create function pg_temp.meta_efetiva(p_id uuid) returns integer language sql as $$
  select effective_target from public.production_summary where id = p_id
$$;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  perform public.approve_user('00000000-0000-0000-0000-0000000000b1', 1::smallint);  -- operador
end $$;

-- ─── A base de cada centro depois das migrations ─────────────────────────────
do $$ declare b text; begin
  b := public.machine_target_basis_on(pg_temp.maquina('BANCADA EMBALAGEM A GRANÉL'), pg_temp.amanha());
  insert into rc values (1, 'A Granél é por pessoa', 'aceita',
    case when b = 'per_operator' then 'ACEITOU' else 'RECUSOU: ' || coalesce(b, 'nulo') end);
  b := public.machine_target_basis_on(pg_temp.maquina('EMBALADORA HORIZONTAL N°1'), pg_temp.amanha());
  insert into rc values (2, 'Horizontal é rateada pela lotação', 'aceita',
    case when b = 'per_shift_prorated' then 'ACEITOU' else 'RECUSOU: ' || coalesce(b, 'nulo') end);
  b := public.machine_target_basis_on(pg_temp.maquina('EMBALADORA VERTICAL MÓDULOS N°1'), pg_temp.amanha());
  insert into rc values (3, 'Vertical continua com meta fixa', 'aceita',
    case when b = 'per_shift' then 'ACEITOU' else 'RECUSOU: ' || coalesce(b, 'nulo') end);
end $$;

-- ─── Apontamentos do operador ────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');

do $$ begin
  insert into ids values ('granel', public.save_production_record(pg_temp.amanha(), 1::smallint,
    pg_temp.maquina('BANCADA EMBALAGEM A GRANÉL'), '[{"order_number":"000001008001","quantity":60000}]'::jsonb,
    null, 3::smallint));
  insert into ids values ('horizontal', public.save_production_record(pg_temp.amanha(), 1::smallint,
    pg_temp.maquina('EMBALADORA HORIZONTAL N°1'), '[{"order_number":"000001008002","quantity":7000}]'::jsonb,
    null, 3::smallint));
  insert into ids values ('horizontal_sem_pessoas', public.save_production_record(pg_temp.amanha(), 2::smallint,
    pg_temp.maquina('EMBALADORA HORIZONTAL N°1'), '[{"order_number":"000001008003","quantity":9000}]'::jsonb));
  insert into ids values ('vertical', public.save_production_record(pg_temp.amanha(), 1::smallint,
    pg_temp.maquina('EMBALADORA VERTICAL MÓDULOS N°1'), '[{"order_number":"000001008004","quantity":12000}]'::jsonb,
    null, 5::smallint));
  insert into rc values (4, 'operador aponta os quatro turnos de teste', 'aceita', 'ACEITOU');
exception when others then insert into rc values (4, 'operador aponta os quatro turnos de teste', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

do $$ declare m int; begin
  m := pg_temp.meta_efetiva((select id from ids where nome = 'granel'));
  insert into rc values (5, 'A Granél com 3 pessoas: 25.000 × 3 = 75.000', 'aceita',
    case when m = 75000 then 'ACEITOU' else format('RECUSOU: %s', m) end);

  m := pg_temp.meta_efetiva((select id from ids where nome = 'horizontal'));
  insert into rc values (6, 'Horizontal com 3 das 4 pessoas: 10.000 × 3 ÷ 4 = 7.500', 'aceita',
    case when m = 7500 then 'ACEITOU' else format('RECUSOU: %s', m) end);

  m := pg_temp.meta_efetiva((select id from ids where nome = 'horizontal_sem_pessoas'));
  insert into rc values (7, 'Horizontal sem pessoas informadas: lotação padrão, meta cheia', 'aceita',
    case when m = 10000 then 'ACEITOU' else format('RECUSOU: %s', m) end);

  m := pg_temp.meta_efetiva((select id from ids where nome = 'vertical'));
  insert into rc values (8, 'Vertical com 5 pessoas: a lotação não muda a meta', 'aceita',
    case when m = 13000 then 'ACEITOU' else format('RECUSOU: %s', m) end);
end $$;

-- A base fica congelada no apontamento (D46).
do $$ declare b text; begin
  select target_basis into b from public.production_records where id = (select id from ids where nome = 'granel');
  insert into rc values (9, 'o apontamento guarda a base do dia', 'aceita',
    case when b = 'per_operator' then 'ACEITOU' else 'RECUSOU: ' || coalesce(b, 'nulo') end);
end $$;

-- Corrigir o nº de pessoas corrige a meta efetiva sozinho (a conta é na leitura).
do $$ declare m int; begin
  perform public.update_production_record((select id from ids where nome = 'granel'), null, 2::smallint);
  m := pg_temp.meta_efetiva((select id from ids where nome = 'granel'));
  insert into rc values (10, 'A Granél corrigida para 2 pessoas: 50.000', 'aceita',
    case when m = 50000 then 'ACEITOU' else format('RECUSOU: %s', m) end);
exception when others then insert into rc values (10, 'A Granél corrigida para 2 pessoas: 50.000', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- ─── O buraco consertado na 0022: salvar meta não apaga a base ──────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');

do $$ declare b text; begin
  perform public.save_machine_targets(
    jsonb_build_object(pg_temp.maquina('BANCADA EMBALAGEM A GRANÉL')::text, 26000),
    pg_temp.amanha() + 1);
  b := public.machine_target_basis_on(pg_temp.maquina('BANCADA EMBALAGEM A GRANÉL'), pg_temp.amanha() + 1);
  insert into rc values (11, 'gestor muda a meta da Granél e ela continua por pessoa', 'aceita',
    case when b = 'per_operator' then 'ACEITOU' else 'RECUSOU: virou ' || coalesce(b, 'nulo') end);
exception when others then insert into rc values (11, 'gestor muda a meta da Granél e ela continua por pessoa', 'aceita', 'RECUSOU: ' || sqlerrm); end $$;

-- A lista fechada continua fechada. Como dono do banco: pelo app a escrita
-- direta já é barrada pelo RLS, e aqui interessa ver o CHECK recusar.
reset role;
do $$ begin
  insert into public.machine_targets (machine_id, quantity_per_shift, valid_from, basis)
  values (pg_temp.maquina('EMBALADORA HORIZONTAL N°2'), 10000, pg_temp.amanha() + 2, 'por_palpite');
  insert into rc values (12, 'base fora da lista', 'recusa', 'ACEITOU');
exception when others then insert into rc values (12, 'base fora da lista', 'recusa', 'RECUSOU'); end $$;

select n, caso, esperado, resultado,
       case when (esperado = 'aceita') = (resultado = 'ACEITOU') then 'PASSOU' else '>>> FALHOU' end as veredito
  from rc order by n;
