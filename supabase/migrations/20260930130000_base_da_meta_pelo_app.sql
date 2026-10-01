-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0027 — A base da meta pode ser definida pelo app
-- Decisões: D53 (nova), D47, D39, D13
--
-- O QUE FALTAVA: as três bases (meta do turno, rateada pela lotação, por
-- pessoa) existiam no banco desde a 0022, mas **só dava para mudá-las por SQL**.
-- Máquina nova sempre nascia `per_shift`, e trocar a base de uma existente
-- exigia alguém com acesso ao banco escrevendo um insert à mão.
--
-- A tela de Metas já edita o valor e já respeita a vigência ("vale a partir
-- de"). Falta uma coluna ao lado, com as três opções. Esta migration é o lado
-- do banco disso.
--
-- POR QUE NA `save_machine_targets` E NÃO NUMA FUNÇÃO NOVA: é a função que o
-- botão "Revisar e salvar" daquela tela já chama. Meta e base mudam juntas, na
-- mesma vigência, numa transação só — em vez de duas chamadas que podem ficar
-- pela metade.
--
-- O QUE NÃO MUDA:
--   • quem não mandar base nenhuma continua chamando do mesmo jeito, e a base
--     existente é PRESERVADA (o buraco que a 0022 tapou);
--   • a base nunca reescreve o passado: mudar a base cria um DEGRAU NOVO na
--     linha do tempo, com a data em que passa a valer (D13);
--   • continua exigindo a permissão de metas.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 0. Derrubar as assinaturas antigas ─────────────────────────────────────
-- ARMADILHA DO POSTGRESQL: acrescentar um parâmetro com valor padrão NÃO
-- substitui a função — cria uma SEGUNDA, com outra assinatura. As duas passam a
-- existir, e uma chamada com menos argumentos vira erro:
--
--   function public.save_machine_targets(jsonb, date) is not unique
--
-- Por isso a versão antiga é derrubada antes. Nada depende dela além do app,
-- que passa a chamar a nova.
drop function if exists public.save_machine_targets(jsonb, date);
drop function if exists public.create_machine(text, integer, boolean, smallint);


-- ─── 1. save_machine_targets aceita a base ──────────────────────────────────
create or replace function public.save_machine_targets(
  p_targets    jsonb,
  p_valid_from date default null,
  -- Máquina → base, no mesmo formato de `p_targets`. Máquina que não aparecer
  -- aqui mantém a base que já tinha.
  p_bases      jsonb default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from       date := coalesce(p_valid_from, (now() at time zone 'America/Sao_Paulo')::date);
  v_key        text;
  v_value      jsonb;
  v_qty        integer;
  v_base_atual text;
  v_base_nova  text;
  v_count      integer := 0;
begin
  if not public.has_permission('targets.manage') then
    raise exception 'Você não tem permissão para alterar metas.' using errcode = '42501';
  end if;
  if p_targets is null or jsonb_typeof(p_targets) <> 'object' then
    raise exception 'Metas inválidas.' using errcode = '22023';
  end if;
  if p_bases is not null and jsonb_typeof(p_bases) <> 'object' then
    raise exception 'Bases de meta inválidas.' using errcode = '22023';
  end if;

  for v_key, v_value in select * from jsonb_each(p_targets) loop
    v_qty := greatest(round((v_value #>> '{}')::numeric)::integer, 0);

    -- A base que a máquina usa nesta data, e a que foi pedida (se foi).
    v_base_atual := public.machine_target_basis_on(v_key::integer, v_from);
    v_base_nova  := coalesce(p_bases #>> array[v_key], v_base_atual, 'per_shift');

    if v_base_nova not in ('per_shift', 'per_shift_prorated', 'per_operator') then
      raise exception 'Base de meta desconhecida: "%". Use per_shift, per_shift_prorated ou per_operator.',
        v_base_nova using errcode = '22023';
    end if;

    -- Grava só o que MUDOU. Um degrau novo idêntico ao anterior seria ruído na
    -- linha do tempo e faria o histórico de metas parecer movimentado sem nada
    -- ter acontecido.
    if v_qty is distinct from public.machine_target_on(v_key::integer, v_from)
       or v_base_nova is distinct from v_base_atual
       or not exists (select 1 from public.machine_targets t where t.machine_id = v_key::integer) then
      insert into public.machine_targets (machine_id, quantity_per_shift, valid_from, basis, created_by)
      values (v_key::integer, v_qty, v_from, v_base_nova, auth.uid())
      on conflict (machine_id, valid_from)
      do update set quantity_per_shift = excluded.quantity_per_shift,
                    basis              = excluded.basis,
                    created_by         = excluded.created_by,
                    created_at         = now();
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

comment on function public.save_machine_targets(jsonb, date, jsonb) is
  'Grava metas e, opcionalmente, a base de cada uma. Só o que mudou vira degrau novo. '
  'Máquina sem base informada mantém a que tinha. Exige targets.manage. [D13, D47, D53]';


-- ─── 2. Máquina nova pode nascer com a base certa ───────────────────────────
-- Antes, toda máquina nascia `per_shift` e a base só mudava depois, por SQL.
-- Uma embaladora que trabalha por pessoa passava um tempo medindo errado.
create or replace function public.create_machine(
  p_name                    text,
  p_initial_target          integer  default 0,
  p_has_target              boolean  default true,
  p_standard_operator_count smallint default null,
  p_basis                   text     default 'per_shift'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id integer;
begin
  if not public.has_permission('machines.manage') then
    raise exception 'Você não tem permissão para cadastrar máquinas.' using errcode = '42501';
  end if;
  if nullif(trim(p_name), '') is null then
    raise exception 'O nome da máquina é obrigatório.' using errcode = '22023';
  end if;
  if coalesce(p_basis, 'per_shift') not in ('per_shift', 'per_shift_prorated', 'per_operator') then
    raise exception 'Base de meta desconhecida: "%". Use per_shift, per_shift_prorated ou per_operator.',
      p_basis using errcode = '22023';
  end if;

  begin
    insert into public.machines (name, has_target, standard_operator_count, created_by)
    values (trim(p_name), coalesce(p_has_target, true), p_standard_operator_count, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Já existe uma máquina com esse nome.' using errcode = '23505';
  end;

  insert into public.machine_targets (machine_id, quantity_per_shift, valid_from, basis, created_by)
  values (v_id, greatest(coalesce(p_initial_target, 0), 0),
          (now() at time zone 'America/Sao_Paulo')::date,
          coalesce(p_basis, 'per_shift'), auth.uid());

  return v_id;
end;
$$;

comment on function public.create_machine(text, integer, boolean, smallint, text) is
  'Cadastra a máquina e a primeira meta. A base é opcional e vale per_shift quando '
  'não informada. Exige machines.manage. [D01, D53]';


-- ─── 3. Quem pode executar ──────────────────────────────────────────────────
-- Função criada do zero nasce executável por QUALQUER UM, inclusive anônimo.
-- As duas checam permissão por dentro, então uma chamada anônima falharia — mas
-- deixar a porta destrancada porque há um cadeado atrás dela não é o padrão
-- deste banco. O resto das funções que gravam é restrito assim.
revoke all on function public.save_machine_targets(jsonb, date, jsonb) from public, anon;
revoke all on function public.create_machine(text, integer, boolean, smallint, text) from public, anon;
grant execute on function public.save_machine_targets(jsonb, date, jsonb) to authenticated;
grant execute on function public.create_machine(text, integer, boolean, smallint, text) to authenticated;
