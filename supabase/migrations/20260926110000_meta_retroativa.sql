-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0018 — Meta retroativa na área de preparo
-- Decisões: D35 (item 9), D08
--
-- Acrescenta um quarto nível à regra da meta do apontamento importado:
--
--   planilha             a meta escrita naquela linha
--   planilha_arrastada   a última conhecida do centro, para a FRENTE
--   planilha_retroativa  a PRIMEIRA conhecida do centro, para TRÁS   ← novo
--   meta_de_hoje         a planilha nunca trouxe meta para este centro
--
-- Por que o retroativo: sete centros têm meta na planilha, mas os primeiros
-- registros deles são anteriores ao mês em que a coluna de meta começa. Sem
-- esta regra eles cairiam na meta de hoje — a Bancada A Granél seria medida
-- em dezembro por 25.000 quando a própria planilha diz que a meta era 15.000.
--
-- A meta de hoje continua valendo para quem NUNCA teve meta registrada: aí
-- não há nada para puxar.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.import_rows
  drop constraint if exists import_rows_target_source_check;

alter table public.import_rows
  add constraint import_rows_target_source_check
  check (target_source in ('planilha', 'planilha_arrastada', 'planilha_retroativa',
                           'meta_de_hoje', 'sem_meta'));

comment on column public.import_rows.target_source is
  'De onde veio a meta: planilha (escrita naquela linha), planilha_arrastada '
  '(última conhecida do centro, para a frente), planilha_retroativa (primeira '
  'conhecida do centro, para trás), meta_de_hoje (a planilha nunca trouxe meta '
  'para este centro) ou sem_meta. Permite separar depois o que é histórico '
  'real do que foi emprestado. [D35]';
