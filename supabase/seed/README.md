# Dados iniciais (seed)

| Arquivo | Tipo | Conteúdo | Pode ficar em produção? |
|---|---|---|---|
| `01_estrutural.sql` | **Real** | 7 perfis-modelo, 18 permissões, matriz perfil × permissão, 18 máquinas (ids do legado), meta vigente de cada máquina | Sim — é necessário |
| `90_demo_REMOVER.sql` | **Fictício** | ~30 dias de apontamentos inventados (observação `[DEMO]`), 1 dia anulado e 1 feriado fictícios | **Não** — remover antes de migrar os dados reais |
| `99_remover_demo.sql` | Limpeza | Apaga tudo que começa com `[DEMO]` | — |

Todos são idempotentes (rodar de novo não duplica nada).

Ordem num projeto novo: migrations (ou `supabase/migrations/_consolidado.sql`) → `01_estrutural.sql` →
(opcional) `90_demo_REMOVER.sql`.

## Atenção às metas

As metas do seed estrutural vêm de `MACHINES_DEFAULT` (`src/lib/api.ts`), o valor de reserva do app.
As metas **reais atuais** estão na aba "Metas" da planilha. Confira e, se necessário, ajuste pela tela
de Metas do app (modo Supabase) — isso cria uma nova vigência, sem apagar a anterior.

## Estado no projeto Supabase (20/09/2026)

- `01_estrutural.sql`: aplicado.
- `90_demo_REMOVER.sql`: **aplicado** (842 apontamentos fictícios, 1.801 ordens) para permitir ver o
  dashboard no modo Supabase. Os dados fictícios **não** entraram no log de auditoria.
