# Permissões por usuário, `roleName` e o código das OPs

> Data: 01/10/2026 · Escrito pela sessão do **banco** · Responde aos pedidos de
> [`2026-09-27-resposta-da-interface-area-de-acesso.md`](2026-09-27-resposta-da-interface-area-de-acesso.md)
> e de [`2026-10-01-resposta-da-interface-direcionamento.md`](2026-10-01-resposta-da-interface-direcionamento.md).

**Os três primeiros pedidos estão prontos.** Estão no contrato, nas três fontes
(Supabase, mock e Apps Script) e com teste. **Nenhuma migration foi necessária** —
o banco já tinha tudo.

---

## 0. Antes de tudo: o `recovery.ts` foi erro meu, não de vocês

Vocês avisaram que mudaram `src/lib/recovery.ts` de volta para imports
relativos, e ofereceram desfazer. **Não desfaçam.** `src/lib/` usa import
relativo em **15 arquivos e `@` em zero** — o alias era a exceção, e voltou pelo
meu merge da #23. A correção de vocês restaurou a convenção da própria pasta.

Não precisa mover o arquivo para `repositories/`.

---

## 1. Permissão a permissão (pedido 1)

Fui ver o que faltava no banco e a resposta foi: nada. A RLS de
`user_permissions` já dizia tudo:

| Operação | Quem pode |
|---|---|
| `select` | o próprio usuário, **ou quem tem `users.approve`** |
| `insert` / `delete` | quem tem `users.approve` |

Então a implementação é acesso direto à tabela, sem RPC nova. **Uma função no
banco seria um segundo cadeado na mesma porta.**

### O contrato, com uma diferença do que vocês propuseram

```ts
users.listPermissions(session): Promise<PermissionOption[]>
users.getPermissions(userId, session): Promise<UserPermission[]>   // ← não string[]
users.setPermissions(userId, permissions: string[], session): Promise<void>
```

```ts
interface PermissionOption { code: string; description: string }
interface UserPermission  { code: string; grantedBy: string; grantedAt: string }
```

**Por que `UserPermission[]` e não `string[]`:** o gestor decidiu em 01/10 **não
travar** quais permissões podem ser concedidas, e em troca **guardar o rastro de
quem concedeu o quê** (a alternativa era exigir `system.admin` para conceder as
permissões fortes — ver § 4). O rastro só serve se chegar à tela, então ele vem
na leitura.

`grantedBy` vem **vazio** quando a permissão veio da aprovação inicial, que
copia o perfil sem autor (D22). Conferido no banco: das 5 contas, duas têm autor
e três não. Na tela, vazio quer dizer "veio com o perfil".

### Três coisas que a tela precisa saber

1. **`setPermissions` recebe a lista COMPLETA.** O que não estiver nela é
   retirado. Não é "acrescente estas".
2. **Só o que mudou é gravado.** Apagar tudo e regravar daria a mesma lista
   final, mas carimbaria todas as permissões com a data e o autor de hoje — e aí
   o rastro não valeria nada. O adaptador faz a diferença e mexe só nela.
3. **Código inválido é recusado**, pela chave estrangeira no banco e por uma
   checagem explícita no mock, para o erro ser o mesmo nos dois modos.

### O catálogo já vem em português

São **20 permissões**, com `description` já escrita para a tela — não precisa
traduzir código:

```
targets.manage        → Alterar metas
production.edit_own   → Corrigir os próprios apontamentos (até 24 h)
users.approve         → Aprovar usuários e ajustar permissões
```

---

## 2. `roleName` na sessão (pedido 2)

`Session` ganhou `roleName?: string`, preenchido em `buildSession()` — o único
lugar que monta a sessão, então login e revalidação pegam juntos.

```ts
session.roleName   // "Gestor", "Distribuidor", "Operador"
```

Podem apagar a dedução pelas permissões. Ela acertava por acaso: duas pessoas de
perfis **diferentes** com o mesmo conjunto apareciam iguais — e agora que o
gestor pode ajustar permissão a permissão, isso deixa de ser raro.

---

## 3. Código próprio para as OPs (pedido 3)

Continua valendo o que vocês escreveram: `feedbacks.view` serve, porque a
conversa da OP é a mesma dos feedbacks. Criar um código separado é **uma linha
no catálogo** — mas é a única coisa desta nota que precisa de migration, e não
quis gastar uma migration numa separação que ninguém pediu ainda.

**Peçam quando a tela precisar de verdade** (por exemplo, se alguém puder ver
feedbacks mas não OPs). Até lá, `feedbacks.view`.

---

## 4. A decisão do gestor sobre escalada de privilégio

A política de `insert` diz só "quem tem `users.approve`", **sem restringir qual
permissão pode ser concedida**. Na prática um gestor pode conceder
`system.admin` — a si mesmo, inclusive.

Isso **já era verdade antes da tela**; a diferença é que exigia acesso SQL. As
opções eram travar as permissões fortes (migration) ou registrar quem concedeu.

**O gestor escolheu registrar** (01/10/2026), com este raciocínio: a fábrica tem
2 gestores e 1 Adm, todos conhecidos; travar criaria burocracia sem reduzir
risco real, e `granted_by` responde à pergunta que importa — *quem deu isso a
ele*.

**Para a tela:** mostrar `grantedBy` e `grantedAt` ao lado de cada permissão, e
não esconder as fortes. Elas não são proibidas; são rastreadas.

---

## 5. O mock mudou junto (e o `demoClient` de vocês pode sair)

O mock espelhava permissões direto do perfil, o que tornava a edição impossível
de demonstrar. Agora segue o D22 como o banco:

```
   aprovar  →  copia as permissões do PERFIL para a conta
   daí em diante  →  vale a lista DA CONTA, ajustável uma a uma
```

Conta sem lista própria cai no modelo do perfil — é o estado de quem ainda não
foi aprovado.

Vocês escreveram que o `demoClient.ts` sai se existir uma fonte de mentira de
autenticação do nosso lado. **Ela existe e agora está completa**: `mockAuth` e
`mockUsers` cobrem entrar, cadastrar, recuperar, aprovar, bloquear, listar
perfis e agora as permissões. Fica a critério de vocês.

---

## 6. Testado

`src/test/permissoes.test.ts`, 12 casos. Os que valem a pena citar:

- **quem não aprova NÃO vê as permissões de outro** (a RLS, espelhada no mock);
- **a lista é completa**: salvar `["dashboard.view"]` num técnico tira as outras;
- **ajustar não volta atrás ao entrar de novo** — este é o que prova o D22; quebrei
  de propósito o `permissoesDe()` para confirmar que ele falha quando deveria;
- **o gestor PODE conceder `system.admin`, e fica registrado** — a decisão do § 4
  virou teste, para ninguém "consertar" isso por engano depois.

Total: 79 testes, `tsc` e eslint limpos.

---

## 7. O que continua nosso, e aberto

Nada no contrato. O que falta do lado do banco é o da nota de virada:
projeto oficial, as 7 contas, feriados e o SMTP para quando a fábrica inteira
entrar.
