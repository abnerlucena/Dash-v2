-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0016 — Área de preparo da importação do histórico
-- Decisões: D35 (itens 3, 4, 6 e 7), D43 (mapeamento das colunas)
-- Documentação: docs/database/02-referencia-tecnica.md
--
-- PASSO 1 de 4 da importação do histórico da planilha.
--   passo 1 (esta)  → onde os dados ficam para conferência ANTES de virarem
--                     produção, e como um lote inteiro é desfeito.
--   passo 2         → script que lê a planilha e enche a área de preparo.
--   passo 3         → carga da preparo para a produção.
--   passo 4         → conferência mês a mês contra o controle do gestor.
--
-- POR QUE UMA ÁREA DE PREPARO, e não gravar direto na produção:
--   • o gestor precisa conferir ANTES de qualquer número virar oficial;
--   • cada valor guarda de qual célula da planilha veio, então dá para
--     rastrear qualquer divergência até a origem;
--   • se algo sair errado, o lote inteiro é revertido sem tocar no que a
--     equipe apontou à mão;
--   • rodar a extração de novo não duplica nada: ela recria o lote.
--
-- Tudo aditivo. Nenhuma tabela existente perde coluna ou dado.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. Duas permissões novas ───────────────────────────────────────────────
-- Separadas de propósito: quem confere não precisa poder carregar.
--   import.review → ler a área de preparo (gestor e admin)
--   import.manage → criar lote, carregar e reverter (só admin)
insert into public.permissions (code, description, category, sort_order)
values
  ('import.review', 'Conferir a área de preparo da importação', 'Sistema', 90),
  ('import.manage', 'Criar, carregar e reverter lotes de importação', 'Sistema', 91)
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_code)
select r.id, p.code
  from public.roles r
  cross join (values ('import.review'), ('import.manage')) as p(code)
 where r.code = 'admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_code)
select r.id, 'import.review'
  from public.roles r
 where r.code = 'manager'
on conflict do nothing;


-- ─── 2. O lote ──────────────────────────────────────────────────────────────
-- Uma rodada de importação inteira. É a unidade que se carrega e se desfaz.
--
-- Estados: draft (extraído, em conferência) → loaded (virou produção)
--          → reverted (desfeito). "failed" guarda uma carga que deu errado.
create table if not exists public.import_batches (
  id            uuid        primary key default gen_random_uuid(),
  source_file   text        not null check (length(trim(source_file)) > 0),
  description   text,
  status        text        not null default 'draft'
                check (status in ('draft', 'loaded', 'reverted', 'failed')),
  loaded_at     timestamptz,
  reverted_at   timestamptz,
  error_message text,
  created_by    uuid        references public.profiles(id) default auth.uid(),
  created_at    timestamptz not null default now()
);

comment on table public.import_batches is
  'Uma rodada de importação do histórico. Unidade de carga e de reversão. [D35]';


-- ─── 3. A área de preparo ───────────────────────────────────────────────────
-- Uma linha por célula da planilha que significa alguma coisa. O que o script
-- de extração escreve aqui é exatamente o que ele leu, mais a interpretação —
-- as duas coisas lado a lado, para a conferência poder discordar.
--
-- kind diz o que aquela célula vira:
--   production → um apontamento com uma ordem
--   rework     → retrabalho (ordem marcada como refeita)
--   downtime   → parada de máquina ("Preventiva", "Manutenção")
--   note       → observação do dia, sem quantidade
--   discard    → não entra, e discard_reason diz por quê
create table if not exists public.import_rows (
  id                   bigint      generated always as identity primary key,
  batch_id             uuid        not null references public.import_batches(id) on delete cascade,

  -- De onde veio, exatamente. É isto que permite rastrear uma divergência.
  source_sheet         text        not null,
  source_cell          text        not null,
  raw_machine          text        not null,
  raw_value            text,

  -- O que foi entendido.
  kind                 text        not null
                       check (kind in ('production', 'rework', 'downtime', 'note', 'discard')),
  machine_id           integer     references public.machines(id),
  production_date      date,
  shift_id             smallint    references public.shifts(id),
  work_mode            text        check (work_mode in ('regular', 'overtime')),
  quantity             integer     check (quantity >= 0),
  operator_count       smallint    check (operator_count >= 0),
  notes                text,
  discard_reason       text,

  -- O que aconteceu na carga.
  status               text        not null default 'pending'
                       check (status in ('pending', 'loaded', 'skipped', 'error')),
  error_message        text,
  production_record_id uuid        references public.production_records(id) on delete set null,
  downtime_id          uuid        references public.machine_downtimes(id) on delete set null,

  created_at           timestamptz not null default now(),

  -- Uma célula da planilha só pode aparecer uma vez no mesmo lote. É o que
  -- impede a extração de contar o mesmo número duas vezes.
  constraint import_rows_origem_unica unique (batch_id, source_sheet, source_cell),

  -- Coerência: o que vira produção precisa de máquina, data, turno e
  -- quantidade; o que é descartado precisa de motivo.
  constraint import_rows_producao_completa check (
    kind not in ('production', 'rework')
    or (machine_id is not null and production_date is not null
        and shift_id is not null and quantity is not null and work_mode is not null)
  ),
  constraint import_rows_descarte_com_motivo check (
    kind <> 'discard' or discard_reason is not null
  )
);

comment on table public.import_rows is
  'Área de preparo: uma linha por célula da planilha, com a origem e a interpretação lado a lado. [D35]';
comment on column public.import_rows.source_cell is
  'Célula de origem, ex.: "F12". Junto com source_sheet permite rastrear qualquer divergência até a planilha.';
comment on column public.import_rows.raw_value is
  'O conteúdo da célula como estava, sem interpretação. É a prova do que a planilha dizia.';

create index if not exists import_rows_batch_status_idx
  on public.import_rows (batch_id, status);
create index if not exists import_rows_batch_kind_idx
  on public.import_rows (batch_id, kind);
create index if not exists import_rows_conferencia_idx
  on public.import_rows (batch_id, machine_id, production_date);


-- ─── 4. A marca no apontamento ──────────────────────────────────────────────
-- Sem isto não há como separar o que veio da planilha do que a equipe apontou
-- à mão — e portanto não há como desfazer a importação com segurança.
alter table public.production_records
  add column if not exists import_batch_id uuid references public.import_batches(id);

alter table public.production_records
  add column if not exists source_ref text;

comment on column public.production_records.import_batch_id is
  'Lote de importação que criou este apontamento. Nulo = apontado por uma pessoa. [D35]';
comment on column public.production_records.source_ref is
  'Origem na planilha, ex.: "JUN 26!F12". Só para apontamentos importados. [D35]';

-- Achar (e reverter) tudo de um lote precisa ser rápido; o índice só cobre o
-- que veio de importação, que é uma fatia pequena da tabela.
create index if not exists production_records_import_batch_idx
  on public.production_records (import_batch_id)
  where import_batch_id is not null;


-- ─── 5. Quem enxerga o quê ──────────────────────────────────────────────────
-- A área de preparo contém produção ainda não conferida: fica restrita a quem
-- confere e a quem carrega. Ninguém mais precisa saber que ela existe.
alter table public.import_batches enable row level security;
alter table public.import_rows    enable row level security;

drop policy if exists import_batches_select on public.import_batches;
create policy import_batches_select on public.import_batches
  for select to authenticated
  using (public.has_permission('import.review'));

drop policy if exists import_batches_write on public.import_batches;
create policy import_batches_write on public.import_batches
  for all to authenticated
  using (public.has_permission('import.manage'))
  with check (public.has_permission('import.manage'));

drop policy if exists import_rows_select on public.import_rows;
create policy import_rows_select on public.import_rows
  for select to authenticated
  using (public.has_permission('import.review'));

drop policy if exists import_rows_write on public.import_rows;
create policy import_rows_write on public.import_rows
  for all to authenticated
  using (public.has_permission('import.manage'))
  with check (public.has_permission('import.manage'));


-- ═══════════════════════════════════════════════════════════════════════════
-- O que esta migration NÃO faz:
--   • não lê a planilha nem cria lote nenhum (passo 2);
--   • não move nada da preparo para a produção (passo 3);
--   • não confere total nenhum (passo 4).
--
-- A tabela nasce vazia. Nenhum apontamento existente foi tocado: os que já
-- estão lá ficam com import_batch_id nulo, que é o correto — não vieram de
-- importação.
-- ═══════════════════════════════════════════════════════════════════════════
