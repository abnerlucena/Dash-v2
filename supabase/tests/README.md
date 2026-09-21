# Testes de verificação do banco

Scripts SQL que conferem as regras do banco **no banco real**, sem deixar rastro:
cada execução acontece dentro de uma transação que termina em `rollback`
(tudo é desfeito no final — inclusive os usuários fictícios `@example.com`).

| Arquivo | O que testa |
|---|---|
| `00_fixtures.sql` | Cria usuários fictícios (gestora, 2 operadores, conta Admin compartilhada, pendente, TV, novo cadastro) e a tabela `results` |
| `01_funcoes.sql` | Funções de regra de negócio (migration 0009): apontar, completar, hora extra, permissões, conta compartilhada, ações em massa, metas, máquinas |
| `02_rls.sql` | Políticas de acesso (migration 0010): quem vê e quem altera o quê |

## Como rodar (SQL Editor do Supabase)

Pré-requisito: todas as migrations aplicadas. O seed estrutural pode ou não estar aplicado
(o bloco abaixo o inclui; ele não duplica nada).

Cole, **em uma única execução**, na ordem:

```sql
begin;
-- conteúdo de supabase/seed/01_estrutural.sql
-- conteúdo de supabase/tests/00_fixtures.sql
-- conteúdo de supabase/tests/01_funcoes.sql   (ou 02_rls.sql — um de cada vez)
rollback;
```

O resultado mostra a tabela `results`: cada linha é um teste, com `ok = true` quando o
banco se comportou como esperado. Linhas "NÃO pode…" passam quando o banco **recusa** a ação,
e a coluna `info` traz a mensagem de erro devolvida.

Resultado em 20/09/2026: 22/22 testes de funções e 22/22 de RLS com `ok = true`.
