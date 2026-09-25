-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0015 — As metas reais de Itajaí
-- Decisões: D38 (os valores), D39 (base por turno ou por pessoa), D13 (degraus)
-- Documentação: docs/database/cadernos/07-mapa-da-fabrica.pdf
--
-- PARTE 3 de 3 da adequação ao desenho real da fábrica.
--   parte 1 (0013)  → campos novos.                                     ✔
--   parte 2 (0014)  → os 22 centros de trabalho.                        ✔
--   parte 3 (esta)  → as metas reais.
--
-- Substitui os valores de RESERVA (150 a 600) que vieram do código do app e
-- nunca foram reais. Confirmados com o gestor em 25/09/2026.
--
-- COMO A SUBSTITUIÇÃO ACONTECE: a meta nunca é sobrescrita. Cada valor novo é
-- um DEGRAU NOVO na linha do tempo, com a data em que passa a valer (hoje).
-- Os valores antigos continuam guardados — é isso que impede o passado de ser
-- reescrito e faz um mês fechado continuar batendo. [D13]
--
-- Por isso esta migration só INSERE. Nenhuma linha de meta é alterada ou
-- apagada, e nenhum apontamento é tocado.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. Os 12 centros cobrados por meta (D38) ───────────────────────────────
-- Onze têm meta fixa por turno. A Bancada Embalagem A Granél é medida por
-- pessoa: 25.000 × número de operadores do apontamento (D39).
--
-- Conferência contra o teto da planilha de capacidade: todas ficam entre 62% e
-- 86% da capacidade técnica. São metas apertadas, mas fisicamente possíveis.
--
-- A guarda "not exists" é o que torna isto repetível: o degrau novo só nasce
-- se a meta vigente hoje for DIFERENTE da desejada. Rodar de novo amanhã, com
-- tudo já certo, não cria degrau nenhum.
insert into public.machine_targets (machine_id, quantity_per_shift, valid_from, basis)
select m.id, v.quantidade, (now() at time zone 'America/Sao_Paulo')::date, v.base
  from (values
    ('EMBALADORA HORIZONTAL N°1',              10000, 'per_shift'   ),
    ('EMBALADORA HORIZONTAL N°2',              10000, 'per_shift'   ),
    ('EMBALADORA 4X2 SUPORTES/PLACAS N°1',      7500, 'per_shift'   ),
    ('EMBALADORA 4X2 SUPORTES/PLACAS N°2',      7500, 'per_shift'   ),
    ('EMBALADORA VERTICAL MÓDULOS N°1',        13000, 'per_shift'   ),
    ('EMBALADORA VERTICAL MÓDULOS N°2',        13000, 'per_shift'   ),
    ('EMBALADORA VERTICAL CONJUNTOS N°1',       5000, 'per_shift'   ),
    ('EMBALADORA VERTICAL CONJUNTOS N°2',       5000, 'per_shift'   ),
    ('BANCADA EMBALAGEM A GRANÉL',             25000, 'per_operator'),
    ('MÁQUINA DE TOMADAS COMPOSÉ - AUMAQ',     12500, 'per_shift'   ),
    ('MÁQUINA DE PLUGUE SLIN - AUMAQ',          6500, 'per_shift'   ),
    ('MÁQUINA DE INTERRUPTORES COMPOSÉ N°1',    4500, 'per_shift'   )
  ) as v(nome, quantidade, base)
  join public.machines m on lower(m.name) = lower(v.nome)
 where not exists (
   select 1 from public.current_machine_targets c
    where c.machine_id = m.id
      and c.quantity_per_shift = v.quantidade
      and c.basis = v.base
 )
on conflict (machine_id, valid_from) do update
   set quantity_per_shift = excluded.quantity_per_shift,
       basis              = excluded.basis;


-- ─── 2. Os 10 centros por demanda ficam com meta zero ───────────────────────
-- Eles já estão marcados com "tem meta = não" pela parte 2, e é essa marca que
-- manda no cálculo. O zero aqui existe para a linha do tempo não continuar
-- mostrando 150 ou 220 — valores de reserva que nunca foram reais e que
-- confundiriam quem abrisse o histórico de metas.
--
-- Ler como "a partir de hoje, este centro não é cobrado por meta".
insert into public.machine_targets (machine_id, quantity_per_shift, valid_from, basis)
select m.id, 0, (now() at time zone 'America/Sao_Paulo')::date, 'per_shift'
  from public.machines m
 where m.status = 'active'
   and m.has_target = false
   and not exists (
     select 1 from public.current_machine_targets c
      where c.machine_id = m.id and c.quantity_per_shift = 0
   )
on conflict (machine_id, valid_from) do update
   set quantity_per_shift = 0;


-- ═══════════════════════════════════════════════════════════════════════════
-- Estado esperado depois desta migration:
--   • 12 centros com a meta real vigente, sendo A Granél por pessoa;
--   • 10 centros por demanda com meta 0 e "tem meta = não";
--   • os degraus antigos (150 a 600) continuam na tabela, como histórico;
--   • nenhum apontamento alterado: cada um guarda a meta que valia no seu dia.
--
-- O QUE AINDA NÃO ESTÁ AQUI: os degraus do PASSADO. A planilha de produção
-- mostra que as metas eram menores antes (horizontais 8.000, placas 7.000,
-- a granel 15.000). Esses degraus entram junto com a importação do histórico,
-- na D35 — sem eles, os meses antigos seriam medidos com a meta de hoje.
-- ═══════════════════════════════════════════════════════════════════════════
