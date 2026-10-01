-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0026 — Dá para apagar o nº de operadores
-- Decisões: D52 (nova), D48, D12
--
-- O QUE ESTAVA ERRADO: `save_production_record` gravava o nº de operadores com
-- `coalesce(p_operator_count, operator_count)`. Quem digitasse 3 por engano e
-- depois limpasse o campo não conseguia desfazer: a tela mandava "nada", e
-- "nada" queria dizer "mantenha o que está lá".
--
-- O NÓ: um valor só — nulo — precisava dizer duas coisas diferentes, "não
-- mexi nisso" e "quero vazio". A saída usa o que a D48 já decidiu: **zero é
-- "não informado"**. Então:
--
--   não veio no pedido (nulo) → mantém o que estava
--   veio zero                 → apaga (grava nulo)
--   veio um número            → grava
--
-- Grava NULO e não zero porque nulo é o que o resto do banco entende como
-- ausência: a view já usa `nullif(operator_count, 0)`, e deixar os dois
-- significando a mesma coisa em lugares diferentes é pedir confusão.
--
-- Só a função muda. Nenhum dado é tocado.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.save_production_record(
  p_production_date date,
  p_shift_id        smallint,
  p_machine_id      integer,
  p_orders          jsonb    default null,
  p_notes           text     default null,
  p_operator_count  smallint default null,
  p_work_mode       text     default 'regular',
  p_replace_orders  boolean  default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mode text := coalesce(p_work_mode, 'regular');
  v_rec  public.production_records;
  v_id   uuid;
begin
  select * into v_rec
    from public.production_records
   where machine_id = p_machine_id
     and production_date = p_production_date
     and shift_id = p_shift_id
     and work_mode = v_mode
   for update;  -- trava a linha: dois salvamentos simultâneos não se atropelam

  if not found then
    if not public.has_permission('production.create') then
      raise exception 'Você não tem permissão para apontar produção.' using errcode = '42501';
    end if;

    insert into public.production_records
      (production_date, shift_id, machine_id, target_quantity, target_basis,
       operator_count, work_mode, notes, created_by)
    values (
      p_production_date,
      p_shift_id,
      p_machine_id,
      coalesce(public.machine_target_on(p_machine_id, p_production_date), 0),
      -- A base vem da mesma meta de onde veio o número, no mesmo dia.
      public.machine_target_basis_on(p_machine_id, p_production_date),
      -- Zero é "não informado" (D48), e vira nulo em vez de virar zero na
      -- tabela: nulo é o que o resto do banco entende como ausência.
      case when p_operator_count = 0 then null
           else coalesce(p_operator_count,
                  (select m.standard_operator_count from public.machines m where m.id = p_machine_id))
      end,
      v_mode,
      nullif(trim(p_notes), ''),
      auth.uid()
    )
    returning id into v_id;
  else
    if not public.can_edit_production_record(v_rec.created_by, v_rec.created_at) then
      raise exception 'Já existe apontamento desta máquina neste dia e turno, e você não tem permissão para alterá-lo.'
        using errcode = '42501';
    end if;
    v_id := v_rec.id;

    update public.production_records
       set notes          = case when p_notes is null then notes else nullif(trim(p_notes), '') end,
           -- Três casos distintos, e é isto que permite APAGAR (D52):
           --   nulo  → não veio no pedido: mantém o que estava
           --   zero  → veio vazio da tela: apaga
           --   outro → grava
           operator_count = case when p_operator_count is null then operator_count
                                 when p_operator_count = 0 then null
                                 else p_operator_count end,
           updated_by     = auth.uid()
     where id = v_id;

    if p_replace_orders and p_orders is not null then
      delete from public.production_orders where production_record_id = v_id;
    end if;
  end if;

  perform public.insert_production_orders(v_id, p_orders);
  return v_id;
end;
$$;
