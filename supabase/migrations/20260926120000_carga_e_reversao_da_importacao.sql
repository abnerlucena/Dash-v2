-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0019 — Carga e reversão do lote de importação
-- Decisões: D35 (itens 6, 7 e 12), D09 (ordens em tabela própria), D08 (meta
--           é uma foto no apontamento)
--
-- PASSO 3 de 4 da importação. Duas funções:
--   carregar_lote_importacao(lote)  → área de preparo vira produção
--   reverter_lote_importacao(lote)  → desfaz, sem tocar no que foi apontado
--                                      à mão
--
-- POR QUE FUNÇÃO E NÃO UM SCRIPT SOLTO: a carga precisa rodar com mais poder
-- do que qualquer pessoa tem (escrever em produção em nome de ninguém), e
-- precisa ser tudo ou nada. Dentro do banco, ou as duas coisas acontecem ou
-- nenhuma acontece. Um script por fora poderia parar no meio.
--
-- O apontamento importado fica com AUTOR VAZIO, de propósito: ninguém o
-- apontou. Pela regra corrigida na 0.10.3, apontamento sem autor só pode ser
-- alterado por quem tem permissão de editar qualquer apontamento — que é
-- exatamente o desejado para dado histórico.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 0. A parada pode vir da planilha ───────────────────────────────
-- A origem da parada aceitava só 'manual' (alguém registrou) e 'sfm' (veio do
-- sistema de chão de fábrica). A importação é uma terceira origem, e precisa
-- ser distinguível das outras duas para a reversão saber o que apagar.
-- Troca que só amplia: os dois valores anteriores continuam válidos.
alter table public.machine_downtimes
  drop constraint if exists machine_downtimes_source_check;
alter table public.machine_downtimes
  add constraint machine_downtimes_source_check
  check (source in ('manual', 'sfm', 'spreadsheet'));

comment on column public.machine_downtimes.source is
  'Origem da parada: manual, sfm ou spreadsheet (importada da planilha). [D05, D35]';


-- ─── 1. Carregar ────────────────────────────────────────────────────────────
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
  if not public.has_permission('import.manage') then
    raise exception 'Você não tem permissão para carregar lotes de importação.'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.import_batches where id = p_lote and status = 'draft') then
    raise exception 'Lote não encontrado ou já carregado.' using errcode = '22023';
  end if;

  -- ── Apontamentos: UM por máquina + dia + turno + tipo de trabalho ────────
  -- Várias linhas da preparo podem cair no mesmo apontamento — é o caso do
  -- dia 02/09 na Horizontal N°1, que tem produção normal e retrabalho. Elas
  -- viram duas ORDENS do mesmo apontamento (D09), não dois apontamentos.
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
      (production_date, shift_id, machine_id, target_quantity, work_mode,
       import_batch_id, source_ref, created_by)
    select g.production_date, g.shift_id, g.machine_id, coalesce(g.meta, 0), g.work_mode,
           p_lote, g.origem, null
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

  -- ── Ordens: uma por linha da preparo ─────────────────────────────────────
  -- A planilha nunca registrou número de OP, e não vai registrar até o sistema
  -- entrar em produção (D35 item 12). A ordem entra com a marcação IMPORTADO —
  -- não é uma OP de verdade e não deve ser confundida com uma.
  insert into public.production_orders (production_record_id, order_number, quantity, is_rework, notes)
  select r.production_record_id, 'IMPORTADO', r.quantity, (r.kind = 'rework'), r.notes
    from public.import_rows r
   where r.batch_id = p_lote and r.kind in ('production', 'rework')
     and r.production_record_id is not null and r.quantity > 0;
  get diagnostics v_ordens = row_count;

  -- ── Paradas de máquina ───────────────────────────────────────────────────
  -- As quatro células em que a planilha escreveu "Preventiva" ou "Manutenção"
  -- no lugar do número. A hora vem do início do turno; a planilha não registra
  -- quando a parada começou nem quanto durou, então o fim fica vazio.
  with paradas as (
    insert into public.machine_downtimes
      (machine_id, reason, started_at, ended_at, source, external_id, notes)
    select r.machine_id,
           r.notes,   -- já é o código da tabela: maintenance | preventive_maintenance
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

  -- ── Observações sem quantidade ───────────────────────────────────────────
  -- Vira a observação do apontamento daquele dia, quando existe um. Se não
  -- existe apontamento para pendurar, a linha fica como pulada — o texto
  -- continua guardado na área de preparo, nada se perde.
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

  -- ── Descartes: ficam registrados como pulados, com o motivo já gravado ───
  update public.import_rows set status = 'skipped'
   where batch_id = p_lote and kind = 'discard' and status = 'pending';
  get diagnostics v_descartes = row_count;

  update public.import_batches
     set status = 'loaded', loaded_at = now()
   where id = p_lote;

  return jsonb_build_object(
    'apontamentos', v_apontamentos,
    'ordens',       v_ordens,
    'paradas',      v_paradas,
    'observacoes',  v_notas,
    'descartados',  v_descartes
  );
end;
$$;

comment on function public.carregar_lote_importacao(uuid) is
  'Transforma a área de preparo em produção. Tudo ou nada. Exige import.manage. [D35]';


-- ─── 2. Reverter ────────────────────────────────────────────────────────────
-- Apaga só o que ESTE lote criou. O que a equipe apontou à mão tem
-- import_batch_id vazio e não é tocado — é para isso que a marca existe.
create or replace function public.reverter_lote_importacao(p_lote uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_apontamentos int := 0;
  v_paradas      int := 0;
begin
  if not public.has_permission('import.manage') then
    raise exception 'Você não tem permissão para reverter lotes de importação.'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.import_batches where id = p_lote and status = 'loaded') then
    raise exception 'Lote não encontrado ou não está carregado.' using errcode = '22023';
  end if;

  -- As ordens somem junto com o apontamento (a chave estrangeira é em cascata).
  delete from public.production_records where import_batch_id = p_lote;
  get diagnostics v_apontamentos = row_count;

  delete from public.machine_downtimes
   where id in (select downtime_id from public.import_rows
                 where batch_id = p_lote and downtime_id is not null);
  get diagnostics v_paradas = row_count;

  -- A área de preparo volta ao estado de antes: pode ser conferida de novo e
  -- carregada de novo, sem precisar extrair a planilha outra vez.
  update public.import_rows
     set status = 'pending', production_record_id = null, downtime_id = null, error_message = null
   where batch_id = p_lote;

  update public.import_batches
     set status = 'reverted', reverted_at = now()
   where id = p_lote;

  return jsonb_build_object('apontamentos_apagados', v_apontamentos, 'paradas_apagadas', v_paradas);
end;
$$;

comment on function public.reverter_lote_importacao(uuid) is
  'Desfaz um lote carregado. Não toca em apontamento feito por pessoa. Exige import.manage. [D35]';


revoke all on function public.carregar_lote_importacao(uuid) from public;
revoke all on function public.reverter_lote_importacao(uuid) from public;
grant execute on function public.carregar_lote_importacao(uuid) to authenticated;
grant execute on function public.reverter_lote_importacao(uuid) to authenticated;
