-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0012 — Correção: apontamento SEM AUTOR não pode ser editado por
--                  quem só tem "corrigir os próprios"
-- Decisões: D24
-- Documentação: docs/database/02-referencia-tecnica.md, seção 6.1
--
-- O defeito (encontrado em 21/09/2026 nos testes):
--   A regra "é o autor?" era  created_by = auth.uid().  Quando o apontamento
--   não tem autor (created_by vazio — dados de demonstração, carga inicial e,
--   no futuro, apontamentos migrados da planilha), essa comparação não dá
--   "verdadeiro" nem "falso": dá "desconhecido" (NULL). E o teste
--   "se NÃO pode editar, recuse" não recusa um "desconhecido". Resultado: um
--   operador conseguia acrescentar ordens em apontamento que não era dele.
--
-- A correção: coalesce(..., false) — "desconhecido" passa a valer "não".
-- Apontamento sem autor só é editável/apagável por quem tem production.edit /
-- production.delete.
--
-- "create or replace" troca só o corpo das funções; o resto fica igual.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.can_edit_production_record(p_created_by uuid, p_created_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.has_permission('production.edit')
    or (public.has_permission('production.edit_own')
        and p_created_by = auth.uid()
        and p_created_at > now() - interval '24 hours'),
    false)
$$;

create or replace function public.can_delete_production_record(p_created_by uuid, p_created_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.has_permission('production.delete')
    or (public.has_permission('production.edit_own')
        and p_created_by = auth.uid()
        and p_created_at > now() - interval '24 hours'),
    false)
$$;

comment on function public.can_edit_production_record(uuid, timestamptz) is
  'production.edit, ou production.edit_own sendo autor e dentro de 24 h. Sem autor = só production.edit. [D24]';
comment on function public.can_delete_production_record(uuid, timestamptz) is
  'production.delete, ou production.edit_own sendo autor e dentro de 24 h. Sem autor = só production.delete. [D24]';
