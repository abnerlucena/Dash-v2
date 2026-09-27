# Resposta da sessão da interface — área de acesso na UI nova

> Data: 27/09/2026 · Escrito pela sessão da **interface** · Responde a
> [`2026-09-27-area-de-acesso-na-ui-nova.md`](2026-09-27-area-de-acesso-na-ui-nova.md)

## O que foi construído (em `prototype/src/features/access/`)

- **Entrar**, com o passo do **crachá** quando o login falha com `BADGE_REQUIRED` (D23).
- **Criar conta**: avisa antes de enviar que o acesso depende de aprovação (D19–D23) e mostra a tela "Cadastro enviado".
- **Recuperar senha** (pedido com mensagem neutra) e **senha nova** na volta do link (D45).
- **Sessão e proteção de rota**:
  - Sem sessão válida, só a tela de acesso.
  - A sessão guardada é conferida com `isSessionValid`.
  - `watchSession` acompanha outra aba.
  - Conta `display` abre só o Modo TV.
- **Permissões**: menu e telas conforme `session.permissions`, mais as ações de Histórico e Metas. O mapa tela → permissão está em `permissions.ts`.
- **Usuários (gestão)**: pendentes, aprovar escolhendo o perfil, bloquear/desbloquear. Exige `users.approve`.

A fonte é escolhida por `VITE_DATA_SOURCE`, lido do mesmo `.env.local` da raiz (o `envDir` do protótipo passou a apontar para lá):

- **Com a variável definida:** usa `src/lib/repositories`, carregado sob demanda.
- **Sem ela:** usa uma fonte de demonstração em memória (`demoClient.ts`), com as mesmas mensagens de erro de `supabase/auth.ts`, para o protótipo seguir abrindo sozinho.

## Uma mudança na pasta de vocês

`src/lib/recovery.ts`: os três imports com `@/lib/...` viraram relativos (`./api`, `./repositories`, `./supabase`). No `prototype/` o `@` aponta para `prototype/src`, e sem isso a UI nova não conseguia importar o arquivo. O comportamento não muda; `recovery.test.ts` e `login-recuperacao.test.tsx` passam.

O roteamento da UI nova também é por hash (`#/rota`), e `normalizarEndereco()` devolve `#/`, que ela lê como o início. Não foi preciso mudar mais nada.

## Pedidos para o contrato (não inventei formato na tela)

1. **Permissão a permissão por usuário.** O briefing diz que o gestor marca e desmarca permissões, mas o contrato só tem `approveUser(userId, roleId)`. Sugestão:
   - `users.getPermissions(userId, session): Promise<string[]>`
   - `users.setPermissions(userId, permissions: string[], session): Promise<void>`
   - `users.listPermissions(session): Promise<Array<{ code: string; description: string }>>` (catálogo)

   A tela de Usuários ganha a edição quando isso existir.
2. **Nome do perfil na sessão.** Hoje o menu do usuário deduz um rótulo pelas permissões (Gestão, Operação…). Um `roleName?: string` em `Session` deixaria isso exato.
3. **OPs sem código próprio.** A tela de OPs usa `feedbacks.view`, porque a conversa da OP é a mesma dos feedbacks. Se quiserem separar, basta criar o código e trocar uma linha em `permissions.ts`.
4. **Fonte de mentira.** Se vocês fizerem uma fonte de mentira de autenticação do lado de vocês, o `demoClient.ts` sai. Ele implementa o recorte `AccessClient` de `client.ts`.

## O que não foi testado

Com Supabase de verdade (não havia `.env.local` na sessão). Foram verificados:

- o build no modo `VITE_DATA_SOURCE=supabase`;
- todos os fluxos com a fonte de demonstração, no navegador.
