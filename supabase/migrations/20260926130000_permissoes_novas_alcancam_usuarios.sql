-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0020 — Permissão nova precisa alcançar quem já foi aprovado
-- Decisões: D22 (permissões copiadas por usuário), D35
--
-- CORRIGE UM ENGANO DA 0016. Ela concedeu import.review e import.manage aos
-- papéis, o que parecia suficiente — mas `user_permissions` é uma TABELA, não
-- uma view: quando alguém é aprovado, as permissões do papel são COPIADAS para
-- ele. Quem já estava aprovado antes não recebeu nada.
--
-- Resultado do engano: os 5 usuários do banco ficaram com zero permissões de
-- importação, e ninguém conseguiria rodar a carga.
--
-- POR QUE A CÓPIA EXISTE, e não é para ser trocada por uma view: ela permite
-- dar (ou tirar) uma permissão de UMA pessoa sem mexer no papel dela. O preço
-- é este: toda permissão nova precisa ser distribuída a quem já existe.
--
-- Esta migration faz duas coisas: conserta o que falta agora, e deixa uma
-- função para não ser preciso lembrar disso na próxima vez.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. Distribuir a quem já está aprovado ──────────────────────────────────
-- Só ACRESCENTA. Permissões dadas individualmente a alguém não são tocadas, e
-- quem tem permissão a mais continua com ela.
create or replace function public.sincronizar_permissoes_dos_papeis()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quantas integer;
begin
  insert into public.user_permissions (user_id, permission_code)
  select p.id, rp.permission_code
    from public.profiles p
    join public.role_permissions rp on rp.role_id = p.role_id
   where p.role_id is not null
  on conflict do nothing;
  get diagnostics v_quantas = row_count;
  return v_quantas;
end;
$$;

comment on function public.sincronizar_permissoes_dos_papeis() is
  'Dá a quem já foi aprovado as permissões que o papel dele ganhou depois. '
  'Só acrescenta: permissões individuais não são tocadas. Rodar após acrescentar '
  'permissão a um papel. [D22]';

select public.sincronizar_permissoes_dos_papeis();


-- ─── 2. A carga pode ser feita pelo dono do banco ───────────────────────────
-- Um sistema recém-instalado não tem usuário nenhum — muito menos um
-- administrador. Exigir um administrador logado para importar o histórico
-- criaria um nó: seria preciso ter dados para criar o usuário que carrega os
-- dados.
--
-- Mesmo caminho que a bootstrap_admin já usa: a operação de instalação é
-- feita pelo dono do banco, pelo SQL Editor. Quem entra pelo app nunca é o
-- dono, então a exigência de permissão continua valendo para todo mundo.
create or replace function public.pode_importar()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.has_permission('import.manage')
    -- sem ninguém logado E rodando como dono: é a instalação pelo SQL Editor
    or (auth.uid() is null and current_user = 'postgres'),
    false)
$$;

comment on function public.pode_importar() is
  'Quem pode carregar e reverter lote: quem tem import.manage, ou o dono do '
  'banco numa instalação (quando ainda não existe usuário). [D35]';


-- ─── 3. As duas funções da carga passam a usar a regra acima ────────────────
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
  if not public.pode_importar() then
    raise exception 'Você não tem permissão para reverter lotes de importação.'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.import_batches where id = p_lote and status = 'loaded') then
    raise exception 'Lote não encontrado ou não está carregado.' using errcode = '22023';
  end if;

  delete from public.production_records where import_batch_id = p_lote;
  get diagnostics v_apontamentos = row_count;

  delete from public.machine_downtimes
   where id in (select downtime_id from public.import_rows
                 where batch_id = p_lote and downtime_id is not null);
  get diagnostics v_paradas = row_count;

  update public.import_rows
     set status = 'pending', production_record_id = null, downtime_id = null, error_message = null
   where batch_id = p_lote;

  update public.import_batches set status = 'reverted', reverted_at = now() where id = p_lote;

  return jsonb_build_object('apontamentos_apagados', v_apontamentos, 'paradas_apagadas', v_paradas);
end;
$$;

revoke all on function public.sincronizar_permissoes_dos_papeis() from public, authenticated, anon;
revoke all on function public.pode_importar() from public, anon;
grant execute on function public.pode_importar() to authenticated;
