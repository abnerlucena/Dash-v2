# Dash de Produção — WEG Itajaí

Apontamento de produção e acompanhamento de metas da Seção Tomadas e
Interruptores. Vite + React + TypeScript.

> **Repositório público.** Nenhum dado real de produção, senha, chave ou
> connection string entra aqui. A URL do projeto Supabase e a `anon key` ficam só
> no `.env.local`; os números que aparecem no código de demonstração são
> fictícios.

## O que existe neste repositório

| Pasta | O que é |
|---|---|
| `src/` | O app **em uso hoje**: telas antigas + a **camada de dados** (`src/lib/repositories/`), que fala com o Apps Script e com o Supabase |
| `prototype/` | A **interface oficial** do sistema, que vai substituir as telas de `src/`. Ainda roda com dados fictícios — ver decisão **D44** |
| `supabase/` | Migrations, seeds e testes SQL do banco |
| `docs/database/` | **Fonte da verdade sobre o banco**: visão geral, referência técnica, decisões (ADR) e ata de mudanças |
| `Main.gs` | Sistema **legado em produção** (Google Apps Script + planilhas). Não alterar sem pedido explícito |
| `tests/` | Teste de ponta a ponta (Playwright), pulado sem credenciais |

Duas interfaces convivem de propósito durante a transição: o Apps Script ainda é
o sistema que a fábrica usa. A chave liga/desliga é a variável
`VITE_DATA_SOURCE` (`gas`, padrão, ou `supabase`) — ver
`src/lib/repositories/index.ts`.

## Como rodar

```bash
npm ci
npm run dev            # app atual        → http://localhost:8080/Dash-v2/
npm run proto:dev      # interface nova   → http://localhost:8090/
```

Para construir telas **sem banco nenhum**, use o modo de demonstração — só
funciona em `npm run dev`; um build de produção ignora a variável e cai no `gas`:

```
VITE_DATA_SOURCE=mock
```

Ele simula a área de acesso inteira (login, crachá, cadastro pendente, aprovação,
bloqueio, recuperação de senha) com contas fictícias listadas em
`src/lib/repositories/mock/contas.ts`, todas com a senha `123456`.

Para o modo Supabase, crie um `.env.local` (não versionado):

```
VITE_DATA_SOURCE=supabase
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Verificação

```bash
npm test               # testes de unidade (vitest)
npm run lint           # eslint
npm run build          # build do app atual
npm run proto:build    # build da interface nova
npm run test:integration   # camada de dados contra o Supabase (precisa de .env.local)
npm run test:e2e       # ponta a ponta (Playwright); pulado sem E2E_ADMIN_PASSWORD
```

## Antes de mexer no banco

Leia [`docs/database/README.md`](docs/database/README.md). A regra do
[`CLAUDE.md`](CLAUDE.md) vale para pessoas e para o Claude Code: **toda mudança
no banco atualiza `docs/database/` no mesmo commit**, e a ata
([`CHANGELOG.md`](docs/database/CHANGELOG.md)) sempre. Um workflow do GitHub
reprova o PR que mexer em `supabase/migrations/` sem entrada na ata.
