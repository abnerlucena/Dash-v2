-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0014 — Os 22 centros de trabalho reais de Itajaí
-- Decisões: D37, D38 (só a marca "tem meta"), D40, D41, D43
-- Documentação: docs/database/cadernos/07-mapa-da-fabrica.pdf
--
-- PARTE 2 de 3 da adequação ao desenho real da fábrica.
--   parte 1 (0013)  → campos novos.                                     ✔
--   parte 2 (esta)  → os centros: renomear, classificar, criar, D43.
--   parte 3         → as metas reais (D38).
--
-- ATENÇÃO — esta migration é uma TRANSFORMAÇÃO ÚNICA, não uma criação.
-- Ela existe para o projeto que já tem as 18 máquinas com os nomes do legado.
-- Num projeto NOVO, quem cria os 29 centros já com o nome certo é o seed
-- estrutural (supabase/seed/01_estrutural.sql) — por isso tudo aqui está
-- dentro de um "se os nomes do legado existirem". Num banco novo, ou num que
-- já foi transformado, este arquivo não faz absolutamente nada.
--
-- O que ela NÃO faz: não apaga máquina nenhuma, não mexe em apontamento
-- nenhum e não toca em meta nenhuma (isso é a parte 3).
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. Os turnos ganham horário e tempo útil (D42) ─────────────────────────
-- Confirmado com o gestor em 25/09/2026. O T1 começa 04:55, mas a planilha de
-- capacidade calcula com 558 minutos (= 05:00 às 14:18): os 5 minutos de
-- diferença são entrada e preparação, não produção. Por isso horário e tempo
-- útil não fecham por subtração, e está certo assim.
update public.shifts set start_time = '04:55', end_time = '14:18',
                         gross_minutes = 558, useful_minutes = 493 where id = 1;
update public.shifts set start_time = '14:18', end_time = '23:24',
                         gross_minutes = 546, useful_minutes = 481 where id = 2;
update public.shifts set start_time = '23:24', end_time = '05:00',
                         gross_minutes = 336, useful_minutes = 271 where id = 3;


do $transformacao$
begin
  -- A guarda: só transforma se os nomes do legado ainda estiverem aí.
  if not exists (select 1 from public.machines where name = 'HORIZONTAL 1') then
    raise notice 'Migration 0014: nada a fazer (banco novo ou já transformado).';
    return;
  end if;

  -- ─── 2. Renomear e classificar os 17 centros que continuam ────────────────
  -- O id é preservado em todos: renomear mantém o histórico de apontamentos
  -- colado no centro certo. Dois deles seguem a D43:
  --   id 11  MONTAGEM DIVERSOS       → BANCADA N°4 - DIVERSOS
  --   id 15  MONTAGEM TOMADAS MANUAL → BANCADA N°3 - DIVERSOS
  --
  -- Peças por minuto e eficiência vêm da planilha de capacidade (D40); a
  -- lotação é a do 1º turno. "tem meta" segue a D38: dos 17, oito são
  -- cobrados por meta e nove são por demanda.
  update public.machines m
     set name                    = v.nome,
         process                 = v.processo,
         pieces_per_minute       = v.ppm,
         efficiency              = v.efic,
         standard_operator_count = v.lotacao,
         has_target              = v.tem_meta
    from (values
      ( 1, 'EMBALADORA HORIZONTAL N°1',              'packaging', 33.330, 0.70, 4, true ),
      ( 2, 'EMBALADORA HORIZONTAL N°2',              'packaging', 33.330, 0.70, 4, true ),
      ( 3, 'EMBALADORA 4X2 SUPORTES/PLACAS N°1',     'packaging', 21.739, 0.70, 2, true ),
      ( 4, 'EMBALADORA 4X2 SUPORTES/PLACAS N°2',     'packaging', 21.739, 0.70, 2, true ),
      ( 5, 'EMBALADORA VERTICAL MÓDULOS N°1',        'packaging', 32.258, 0.80, 2, true ),
      ( 6, 'EMBALADORA VERTICAL MÓDULOS N°2',        'packaging', 32.258, 0.80, 1, true ),
      ( 7, 'BANCADA EMBALAGEM A GRANÉL',             'packaging', 65.000, 0.70, 1, true ),
      ( 8, 'MÁQUINA DE INTERRUPTORES COMPOSÉ N°1',   'assembly',  12.048, 0.90, 1, true ),
      ( 9, 'BANCADA N°1 - TESTE INTERRUPTORES',      'assembly',  13.000, 0.60, 1, false),
      (10, 'BANCADA N°2 - MONTAGEM INTERRUPTORES',   'assembly',   4.000, 0.60, 1, false),
      (11, 'BANCADA N°4 - DIVERSOS',                 'assembly',   6.000, 0.60, 1, false),
      (12, 'PRENSA PLACA REFINATTO',                 'assembly',   6.000, 0.60, 1, false),
      (13, 'EMBALADORA KIT PARAFUSOS N°1',           'assembly',  30.000, 0.60, 1, false),
      (14, 'EMBALADORA KIT PARAFUSOS N°2',           'assembly',  30.000, 0.60, 1, false),
      (15, 'BANCADA N°3 - DIVERSOS',                 'assembly',   6.000, 0.60, 1, false),
      (16, 'MÁQUINA DE TOMADAS COMPOSÉ - AUMAQ',     'assembly',  30.000, 0.85, 1, true ),
      (17, 'PRENSA INSERÇÃO CONTATOS INTERRUPTORES', 'assembly',   4.000, 0.60, 2, false)
    ) as v(id, nome, processo, ppm, efic, lotacao, tem_meta)
   where m.id = v.id;

  -- ─── 3. O centro que deixou de existir (D43) ──────────────────────────────
  -- FECHAMENTO TECLA INTERRUPTORES foi renomeado e readequado na fábrica: o
  -- que era feito ali hoje é feito na Bancada N°3. Como não dá para duas
  -- máquinas terem o mesmo nome, esta é INATIVADA — nunca apagada.
  --
  -- Não há apontamento para mover: no banco de testes esta máquina tem zero
  -- registros. Na importação da planilha (D35), a coluna dela é mapeada
  -- direto para a Bancada N°3, que é onde a D43 manda o histórico ir.
  update public.machines
     set status = 'inactive', has_target = false, process = 'assembly'
   where id = 18;

  -- ─── 4. Os 5 centros que faltavam ─────────────────────────────────────────
  -- Existem na fábrica desde sempre e nunca foram cadastrados. Recebem id
  -- novo do banco (18 já está em uso), porque não têm histórico para herdar.
  insert into public.machines
        (name, process, pieces_per_minute, efficiency, standard_operator_count, has_target, status)
  select v.nome, v.processo, v.ppm, v.efic, v.lotacao, v.tem_meta, 'active'
    from (values
      ('EMBALADORA VERTICAL CONJUNTOS N°1', 'packaging', 14.000, 0.70, 2, true ),
      ('EMBALADORA VERTICAL CONJUNTOS N°2', 'packaging', 14.000, 0.70, 2, true ),
      ('MÁQUINA DE PLUGUE SLIN - AUMAQ',    'assembly',  16.000, 0.60, 1, true ),
      ('BANCADA N°5 - ELETRÔNICOS',         'assembly',   4.000, 0.60, 1, false),
      ('PRENSA TOX',                        'assembly',   6.000, 0.60, 1, false)
    ) as v(nome, processo, ppm, efic, lotacao, tem_meta)
   where not exists (
     select 1 from public.machines m where lower(m.name) = lower(v.nome)
   );

  -- ─── 5. As 7 que ainda não existem (D41) ──────────────────────────────────
  -- Amarelas na planilha de capacidade: compradas ou previstas, sem
  -- funcionamento real. Entram como 'planned' e ficam fora de tudo — tela de
  -- apontamento, indicadores, cálculo de meta.
  --
  -- As três de montagem não têm capacidade na planilha (só lotação prevista),
  -- por isso peças/minuto e eficiência ficam vazios nelas.
  --
  -- QUANDO A MÁQUINA CHEGAR: mudar a situação para 'active', preencher a data
  -- de entrada em operação e, se ela for cobrada, marcar "tem meta" e definir
  -- a meta na tela de Metas. Nasce sem meta de propósito: máquina marcada como
  -- cobrada e sem meta apareceria com 0.
  insert into public.machines
        (name, process, pieces_per_minute, efficiency, standard_operator_count, has_target, status)
  select v.nome, v.processo, v.ppm, v.efic, v.lotacao, false, 'planned'
    from (values
      ('MÁQUINA DE INTERRUPTORES (NOVA BASE)',   'assembly',  null::numeric, null::numeric, 1),
      ('MÁQUINA DE PLUGUE FÊMEA',                'assembly',  null,          null,          1),
      ('MÁQUINA DE TOMADAS N°2',                 'assembly',  null,          null,          1),
      ('EMBALADORA VERTICAL LUFATI KLIN PADRÃO', 'packaging', 40.000,        0.70,          1),
      ('EMBALADORA VERTICAL LUFATI PL+SUP 4X4',  'packaging', 40.000,        0.70,          2),
      ('EMBALADORA VERTICAL PLUGUES',            'packaging', 25.000,        0.70,          1),
      ('EMBALADORA VERTICAL CONJUNTOS N°3',      'packaging', 25.000,        0.70,          1)
    ) as v(nome, processo, ppm, efic, lotacao)
   where not exists (
     select 1 from public.machines m where lower(m.name) = lower(v.nome)
   );

  raise notice 'Migration 0014: % centros ativos, % planejados, % inativos.',
    (select count(*) from public.machines where status = 'active'),
    (select count(*) from public.machines where status = 'planned'),
    (select count(*) from public.machines where status = 'inactive');
end
$transformacao$;

-- Acerta o contador de ids depois das inserções, para a próxima máquina
-- cadastrada pelo app não tentar um id já usado.
select setval(
  pg_get_serial_sequence('public.machines', 'id'),
  greatest((select max(id) from public.machines), 1)
);


-- ═══════════════════════════════════════════════════════════════════════════
-- Estado esperado depois desta migration:
--   22 centros ativos   → 13 assembly + 9 packaging
--   12 com "tem meta"   → as metas REAIS ainda não estão aqui (parte 3);
--                          os 9 antigos seguem com os valores de reserva e
--                          3 centros novos ficam sem meta até a parte 3.
--   10 por demanda      → todos em assembly
--    7 planejados       → fora de tudo até chegarem
--    1 inativo          → FECHAMENTO TECLA INTERRUPTORES
--
-- Rodar a parte 3 logo em seguida: é ela que substitui as metas de reserva
-- pelas reais e acerta os 3 centros novos que ficam sem meta.
-- ═══════════════════════════════════════════════════════════════════════════
