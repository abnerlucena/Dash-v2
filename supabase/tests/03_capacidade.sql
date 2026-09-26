-- Testes dos campos da migration 0013 (processo, capacidade, turno, base da meta).
-- Decisões: D37, D39, D40, D41, D42. Ver README desta pasta.
--
-- Rode SEMPRE dentro de uma transação desfeita no fim:
--   begin;  \i supabase/migrations/20260925100000_capacity_process_and_target_basis.sql
--           \i supabase/tests/03_capacidade.sql
--   rollback;
-- Nada do que este arquivo escreve fica no banco.

create temp table r(n int, caso text, esperado text, resultado text);
do $$
begin
  update public.machines set status='planned' where id=1;
  insert into r values (1,'situacao planned','aceita','ACEITOU');
exception when others then insert into r values (1,'situacao planned','aceita','RECUSOU: '||sqlerrm); end $$;
do $$
begin
  update public.machines set process='injecao' where id=1;
  insert into r values (2,'processo invalido','recusa','ACEITOU');
exception when check_violation then insert into r values (2,'processo invalido','recusa','RECUSOU'); end $$;
do $$
begin
  update public.machines set process='packaging', pieces_per_minute=33.33, efficiency=0.70, started_on='2025-12-20' where id=1;
  insert into r values (3,'processo + capacidade + data','aceita','ACEITOU');
exception when others then insert into r values (3,'processo + capacidade + data','aceita','RECUSOU: '||sqlerrm); end $$;
do $$
begin
  update public.machines set efficiency=1.5 where id=1;
  insert into r values (4,'eficiencia maior que 1','recusa','ACEITOU');
exception when check_violation then insert into r values (4,'eficiencia maior que 1','recusa','RECUSOU'); end $$;
do $$
begin
  update public.shifts set gross_minutes=336, useful_minutes=400 where id=3;
  insert into r values (5,'tempo util maior que o bruto','recusa','ACEITOU');
exception when check_violation then insert into r values (5,'tempo util maior que o bruto','recusa','RECUSOU'); end $$;
do $$
begin
  update public.shifts set gross_minutes=558, useful_minutes=493 where id=1;
  update public.shifts set gross_minutes=546, useful_minutes=481 where id=2;
  update public.shifts set gross_minutes=336, useful_minutes=271 where id=3;
  insert into r values (6,'tempos reais dos 3 turnos','aceita','ACEITOU');
exception when others then insert into r values (6,'tempos reais dos 3 turnos','aceita','RECUSOU: '||sqlerrm); end $$;
do $$
begin
  insert into public.machine_targets (machine_id, quantity_per_shift, valid_from, basis)
  values (7, 25000, current_date+1, 'por_pessoa');
  insert into r values (7,'base invalida','recusa','ACEITOU');
exception when check_violation then insert into r values (7,'base invalida','recusa','RECUSOU'); end $$;
do $$
begin
  insert into public.machine_targets (machine_id, quantity_per_shift, valid_from, basis)
  values (7, 25000, current_date+1, 'per_operator');
  insert into r values (8,'degrau novo com per_operator','aceita','ACEITOU');
exception when others then insert into r values (8,'degrau novo com per_operator','aceita','RECUSOU: '||sqlerrm); end $$;
do $$
begin
  update public.machine_targets set basis='per_operator' where machine_id=7 and valid_from < current_date;
  insert into r values (9,'alterar meta ja vigente','recusa','ACEITOU');
exception when others then insert into r values (9,'alterar meta ja vigente','recusa','RECUSOU'); end $$;
select n, caso, esperado, resultado,
       case when (esperado='aceita') = (resultado='ACEITOU') then 'PASSOU' else '>>> FALHOU' end as veredito
  from r order by n;
