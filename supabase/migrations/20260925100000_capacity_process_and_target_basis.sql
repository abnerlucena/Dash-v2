-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0013 — Processo, capacidade, turno planejado e base da meta
-- Decisões: D37, D39, D40, D41, D42
-- Documentação: docs/database/02-referencia-tecnica.md, seções 3.1, 3.2 e 3.6
--               docs/database/cadernos/07-mapa-da-fabrica.pdf
--
-- PARTE 1 de 3 da adequação ao desenho real da fábrica de Itajaí.
--   parte 1 (esta)  → campos novos. NÃO mexe em nenhum dado existente.
--   parte 2         → os 22 centros de trabalho (renomear, criar, D43).
--   parte 3         → as metas reais (D38).
--
-- Tudo aqui é aditivo: "add column if not exists" e "create or replace".
-- A única exceção é a restrição de situação da máquina, que é trocada para
-- ACEITAR um valor a mais ('planned'). É uma troca que só amplia: nenhuma
-- linha existente pode deixar de passar por ela.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. machines: a que processo o centro pertence (D37) ────────────────────
-- A fábrica é organizada em dois processos, e o nome do centro não basta para
-- saber qual: a "EMBALADORA KIT PARAFUSOS" pertence à MONTAGEM.
--
-- Fica aceitando nulo por enquanto porque as 18 máquinas já cadastradas ainda
-- não têm processo definido — quem preenche é a parte 2. Depois dela, o campo
-- pode virar obrigatório numa migration própria.
alter table public.machines
  add column if not exists process text
  check (process in ('assembly', 'packaging'));

comment on column public.machines.process is
  'Processo do centro de trabalho: assembly (montagem) ou packaging (embalagem). [D37]';


-- ─── 2. machines: capacidade, só como alarme (D40) ──────────────────────────
-- Estes dois campos NÃO calculam a meta. Eles existem para o sistema avisar
-- quando alguém digita uma meta fisicamente impossível:
--
--     capacidade técnica do turno = pieces_per_minute × minutos úteis do turno
--
-- Por que não derivar a meta daqui: as metas acordadas em 25/09/2026 ficam
-- entre 62% e 86% da capacidade técnica, sem fator único. A meta é negociada
-- pelo gestor, não calculada pelo banco. Ver D40.
alter table public.machines
  add column if not exists pieces_per_minute numeric(10, 3)
  check (pieces_per_minute > 0);

alter table public.machines
  add column if not exists efficiency numeric(4, 3)
  check (efficiency > 0 and efficiency <= 1);

comment on column public.machines.pieces_per_minute is
  'Peças por minuto do centro, da planilha de capacidade. Usado só como alarme de meta impossível. [D40]';
comment on column public.machines.efficiency is
  'Eficiência esperada do centro (0 a 1; a fábrica usa 0,60 a 0,90). Não entra no cálculo da meta. [D40]';


-- ─── 3. machines: máquina planejada e data de entrada (D41) ─────────────────
-- Sete centros já estão previstos mas não produzem nada hoje. Cadastrar sem
-- marcar isso faria o indicador contar dezenas de turnos zerados de um
-- equipamento que nem chegou.
--
-- started_on também resolve o problema dos zeros antigos levantado na D35:
-- turno anterior a esta data não é cobrado da máquina.
alter table public.machines
  add column if not exists started_on date;

comment on column public.machines.started_on is
  'Data de entrada em operação. Turnos anteriores a ela não são cobrados da máquina. [D41, D35]';

-- A restrição de situação passa a aceitar 'planned'. Só amplia o que é aceito:
-- 'active', 'inactive', 'maintenance' e 'preventive_maintenance' continuam
-- valendo, então nenhuma linha existente é afetada.
alter table public.machines
  drop constraint if exists machines_status_check;

alter table public.machines
  add constraint machines_status_check
  check (status in ('active', 'inactive', 'maintenance',
                    'preventive_maintenance', 'planned'));

comment on column public.machines.status is
  'Situação: active, inactive, maintenance, preventive_maintenance ou planned '
  '(prevista, ainda não existe na fábrica). [D05, D41]';


-- ─── 4. shifts: o tempo que realmente produz (D42) ──────────────────────────
-- start_time e end_time continuam sendo só informativos. Quem manda no cálculo
-- é useful_minutes.
--
-- Os dois NÃO precisam fechar por subtração, e isso é de propósito: no T1 o
-- horário começa 04:55 mas a produção começa 05:00 — os 5 minutos são entrada
-- e preparação. O gross_minutes guarda o que a planilha de capacidade usa.
--
-- Valores a carregar na parte 2 (da planilha de 09/09/2026):
--   T1  bruto 558  útil 493      T2  bruto 546  útil 481
--   T3  bruto 336  útil 271      (descontos iguais nos três: 65 min)
--
-- Hoje o T3 só existe como hora extra, que já fica fora do cálculo de meta.
-- Guardamos o tempo agora para que, quando ele virar turno normal, ajustar a
-- meta seja uma conta e não uma migration de emergência (271 min é 55% dos
-- 493 do T1 — com a mesma meta, o T3 nasceria reprovado).
alter table public.shifts
  add column if not exists gross_minutes smallint
  check (gross_minutes > 0);

alter table public.shifts
  add column if not exists useful_minutes smallint
  check (useful_minutes > 0);

comment on column public.shifts.gross_minutes is
  'Duração bruta do turno em minutos, conforme a planilha de capacidade. Informativo. [D42]';
comment on column public.shifts.useful_minutes is
  'Minutos que realmente produzem (bruto menos refeição, ginástica, intervalo e troca). '
  'É este número que entra no cálculo de capacidade. [D42]';

-- O tempo útil nunca pode passar do bruto. A restrição fica na tabela (e não
-- em cada coluna) porque depende das duas ao mesmo tempo. Linhas com os campos
-- ainda vazios passam sem problema: em SQL, comparação com nulo não é falsa,
-- é "não sei", e o check só reprova o que é comprovadamente falso.
alter table public.shifts
  drop constraint if exists shifts_useful_within_gross;

alter table public.shifts
  add constraint shifts_useful_within_gross
  check (useful_minutes <= gross_minutes);


-- ─── 5. machine_targets: meta por turno ou por pessoa (D39) ─────────────────
-- Onze centros têm meta fixa por turno. A Bancada Embalagem A Granel é medida
-- em 25.000 peças POR PESSOA no turno — três pessoas apontadas significam meta
-- de 75.000.
--
-- O default 'per_shift' faz as metas que já existem continuarem se comportando
-- exatamente como antes, sem precisar tocar em nenhuma linha.
alter table public.machine_targets
  add column if not exists basis text not null default 'per_shift'
  check (basis in ('per_shift', 'per_operator'));

comment on column public.machine_targets.basis is
  'Como ler quantity_per_shift: per_shift (meta do turno inteiro) ou '
  'per_operator (meta por pessoa, multiplicada pela lotação do apontamento). [D39]';


-- ─── 6. A view da meta vigente passa a mostrar a base ───────────────────────
-- Sem isso, quem lê a view não tem como saber se 25.000 é a meta do turno ou
-- de cada pessoa. A coluna nova entra no fim para não trocar a ordem das que
-- já existem (o "create or replace view" do PostgreSQL exige isso).
create or replace view public.current_machine_targets
with (security_invoker = true)
as
select distinct on (t.machine_id)
  t.machine_id,
  t.id          as target_id,
  t.quantity_per_shift,
  t.valid_from,
  t.created_by,
  t.created_at,
  t.basis
from public.machine_targets t
where t.valid_from <= (now() at time zone 'America/Sao_Paulo')::date
order by t.machine_id, t.valid_from desc;

comment on view public.current_machine_targets is
  'Meta vigente hoje (America/Sao_Paulo) por máquina: maior valid_from <= hoje. [D13, D39]';


-- ═══════════════════════════════════════════════════════════════════════════
-- O que esta migration NÃO faz, de propósito:
--   • não preenche processo, capacidade nem data de entrada (parte 2);
--   • não carrega os minutos dos turnos (parte 2);
--   • não cria, renomeia nem inativa nenhuma máquina (parte 2);
--   • não mexe em nenhuma meta (parte 3);
--   • não implementa o alarme de meta impossível nem a meta por operador no
--     cálculo — os campos existem, quem os usa vem depois;
--   • não torna a meta proporcional ao tempo útil do turno: isso só quando o
--     T3 virar turno normal (D42).
-- ═══════════════════════════════════════════════════════════════════════════
