-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0011 — "Ver os próprios apontamentos" passa a depender de permissão
-- Decisões: D22, D24, D33 (confirmada em 21/09/2026)
-- Documentação: docs/database/02-referencia-tecnica.md, seção 7
--
-- Antes: qualquer usuário ativo lia os apontamentos que ele mesmo fez.
-- Agora: só quem tem a permissão production.edit_own ("corrigir os próprios
-- apontamentos até 24 h"). O motivo de ver os próprios é justamente poder
-- corrigi-los — então as duas coisas andam juntas.
--
-- Por que permissão e não o nome do perfil "Operador": as permissões de cada
-- pessoa podem ser ajustadas individualmente (D22). Se o gestor tirar de um
-- operador o direito de corrigir, ele também deixa de ver; se der a outra
-- pessoa, ela passa a ver. O perfil é só o ponto de partida.
--
-- Na prática, com os perfis de fábrica nada muda: todos os perfis, menos TV,
-- têm production.edit_own, e todos, menos Operador, já veem toda a produção.
--
-- "alter policy" só troca a condição da política existente (nada é apagado).
-- Rodar de novo produz o mesmo resultado.
-- ═══════════════════════════════════════════════════════════════════════════

alter policy production_records_select on public.production_records
  using (
    (select public.has_permission('history.view'))
    or (select public.has_permission('dashboard.view'))
    or (select public.has_permission('tv_mode.view'))
    or (created_by = (select auth.uid()) and (select public.has_permission('production.edit_own')))
  );
