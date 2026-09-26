-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0017 — A meta na área de preparo
-- Decisões: D35 (item 9), D08 (meta é uma foto no apontamento)
--
-- Parte do passo 3 da importação. Cada apontamento guarda a meta que valia no
-- seu dia (D08), e o apontamento importado não é exceção — mas a planilha só
-- traz meta em 37% das linhas, e só para 8 das 23 colunas.
--
-- A regra combinada com o usuário em 26/09/2026 tem três níveis:
--   1. a meta escrita na planilha naquela linha;
--   2. a última meta conhecida daquele centro, arrastada para a frente
--      (é o que a D35 item 9 já mandava fazer com agosto e setembro);
--   3. a meta vigente HOJE, quando a planilha nunca trouxe meta para aquele
--      centro.
--
-- O nível 3 foi escolhido sabendo do custo: meses antigos passam a ser
-- julgados por uma meta que ainda não existia na época. Por isso a origem de
-- cada meta fica registrada — sem isso, daqui a seis meses ninguém saberia
-- distinguir o que a planilha dizia do que foi emprestado de hoje.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.import_rows
  add column if not exists target_quantity integer
  check (target_quantity >= 0);

alter table public.import_rows
  add column if not exists target_source text
  check (target_source in ('planilha', 'planilha_arrastada', 'meta_de_hoje', 'sem_meta'));

comment on column public.import_rows.target_quantity is
  'Meta usada no apontamento importado. [D08, D35]';
comment on column public.import_rows.target_source is
  'De onde veio a meta: planilha (escrita naquela linha), planilha_arrastada '
  '(última conhecida do centro), meta_de_hoje (a planilha nunca trouxe meta '
  'para este centro) ou sem_meta. Permite separar depois o que é histórico '
  'real do que foi emprestado. [D35]';

-- Conferir quanta meta veio de cada origem é a primeira pergunta de quem for
-- auditar a importação, então vale o índice.
create index if not exists import_rows_target_source_idx
  on public.import_rows (batch_id, target_source);
