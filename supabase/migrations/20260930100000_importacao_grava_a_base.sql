-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0024 — A importação grava a base da meta
-- Decisões: D46, D47, D35
--
-- O QUE ESTAVA ERRADO: a carga da planilha criava o apontamento com a meta
-- daquele dia, mas sem dizer COMO ler essa meta. A coluna `target_basis` tem
-- valor padrão 'per_shift', então toda linha importada nascia "meta do turno".
--
-- Para o histórico já carregado isso está certo e não se mexe (D46): aqueles
-- apontamentos são anteriores à regra das três bases. O problema é a PRÓXIMA
-- importação — um turno de A Granél entraria como meta fixa em vez de por
-- pessoa, e o atingimento dela sairia errado sem ninguém perceber.
--
-- A CORREÇÃO: a carga pergunta a base vigente na data do apontamento, com a
-- `machine_target_basis_on`, do mesmo jeito que a meta já vem da linha do
-- tempo. Cada apontamento importado passa a guardar a foto da base do seu dia.
--
-- Só a função muda. Nenhuma tabela, coluna ou dado é tocado.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.carregar_lote_importacao(p_lote uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_apontamentos int := 0;
  v_ordens       int := 0;
  v_paradas      int := 0;
  v_notas        int := 0;
  v_descartes    int := 0;
begin
  if not public.pode_importar() then
    raise exception 'Você não tem permissão para carregar lotes de importação.'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.import_batches where id = p_lote and status = 'draft') then
    raise exception 'Lote não encontrado ou já carregado.' using errcode = '22023';
  end if;

  with grupos as (
    select machine_id, production_date, shift_id, work_mode,
           max(target_quantity) as meta,
           string_agg(source_sheet || '!' || source_cell, ' + ' order by source_cell) as origem
      from public.import_rows
     where batch_id = p_lote and kind in ('production', 'rework') and status = 'pending'
     group by machine_id, production_date, shift_id, work_mode
  ),
  criados as (
    insert into public.production_records
      (production_date, shift_id, machine_id, target_quantity, target_basis, work_mode,
       import_batch_id, source_ref, created_by)
    select g.production_date, g.shift_id, g.machine_id, coalesce(g.meta, 0),
           -- A base que valia NAQUELE dia, não a de hoje. Sem base conhecida
           -- (centro sem meta nenhuma na linha do tempo), vale a do turno.
           coalesce(public.machine_target_basis_on(g.machine_id, g.production_date), 'per_shift'),
           g.work_mode, p_lote, g.origem, null
      from grupos g
    returning id, machine_id, production_date, shift_id, work_mode
  )
  update public.import_rows r
     set production_record_id = c.id, status = 'loaded'
    from criados c
   where r.batch_id = p_lote
     and r.kind in ('production', 'rework')
     and r.status = 'pending'
     and r.machine_id = c.machine_id
     and r.production_date = c.production_date
     and r.shift_id = c.shift_id
     and r.work_mode = c.work_mode;

  select count(*) into v_apontamentos
    from public.production_records where import_batch_id = p_lote;

  insert into public.production_orders (production_record_id, order_number, quantity, is_rework, notes)
  select r.production_record_id, 'IMPORTADO', r.quantity, (r.kind = 'rework'), r.notes
    from public.import_rows r
   where r.batch_id = p_lote and r.kind in ('production', 'rework')
     and r.production_record_id is not null and r.quantity > 0;
  get diagnostics v_ordens = row_count;

  with paradas as (
    insert into public.machine_downtimes
      (machine_id, reason, started_at, ended_at, source, external_id, notes)
    select r.machine_id,
           r.notes,
           (r.production_date + coalesce(s.start_time, time '00:00'))
             at time zone 'America/Sao_Paulo',
           null,
           'spreadsheet',
           r.source_sheet || '!' || r.source_cell,
           'importado de ' || r.source_sheet || '!' || r.source_cell
             || ', onde a planilha escreveu: ' || coalesce(r.raw_value, '(vazio)')
             || '. A planilha não informa a duração.'
      from public.import_rows r
      left join public.shifts s on s.id = r.shift_id
     where r.batch_id = p_lote and r.kind = 'downtime' and r.status = 'pending'
    returning id, external_id
  )
  update public.import_rows r
     set downtime_id = p.id, status = 'loaded'
    from paradas p
   where r.batch_id = p_lote and r.source_sheet || '!' || r.source_cell = p.external_id;
  get diagnostics v_paradas = row_count;

  update public.production_records pr
     set notes = left(trim(both ' ' from coalesce(pr.notes, '') || ' ' || r.notes), 500)
    from public.import_rows r
   where r.batch_id = p_lote and r.kind = 'note' and r.status = 'pending'
     and pr.machine_id = r.machine_id
     and pr.production_date = r.production_date
     and pr.shift_id = r.shift_id
     and pr.import_batch_id = p_lote;
  get diagnostics v_notas = row_count;

  update public.import_rows
     set status = case when v_notas > 0 then 'loaded' else 'skipped' end,
         error_message = case when v_notas > 0 then null
                         else 'não havia apontamento neste dia e turno para pendurar a observação' end
   where batch_id = p_lote and kind = 'note' and status = 'pending';

  update public.import_rows set status = 'skipped'
   where batch_id = p_lote and kind = 'discard' and status = 'pending';
  get diagnostics v_descartes = row_count;

  update public.import_batches set status = 'loaded', loaded_at = now() where id = p_lote;

  return jsonb_build_object(
    'apontamentos', v_apontamentos, 'ordens', v_ordens, 'paradas', v_paradas,
    'observacoes', v_notas, 'descartados', v_descartes);
end;
$$;
