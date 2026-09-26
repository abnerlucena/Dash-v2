# Nota de trabalho — Verificação do terreno (Fase C, sessão noturna)

> Data: 20/09/2026 · Autor: Claude Code (sessão autônoma) · Branch: `claude/supabase-fase-c-noite`
> Nota de trabalho: registra o que foi encontrado **antes** de qualquer mudança. Não é documentação oficial;
> a fonte da verdade continua sendo `02-referencia-tecnica.md`.

## 1. Como a conexão foi feita

- O `psql` não está instalado na máquina. Foi usado um cliente Node (`pg`) guardado fora do repositório,
  que lê `SUPABASE_DB_URL` do arquivo de segredos sem imprimir o valor.
- A conexão direta (`db.<ref>.supabase.co`) só tem endereço **IPv6**, e esta rede não roteia IPv6.
  A conexão foi feita pelo **pooler de sessão IPv4** do Supabase (`aws-0-us-east-2.pooler.supabase.com`,
  porta 5432, usuário `postgres.<ref>`) — mesmas credenciais, outro caminho.
- Servidor: PostgreSQL **17.6**. Extensões presentes: `pgcrypto`, `uuid-ossp`, `pg_stat_statements`,
  `supabase_vault`, `plpgsql`.

## 2. O que o desenho prevê × o que existe no banco

| Item | Desenho (`docs/database`, v0.2.2) | Banco real (20/09/2026) |
|---|---|---|
| `shifts` | Criada e populada (TURNO 1/2/3) em 16/09/2026 | **Não existe** |
| Demais 15 tabelas | Desenhadas | Não existem (esperado) |
| Views `production_summary`, `current_machine_targets` | Desenhadas | Não existem (esperado) |
| Funções / triggers / RLS | Desenhados | Não existem (esperado) |
| `auth.users` | — | 0 usuários |
| Schema `public` | — | **Vazio** (nenhuma tabela, view ou função) |

## 3. Divergência principal: a tabela `shifts` não está neste banco

Evidências coletadas:

- `public` está totalmente vazio.
- O servidor foi iniciado em 20/09/2026 23:22 UTC e as estatísticas de consultas (`pg_stat_statements`)
  mostram apenas as migrations internas da própria plataforma Supabase (auth, storage). Nenhum
  `create table public.shifts` e nenhum `drop` em `public`.
- A URL da API (`VITE_SUPABASE_URL`) e a do banco (`SUPABASE_DB_URL`) apontam para o **mesmo projeto**,
  então o arquivo de segredos está coerente.

Hipóteses (não é possível confirmar sem o usuário):

1. O projeto foi recriado (ou é outro projeto) depois de 16/09/2026; ou
2. A migration de `shifts` foi rodada em outro projeto.

**Decisão tomada (D28, provisória):** aplicar neste banco as duas migrations já versionadas de `shifts`
(`20260915120000_create_shifts.sql` e `20260916090000_seed_shifts.sql`) exatamente como estão, antes das
demais. É uma ação apenas aditiva: nada existente é alterado ou apagado. Se existir outro projeto com
`shifts`, ele não é afetado.

## 4. Conferência `shifts` × migration versionada

Não foi possível comparar colunas, porque a tabela não existia. Depois da aplicação (Fase 2, passo 0),
a estrutura passa a ser, por construção, idêntica à migration versionada — a verificação está no
CHANGELOG da versão 0.3.0.

## 5. Outras observações úteis para as próximas fases

- O frontend chama ações do Apps Script que **não existem** no `Main.gs` atual:
  `getAlertConfig`, `saveAlertConfig`, `testAlertEmail` (tela de alertas) e `completeOnboarding`.
  No modo `gas` elas continuam como estão; no modo `supabase` ficam como "não disponível" (fora do desenho).
- O `upsert` do legado **substitui** a lista de ordens quando ela é enviada e **preserva** quando não é
  (a aba Feedbacks edita só a observação). O desenho (D10) diz que um novo lançamento no mesmo
  apontamento **completa** as ordens existentes. Ver D29.
- Ações de usuários do legado sem equivalente seguro no navegador: `adminCreateUser`, `resetPassword`,
  `generateInviteCode` (exigiriam a `service_role`, que nunca vai para o frontend — D19/D20).
