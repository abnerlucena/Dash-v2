# Tarefa para a sessão da interface — a área de acesso na UI nova

> Data: 27/09/2026 · Escrito pela sessão do **banco** · Branch de origem:
> `claude/ui-oficial-transicao`
> Este arquivo é o briefing e o contrato. A fonte da verdade sobre dados
> continua sendo `src/lib/repositories/types.ts` (o contrato em código) e
> [`docs/database/02-referencia-tecnica.md`](../02-referencia-tecnica.md).

## Por que esta é a próxima tarefa

A UI de `prototype/` tem Dashboard, Apontamento, OPs, Histórico, Metas,
Feedbacks, Relatórios, Ranking, Retrabalho, Modo TV e Ajuda. **Não tem nada de
acesso**: nem login, nem cadastro, nem aprovação, nem permissões. Enquanto for
assim ela não pode ir para a fábrica — qualquer pessoa com o link apontaria
produção no nome de qualquer outra.

É também a maior peça sem nada pronto, e é pré-requisito de qualquer piloto.

## O que já existe e NÃO deve ser reescrito

A camada de dados (`src/lib/repositories/`) já fala com o Supabase e com o Apps
Script, e já cobre acesso inteiro. Ela compila sob `strict: true` e não depende
mais do alias `@` — a UI nova consegue importá-la hoje.

```ts
data.auth.login(email, senha, cracha?)   // cracha só na conta compartilhada
data.auth.register({ nome, senha, email, badgeNumber })
data.auth.logout(session)
data.auth.isSessionValid(session)
data.auth.watchSession(cb)               // outra aba entrou/saiu
data.auth.requestPasswordReset(email)
data.auth.setNewPassword(novaSenha)
data.users.listUsers(session)            // gestão
data.users.approveUser(userId, roleId, session)
data.users.listRoles(session)
data.users.toggleUser(target, session)
```

A sessão que volta do login:

```ts
interface Session {
  token: string;
  nome: string;
  role: "admin" | "user";
  expiresAt?: string;
  source?: "gas" | "supabase";
  userId?: string;
  permissions?: string[];                       // ver catálogo abaixo
  accountType?: "personal" | "shared" | "display";
}
```

Telas equivalentes já escritas na UI antiga, boas de consultar (não de copiar, o
visual é outro): `src/pages/LoginPage.tsx` (entrar, criar conta, recuperar senha,
definir senha nova) e `src/components/AdminPanel.tsx` (aprovar, perfil,
permissões, reset de senha).

## O que a UI nova precisa construir

1. **Entrar** — e-mail e senha. Em conta compartilhada o login falha com o código
   `BADGE_REQUIRED`; a tela então pede o **nº do crachá** e repete o login com
   ele (D23). Use `codigoDoErro(e)` de `src/lib/erros.ts`.
2. **Criar conta** — nome, e-mail, senha, nº do crachá. O cadastro **não** entra
   direto: fica pendente até um gestor aprovar (D19–D23). A tela precisa dizer
   isso com todas as letras.
3. **Recuperar senha** — pedir o e-mail e, na volta do link, definir a senha
   nova. A chegada pelo link já está resolvida em `src/lib/recovery.ts`, que roda
   antes de a tela montar. **Atenção:** ela existe porque o app usa `HashRouter`
   e o token do Supabase chega no hash; se a UI nova usar outro roteamento, este
   arquivo precisa ser revisto junto com quem cuida do banco.
4. **Sessão e proteção de rota** — sem sessão válida, só a tela de entrar.
   `watchSession` avisa quando o login muda em outra aba.
5. **Permissões** — cada item de menu e cada botão de ação aparecem conforme
   `session.permissions`. Esconder na tela é conveniência; **quem impede de
   verdade é o banco** (RLS), então nunca confie só no que está escondido.
6. **Usuários (gestão)** — lista, aprovar cadastro escolhendo o perfil-modelo,
   bloquear/desbloquear. Exige `users.approve`.

## Catálogo de permissões (é isto que chega em `session.permissions`)

| Código | O que libera |
|---|---|
| `production.create`, `production.edit_own` | apontar e corrigir o próprio apontamento |
| `production.edit`, `production.delete` | editar/apagar de qualquer um, um por vez |
| `production.bulk_edit`, `production.bulk_delete` | em lote |
| `history.view`, `feedbacks.view` | histórico e feedbacks |
| `reports.export` | exportar relatórios |
| `dashboard.view`, `targets.view`, `tv_mode.view` | dashboard, ver metas, modo TV |
| `machines.manage`, `calendar.manage`, `alerts.manage` | máquinas, calendário, alertas |
| `targets.manage` | **alterar** metas |
| `users.approve` | aprovar cadastro |
| `system.admin` | tudo |

Perfis-modelo: Operador, Preparador, Distribuidor, Técnico, Gestor, Admin (conta
compartilhada com crachá) e TV. O perfil é ponto de partida: o gestor marca e
desmarca permissão a permissão.

## Como não ficar esperando o outro lado

- **Contra o contrato, não contra a implementação.** Os tipos acima já existem;
  escreva as telas contra eles.
- Se precisar de algo que o contrato não tem, **proponha o tipo** (uma linha em
  `types.ts` no seu PR, ou um recado nesta pasta) em vez de inventar um formato
  na tela. Quem cuida do banco implementa do outro lado.
- Se quiser rodar sem Supabase, peça à sessão do banco uma **fonte de mentira**
  para autenticação (todos os estados: pendente, bloqueado, conta compartilhada,
  link expirado). É trabalho dela, não da interface.

## Divisão, para não haver conflito

| Pasta | Dono |
|---|---|
| `prototype/src/features/**`, `prototype/src/components/**` | interface |
| `src/lib/repositories/**`, `supabase/**`, `docs/database/**` | banco |
| `prototype/src/data/machines.ts` | compartilhado — combinar antes |

As regras completas estão no `CLAUDE.md` da raiz, que as duas sessões leem
sozinhas ao começar.

## Duas pendências que afetam esta tarefa

1. **A recuperação de senha não entrega e-mail** enquanto o Supabase não tiver
   SMTP próprio e as URLs do app liberadas (ver D45). A tela pode ser construída
   e testada; a entrega depende do painel.
2. **As pessoas ainda não existem no Supabase Auth** — hoje vivem na planilha.
   Cada uma precisa se cadastrar e ser aprovada. Isso é logística, não código,
   mas define quando a tela pode ser usada de verdade.
