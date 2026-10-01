# Dash de Produção — instruções para o Claude Code

## Banco de dados (Supabase / PostgreSQL)

- A documentação oficial do banco fica em `docs/database/`. Leia `docs/database/README.md` antes de mexer no schema.
- **Toda mudança no banco** (arquivos em `supabase/migrations/`, tabelas, colunas, índices, triggers, funções, views ou políticas RLS) deve atualizar a documentação **no mesmo commit/PR**:
  - `docs/database/CHANGELOG.md` — sempre; nova entrada no topo, com versão do schema, data (dd/mm/aaaa), migration, decisões e impacto no frontend.
  - `docs/database/02-referencia-tecnica.md` — dicionário de dados, restrições, índices, triggers, funções, RLS.
  - `docs/database/01-visao-geral.md` — quando a mudança for perceptível para usuários ou gestão (linguagem simples, diagramas Mermaid).
  - `docs/database/03-decisoes.md` — quando houver escolha entre alternativas; decisões antigas nunca são apagadas, e sim marcadas `Substituída por Dxx`.
- Versão do schema: `MAJOR.MINOR.PATCH` (regras em `docs/database/README.md`). Atualize o cabeçalho de versão dos documentos alterados.
- Nomes de tabelas e colunas em inglês, `snake_case`, sem acentos. Textos de interface em português.
- Nunca coloque segredos no repositório (é público): nada de senhas, `service_role key` ou tokens. URL do projeto e `anon key` ficam só no `.env.local`.

## Sistema legado

- `Main.gs` (Google Apps Script) e as planilhas continuam em produção. Não alterar sem pedido explícito.

## Duas sessões trabalham neste repositório

O projeto é tocado por **duas sessões em paralelo**, que não conversam entre si:
uma cuida da **interface** e outra do **banco e da camada de dados**. Elas se
falam por este repositório — e pelo usuário, que leva recado de uma para outra.
Ao começar, descubra de qual lado você está e respeite a divisão.

| Pasta | Dono | Observação |
|---|---|---|
| `prototype/src/features/**`, `prototype/src/components/**` | **interface** | as telas |
| `supabase/**`, `docs/database/**` | **banco** | migrations e documentação |
| `src/lib/repositories/**`, `src/lib/supabase.ts`, `src/lib/database.types.ts`, `src/lib/metas.ts` | **banco** | a camada de dados, que a UI nova vai usar |
| `prototype/src/data/machines.ts` | **compartilhado** | combine antes de mexer |
| `src/` (telas antigas) | congelado | só conserto se atrapalhar alguém hoje (D44) |

Regras que evitam a maior parte do atrito:

1. **Um branch por sessão**, partindo da `main`, com PRs pequenas. Traga a `main`
   para o seu branch sempre que a outra mesclar algo.
2. **Nunca espere pela outra sessão.** Se falta algo do outro lado, escreva
   contra o contrato (os tipos em `src/lib/repositories/types.ts`) e siga; se o
   contrato ainda não existe, proponha-o em vez de inventar um formato.
3. **O contrato é código, não conversa.** Formato de dado combinado vira tipo em
   `types.ts` — quem muda o tipo avisa no PR, e o `tsc` cobra dos dois lados.
4. **Recado entre sessões vira arquivo**, em `docs/database/notas/`
   (`aaaa-mm-dd-assunto.md`): o que foi feito, o que falta, o que a outra sessão
   precisa decidir. Nota de trabalho registra um momento; a fonte da verdade
   continua sendo `docs/database/` e o próprio código.
5. Ao terminar uma tarefa que afeta o outro lado, **diga isso na resposta final**
   em uma linha, para o usuário levar o recado.
