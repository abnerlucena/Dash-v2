-- Fixtures comuns: usuários FICTÍCIOS (example.com), criados dentro da transação do teste.
-- usuários de teste (só dentro da transação)
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','gestor@example.com','{"full_name":"Gestora","badge_number":"100"}'),
 ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','op1@example.com','{"full_name":"Operador Um","badge_number":"201"}'),
 ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','op2@example.com','{"full_name":"Operador Dois","badge_number":"202"}'),
 ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin@example.com','{"full_name":"Admin","account_type":"shared"}'),
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pend@example.com','{"full_name":"Pendente","badge_number":"300"}');
select public.bootstrap_admin('gestor@example.com');
create temp table results (n serial, test text, ok boolean, info text);
grant all on results to authenticated, anon;
grant all on results_n_seq to authenticated, anon;
create function pg_temp.as_user(p uuid, p_session text default '11111111-1111-1111-1111-111111111111') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated', 'session_id', p_session)::text, true);
$$;
-- conta de TV (display) e um cadastro novo DEPOIS da gestora ativa
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','tv@example.com','{"full_name":"TV Fábrica","account_type":"display"}'),
 ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','novo@example.com','{"full_name":"Novo Colaborador","badge_number":"400"}');
