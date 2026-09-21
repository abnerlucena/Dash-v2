# Documentação do Banco de Dados — Dash de Produção

Esta pasta é a **fonte oficial** sobre o banco de dados do Dash de Produção (Supabase / PostgreSQL).
Ela registra **o que existe, como funciona, por que foi decidido assim e o que mudou**.

> **Estado atual do schema:** `v0.10.0` — implementado no Supabase (schema completo; o app ainda usa o Apps Script por padrão) (migrations em `supabase/migrations/`).
> O sistema em produção continua sendo Google Sheets + Google Apps Script (`Main.gs`).

## Os documentos

| Arquivo | Para quem | Conteúdo |
|---|---|---|
| [01-visao-geral.md](01-visao-geral.md) | Gestão, apresentações, novos membros | Lógica do sistema em linguagem simples, com diagramas |
| [02-referencia-tecnica.md](02-referencia-tecnica.md) | Desenvolvedores, TI, DBA | Dicionário de dados, constraints, índices, triggers, funções, RLS |
| [03-decisoes.md](03-decisoes.md) | Todos | Registro de decisões (ADR): contexto, escolha e consequências |
| [CHANGELOG.md](CHANGELOG.md) | Todos | Ata de mudanças do schema, versão por versão |

## Normas de manutenção

Estas regras valem para pessoas **e** para o Claude Code (ver `CLAUDE.md` na raiz).

1. **Toda mudança no banco gera documentação no mesmo commit/PR.** Uma migration em
   `supabase/migrations/` sem entrada correspondente no `CHANGELOG.md` está incompleta.
2. **O que atualizar em cada mudança:**
   - `CHANGELOG.md` — sempre: nova entrada com versão, data, o que mudou e referência ao commit/PR.
   - `02-referencia-tecnica.md` — sempre que mudar tabela, coluna, tipo, regra, índice, trigger, função ou política.
   - `01-visao-geral.md` — quando a mudança altera algo que um usuário ou gestor perceberia.
   - `03-decisoes.md` — quando houve uma escolha com alternativas (nova decisão ou revisão de uma antiga).
3. **Decisões não são apagadas.** Uma decisão revista recebe status `Substituída por DXX`, e a nova é adicionada.
4. **Versão do schema** segue `MAJOR.MINOR.PATCH`:
   - `MAJOR` — mudança que quebra o frontend ou exige migração de dados (remover/renomear coluna ou tabela).
   - `MINOR` — adição compatível (nova tabela, nova coluna opcional, nova função).
   - `PATCH` — ajuste sem efeito estrutural (comentário, índice, correção de regra).
5. **Nunca registrar segredos aqui:** nada de senhas, `service_role key`, tokens ou dados pessoais.
   A `anon key` e a URL do projeto também ficam fora — elas vivem no `.env.local`.

## Convenções de nomenclatura (resumo)

- Nomes de tabelas e colunas em **inglês**, `snake_case`, sem acentos.
- Tabelas no plural (`machines`), foreign keys com sufixo `_id` (`machine_id`).
- Data+hora terminam em `_at` (`created_at`); data pura não leva sufixo (`production_date`).
- Textos exibidos ao usuário ficam em português no frontend, nunca no nome da coluna.
