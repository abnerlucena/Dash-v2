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
